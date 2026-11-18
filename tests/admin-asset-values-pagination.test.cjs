const assert = require('node:assert/strict');
const test = require('node:test');
const { PGlite } = require('@electric-sql/pglite');
const loadTs = require('./helpers/load-ts.cjs');

test('admin asset values pages and filters both pending suggestion sources', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE TABLE "user" (id text, email text);
    CREATE TABLE asset_register_items (id int, user_id text, title text, value numeric, updated_at date);
    CREATE TABLE asset_value_requests (owner_id text, asset_id int, status text);
    CREATE TABLE dealer_asset_correction_requests (
      owner_user_id text, asset_register_item_id int, status text, replacement_price_changed boolean
    );
    INSERT INTO "user" VALUES ('owner', 'owner@example.com');
    INSERT INTO asset_register_items SELECT i, 'owner', 'Asset ' || i, 100, '2026-01-01'
      FROM generate_series(1, 103) i;
    INSERT INTO asset_value_requests VALUES ('owner', 2, 'pending'), ('owner', 3, 'accepted');
    INSERT INTO dealer_asset_correction_requests VALUES
      ('owner', 2, 'pending', true), ('owner', 101, 'pending', true), ('owner', 7, 'pending', false);
  `);
  const { ownerValueApi } = loadTs('lib/asset-value-api.ts', {
    './auth-session': { getAnyServerSession: async () => ({ user: { email: 'admin@example.com' } }) },
    './account-constants': { isAim4priceAdminEmail: () => true },
    './business-network-api': { businessJson: (data) => data },
    './asset-value-requests': { ensureValueRequests: async () => {} },
    './db': { getDb: () => db },
    './asset-register-account-access': {}, './owner-app-access': {}, './shared-asset-contributions': {},
    './asset-register-db': {}, './external-lead-access': {}, './asset-value-mail': {}, './asset-replacement-mail': {},
  });
  const list = (query) => ownerValueApi({ method: 'GET', nextUrl: new URL('https://example.com/?' + query) }, undefined, true);
  const first = await list('page=1');
  assert.equal(first.total, 103);
  assert.equal(first.items.length, 50);
  assert.equal((await list('page=2')).items[0].id, 51);
  const last = await list('page=999');
  assert.equal(last.page, 3);
  assert.deepEqual(last.items.map((row) => row.id), [101, 102, 103]);
  const pending = await list('pending=1');
  assert.equal(pending.total, 2);
  assert.deepEqual(pending.items.map(({ id, pending }) => [id, pending]), [[2, 2], [101, 1]]);
  assert.deepEqual(await list('search=missing&page=99'), { total: 0, page: 1, items: [] });
});
