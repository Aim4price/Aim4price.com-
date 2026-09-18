import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function load(path, dependencies) {
  const exports = {};
  const compiled = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'require', compiled)(exports, name => { assert.ok(name in dependencies, name); return dependencies[name]; });
  return exports;
}
async function fixture() {
  const db = new PGlite();
  await db.exec(`create table public."user" (id text primary key); insert into public."user" values ('owner'), ('other'), ('dealer');`);
  const pool = { query: async (sql, values) => sql.includes('create table') ? db.exec(sql) : db.query(sql, values) };
  const api = load('lib/capture-allowance.ts', { './db': { getDb: () => pool } });
  await api.ensureCaptureAllowanceSchema();
  const reserve = (owner, type, id = randomUUID(), fail = false) => db.transaction(async tx => {
    let locked = false;
    const client = { query: (sql, values) => {
      // PGlite serializes transactions; PostgreSQL uses the tested advisory lock call.
      if (sql.includes('pg_advisory_xact_lock')) { assert.deepEqual(values, [`capture-allowance:${owner}:${type}`]); locked = true; return { rows: [] }; }
      assert.equal(locked, true, 'count and insert must follow the account/ledger lock');
      return tx.query(sql, values);
    } };
    await api.reserveCaptureAllowance(client, owner, type, id);
    if (fail) throw new Error('simulated creation failure');
    return id;
  });
  return { db, api, reserve };
}
test('ten submissions per ledger/account; concurrent attempts cannot exceed ten', async () => {
  const { db, api, reserve } = await fixture();
  try {
    const submissions = await Promise.allSettled(Array.from({ length: 16 }, () => reserve('owner', 'invoice')));
    assert.equal(submissions.filter(x => x.status === 'fulfilled').length, 10);
    assert.ok(submissions.filter(x => x.status === 'rejected').every(x => x.reason.message === 'CAPTURE_DAILY_LIMIT'));
    assert.equal((await api.getCaptureAllowance('owner', 'invoice')).blocked, true);
    await reserve('owner', 'fuel_slip');
    await reserve('other', 'invoice');
    assert.equal((await api.getCaptureAllowance('owner', 'fuel_slip')).used, 1);
    assert.equal((await api.getCaptureAllowance('other', 'invoice')).used, 1);
    const admin = await api.getCaptureAllowance('owner', 'invoice', true);
    assert.equal(admin.blocked, false); assert.equal(admin.used, 10);
  } finally { await db.close(); }
});
test('South African day resets independently of UTC; yesterday does not consume today', async () => {
  const { db, api } = await fixture();
  try {
    await db.query(`insert into capture_daily_usage values ($1, 'owner', 'invoice', (now() at time zone 'Africa/Johannesburg')::date - 1)`, [randomUUID()]);
    const state = await api.getCaptureAllowance('owner', 'invoice');
    assert.equal(state.used, 0); assert.equal(new Date(state.resetsAt).getUTCHours(), 22);
    const boundary = await db.query(`select ('2026-09-18 21:59:59+00'::timestamptz at time zone 'Africa/Johannesburg')::date::text as before,
      ('2026-09-18 22:00:00+00'::timestamptz at time zone 'Africa/Johannesburg')::date::text as after`);
    assert.deepEqual(boundary.rows[0], { before: '2026-09-18', after: '2026-09-19' });
  } finally { await db.close(); }
});
test('creation rollback and failed attachment release do not spend an allowance', async () => {
  const { db, api, reserve } = await fixture();
  try {
    await assert.rejects(reserve('owner', 'invoice', randomUUID(), true), /simulated creation failure/);
    assert.equal((await api.getCaptureAllowance('owner', 'invoice')).used, 0);
    const id = await reserve('owner', 'invoice');
    await api.releaseFailedCaptureAllowance(id); await api.releaseFailedCaptureAllowance(id);
    assert.equal((await api.getCaptureAllowance('owner', 'invoice')).used, 0);
  } finally { await db.close(); }
});
test('popup tracking is idempotent, distinct from help, and removed on account deletion', async () => {
  const { db, api, reserve } = await fixture();
  try {
    const first = await api.recordCaptureAssistance('owner', 'dealer', 'invoice', false);
    assert.equal(await api.recordCaptureAssistance('owner', 'dealer', 'invoice', false), first);
    assert.equal((await db.query('select requested_at from capture_assistance_requests')).rows[0].requested_at, null);
    await api.recordCaptureAssistance('owner', 'dealer', 'invoice', true, 'Please help with 40 invoices');
    await api.recordCaptureAssistance('owner', 'dealer', 'invoice', false);
    const row = (await db.query('select * from capture_assistance_requests')).rows[0];
    assert.ok(row.requested_at); assert.equal(row.note, 'Please help with 40 invoices');
    await reserve('owner', 'invoice');
    await db.query(`delete from public."user" where id = 'owner'`);
    assert.equal((await db.query('select * from capture_assistance_requests')).rows.length, 0);
    assert.equal((await db.query('select * from capture_daily_usage')).rows.length, 0);
  } finally { await db.close(); }
});
test('only verified platform Admin sessions bypass; account admin role is insufficient', async () => {
  let session = { user: { id: 'owner', email: 'owner@example.com' }, role: 'admin' };
  const api = load('lib/capture-admin-actor.ts', {
    './auth-session': { getServerSession: async () => session, isAdminSupportSession: value => !!value?.adminSupport },
    './account-constants': { isAim4priceAdminEmail: email => email === 'admin@example.com' },
  });
  assert.equal(await api.getCaptureAdminActor(), null);
  session = { ...session, adminSupport: { adminUserId: 'real-admin', adminEmail: 'admin@example.com' } };
  assert.equal((await api.getCaptureAdminActor()).userId, 'real-admin');
  session = { user: { id: 'real-admin', email: 'admin@example.com' } };
  assert.equal((await api.getCaptureAdminActor()).actorType, 'admin');
  session = null; assert.equal(await api.getCaptureAdminActor(), null);
});
test('all authenticated intake routes return the same limit response and use the server Admin actor', () => {
  for (const path of ['app/api/capture-requests/invoice/route.ts', 'app/api/capture-requests/fuel-slip/route.ts', 'app/api/dealer/capture-requests/invoice/route.ts']) {
    const source = read(path);
    assert.match(source, /await getCaptureAdminActor\(\) \?\?/);
    assert.match(source, /code: CAPTURE_LIMIT_CODE/);
    assert.match(source, /status: 429/);
    assert.match(source, /releaseFailedCaptureAllowance\(createdCaptureId\)/);
  }
  const source = read('lib/capture-requests.ts');
  assert.match(source, /ownerUserId && actor.actorType !== 'admin'/);
  assert.match(source, /await reserveCaptureAllowance\(client, ownerUserId, requestType, String\(row.id\)\)/);
  for (const path of ['app/api/my-invoices/upload/route.ts', 'app/api/fuel/slips/route.ts']) assert.doesNotMatch(read(path), /reserveCaptureAllowance|CAPTURE_DAILY_LIMIT/);
});
test('assistance API derives account scope from access checks and rejects unauthorised tracking', async () => {
  let authorized = true, blocked = true;
  const records = [];
  const api = load('app/api/capture-allowance/route.ts', {
    'next/server': { NextResponse: Response },
    '../../../lib/owner-workspace-access': { resolveOwnerWorkspaceContext: async () => authorized
      ? { ok: true, context: { ownerUserId: 'verified-owner', actorUserId: 'verified-owner', accountantAccess: null } }
      : { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) } },
    '../../../lib/dealer-cost-request': { getDealerCostRequestContext: async () => ({ actor: { dealerUserId: 'dealer' } }) },
    '../../../lib/dealer-costs': { getDealerCostAssetAccess: async (dealer, asset) => asset === 'shared-asset' ? { owner_user_id: 'shared-owner' } : null },
    '../../../lib/owner-app-access': { getOwnerAppAccess: async () => ({}), ownerAppCan: () => true },
    '../../../lib/capture-admin-actor': { getCaptureAdminActor: async () => null },
    '../../../lib/capture-allowance': { getCaptureAllowance: async owner => ({ blocked, owner }), recordCaptureAssistance: async (...args) => records.push(args) },
  });
  const url = 'https://example.com/api/capture-allowance?type=invoice&ownerUserId=attacker-choice';
  const post = () => new Request(url, { method: 'POST', body: JSON.stringify({ action: 'request', note: 'Help', ownerUserId: 'attacker-choice', bypass: true }) });
  assert.equal((await api.POST(post())).status, 200);
  assert.deepEqual(records[0].slice(0, 4), ['verified-owner', 'verified-owner', 'invoice', true]);
  authorized = false;
  assert.equal((await api.POST(post())).status, 403);
  assert.equal(records.length, 1);
  authorized = true; blocked = false;
  assert.equal((await api.POST(post())).status, 409);
  assert.equal(records.length, 1);
  assert.equal((await api.GET(new Request(url + '&dealer=1&assetId=other-asset'))).status, 404);
  const shared = await api.GET(new Request(url + '&dealer=1&assetId=shared-asset'));
  assert.equal((await shared.json()).owner, 'shared-owner');
});
