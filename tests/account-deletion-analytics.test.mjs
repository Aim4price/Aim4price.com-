import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const source = readFileSync(new URL('../lib/account-deletion.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function deletionApi(db) {
  const client = {
    async query(sql, values) {
      // PGlite has one connection; the production advisory lock coordinates
      // concurrent uploads and is not part of these data-cleanup assertions.
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 0 };
      const result = await db.query(sql, values);
      return { ...result, rowCount: result.affectedRows ?? result.rows.length };
    },
    release() {},
  };
  const exports = {};
  new Function('exports', 'require', compiled)(exports, (name) => {
    assert.equal(name, './db');
    return { getDb: () => ({ connect: async () => client }) };
  });
  return exports;
}

test('account deletion removes identifiable analytics without deleting other users or guest views', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table admin_usage_events (id int, user_id text, metadata jsonb);
      create table marketplace_listing_views (id int, seller_user_id text, viewer_user_id text, anonymous_viewer_hash text);
      create table asset_discovery_views (id int, owner_user_id text, viewer_user_id text, anonymous_viewer_hash text);
      insert into admin_usage_events values
        (1, 'deleted-user', '{"input":{"notes":"private source details"}}'),
        (2, 'other-user', '{}'), (3, null, '{}');
      insert into marketplace_listing_views values
        (1, 'seller', 'deleted-user', null),
        (2, 'deleted-user', 'other-user', null),
        (3, 'seller', 'other-user', null),
        (4, 'seller', null, 'guest-hash');
      insert into asset_discovery_views values
        (1, 'owner', 'deleted-user', null),
        (2, 'deleted-user', 'other-user', null),
        (3, 'owner', 'other-user', null);
    `);
    await deletionApi(db).deleteUserWorkspaceData('deleted-user');
    for (const [table, expected] of [
      ['admin_usage_events', [2, 3]],
      ['marketplace_listing_views', [3, 4]],
      ['asset_discovery_views', [3]],
    ]) {
      const result = await db.query(`select id from ${table} order by id`);
      assert.deepEqual(result.rows.map(row => row.id), expected, table);
    }
    // The same closure request can be retried safely.
    await deletionApi(db).deleteUserWorkspaceData('deleted-user');
  } finally { await db.close(); }
});

test('pre-analytics schemas still support account deletion', async () => {
  const db = new PGlite();
  try { await deletionApi(db).deleteUserWorkspaceData('deleted-user'); }
  finally { await db.close(); }
});

test('analytics cleanup rolls back with a failed account deletion', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table admin_usage_events (id int, user_id text);
      insert into admin_usage_events values (1, 'deleted-user');
      create table account_profiles (user_id text primary key);
      insert into account_profiles values ('deleted-user');
      create table retained_reference (user_id text references account_profiles(user_id));
      insert into retained_reference values ('deleted-user');
    `);
    await assert.rejects(deletionApi(db).deleteUserWorkspaceData('deleted-user'), /foreign key constraint/);
    assert.equal((await db.query('select * from admin_usage_events')).rows.length, 1);
  } finally { await db.close(); }
});
