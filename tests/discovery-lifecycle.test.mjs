import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const discovery = read('lib/asset-discovery.ts');
const adverts = read('lib/recent-marketplace-adverts.ts');

test('Discovery excludes archived and disposed assets, including stale live adverts', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table assets (id int, lifecycle_state text);
      insert into assets values (1, 'active'), (2, 'archived'), (3, 'disposed'), (4, null);`);
    const predicate = discovery.match(/coalesce\(to_jsonb\(asset\)->>'lifecycle_state', 'active'\) = 'active'/)?.[0];
    assert.ok(predicate);
    assert.ok(adverts.includes(predicate));
    const result = await db.query(`select id from assets asset where ${predicate} order by id`);
    assert.deepEqual(result.rows.map(row => row.id), [1, 4]);
    const publicWhere = discovery.slice(discovery.indexOf('function basePublicAssetWhere'));
    assert.ok(publicWhere.includes(predicate));
  } finally { await db.close(); }
});

test('Saved adverts hide missing and removed register assets while preserving standalone adverts', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table assets (id int, lifecycle_state text);
      create table listings (id int, asset_register_item_id int);
      insert into assets values (1, 'active'), (2, 'archived'), (3, 'disposed');
      insert into listings values (1, 1), (2, 2), (3, 3), (4, 99), (5, null);`);
    const predicate = adverts.match(/listing.asset_register_item_id is null or \(\s*current_asset.id is not null\s*and coalesce\(to_jsonb\(current_asset\)->>'lifecycle_state', 'active'\) = 'active'\s*\)/)?.[0];
    assert.ok(predicate);
    const result = await db.query(`select listing.id from listings listing left join assets current_asset on current_asset.id = listing.asset_register_item_id where (${predicate}) order by listing.id`);
    assert.deepEqual(result.rows.map(row => row.id), [1, 5]);
  } finally { await db.close(); }
});
