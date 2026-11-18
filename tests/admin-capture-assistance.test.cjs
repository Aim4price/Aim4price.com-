const test = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const loadTs = require('./helpers/load-ts.cjs');

test('outstanding assistance includes only requested follow-ups and retains totals past the last page', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create table "user"(id text, email text, name text);
    create table account_profiles(user_id text, business_name text, display_name text);
    create table capture_assistance_requests(id int, owner_user_id text, actor_user_id text,
      shown_at timestamptz, requested_at timestamptz, resolved_at timestamptz);
    insert into "user" values ('owner','owner@example.com','Owner');
    insert into capture_assistance_requests values
      (1,'owner','owner',now(),null,null),
      (2,'owner','owner',now(),now(),null),
      (3,'owner','owner',now(),now(),now());
  `);
  const { GET } = loadTs('app/api/admin/capture-assistance/route.ts', {
    'next/server': { NextResponse: Response },
    '../../../../lib/admin-api-access': { requireAdminApiAccess: async () => ({ ok: true }) },
    '../../../../lib/capture-allowance': { ensureCaptureAllowanceSchema: async () => {} },
    '../../../../lib/db': { getDb: () => db },
  });
  const list = async query => (await GET(new Request('https://example.test/?' + query))).json();
  const outstanding = await list('open=1');
  assert.deepEqual(outstanding.rows.map(row => row.id), [2]);
  assert.equal(outstanding.pending, 1);
  assert.equal(outstanding.total, 1);
  assert.equal((await list('open=0')).rows.length, 3);
  assert.deepEqual(await list('open=0&offset=50'), { ok: true, rows: [], total: 3, pending: 1 });
});
