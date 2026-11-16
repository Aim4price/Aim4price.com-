import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(path, deps = {}) {
  const code = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  Function('require', 'module', 'exports', code)(id => id in deps ? deps[id] : require(id), module, module.exports);
  return module.exports;
}
const shared = load('lib/admin-operations-shared.ts');
const constants = { CAPTURE_REQUEST_STATUSES: ['submitted','needs_matching','in_progress','needs_information','awaiting_owner','completed','declined','rejected','cancelled'], CAPTURE_REQUEST_TYPES: ['invoice','fuel_slip'], CAPTURE_SUBMISSION_CHANNELS: ['owner_upload','accountant_upload','dealer_upload','public_drop'] };
function routeFixture(accessAllowed = true) {
  const lists = [], counts = [];
  const domain = { ...constants, listCaptureRequests: async filters => { lists.push(filters); return []; }, countCaptureRequests: async filters => { counts.push(filters); return 151; }, getCaptureQueueCounts: async () => ({totalOpen:151}) };
  const route = load('app/api/admin/capture-requests/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '../../../../lib/admin-api-access': { requireAdminApiAccess: async () => accessAllowed ? {ok:true} : {ok:false,response:Response.json({error:'Admin access required'},{status:403})}, adminApiError: (error,status) => Response.json({ok:false,error},{status}) },
    '../../../../lib/admin-capture-targets': { getAdminCaptureTargets: async () => new Map(), adminCaptureTargetKey: () => '' },
    '../../../../lib/capture-requests': domain, '../../../../lib/admin-operations-shared': shared,
  });
  return { lists, counts, get: query => route.GET({ nextUrl: new URL('https://aim4price.com/api/admin/capture-requests?' + query) }) };
}
test('capture pagination shares exact filters with total count and preserves explicit all requests', async () => {
  const f = routeFixture();
  const response = await f.get('status=all&page=3&owner=customer-one&search=reference&requestType=invoice');
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).pagination, {page:3,pageSize:50,total:151,hasNextPage:true});
  assert.equal(f.lists[0].statuses,undefined);
  assert.equal(f.lists[0].offset,100);
  assert.equal(f.lists[0].limit,50);
  assert.equal(f.lists[0].ownerUserId,'customer-one');
  assert.equal(f.lists[0].search,'reference');
  assert.deepEqual(f.lists[0].requestTypes,['invoice']);
  assert.deepEqual(f.lists[0],f.counts[0]);
});
test('unclaimed and deadline filters exclude terminal work and pause the SLA for owner review', async () => {
  const f = routeFixture();
  await f.get('status=unassigned');
  assert.equal(f.lists[0].unassignedOnly,true);
  assert.ok(!f.lists[0].statuses.includes('completed'));
  await f.get('status=overdue');
  assert.ok(!f.lists[1].statuses.includes('awaiting_owner'));
  assert.equal(f.lists[1].dueBeforeExclusive,true);
  await f.get('status=due_today');
  assert.equal(f.lists[2].dueBefore - f.lists[2].dueAfter,86400000);
});
test('invalid page, type, channel and status fail before database reads; non-admins cannot query', async () => {
  const f = routeFixture();
  for (const query of ['page=0','page=-1','page=NaN','page=2.5','page=2002','status=bogus','requestType=bogus','submissionChannel=bogus']) assert.equal((await f.get(query)).status,400,query);
  assert.equal(f.lists.length,0);
  const denied = routeFixture(false);assert.equal((await denied.get('status=all')).status,403);assert.equal(denied.lists.length,0);
});
test('completed today is a database filter before pagination using South African midnight', async () => {
  assert.deepEqual(shared.johannesburgDayBounds(new Date('2026-12-31T22:30:00Z')), {start:'2026-12-31T22:00:00.000Z',end:'2027-01-01T22:00:00.000Z'});
  const f = routeFixture();await f.get('status=completed_today&page=2');
  assert.deepEqual(f.lists[0].statuses,['completed']);assert.ok(f.lists[0].completedAfter.endsWith('22:00:00.000Z'));assert.ok(f.lists[0].completedBefore.endsWith('22:00:00.000Z'));assert.equal(f.lists[0].offset,50);
});
test('capture SQL count applies owner, assignment and half-open completion bounds, with SA summary counts', async () => {
  const { PGlite } = await import('@electric-sql/pglite');const db = new PGlite();
  try {
    await db.exec(`set timezone='UTC'; create table document_capture_requests (owner_user_id text, assigned_admin_user_id text, status text, due_at timestamptz, completed_at timestamptz);
      insert into document_capture_requests values
      ('one',null,'completed','2026-12-31T21:00Z','2026-12-31T21:59:59Z'),
      ('one',null,'completed','2026-12-31T21:00Z','2026-12-31T22:00Z'),
      ('one',null,'completed','2026-12-31T21:00Z','2027-01-01T22:00Z'),
      ('two',null,'completed','2026-12-31T21:00Z','2026-12-31T22:05Z'),
      ('one',null,'submitted','2026-12-31T21:00Z',null),
      ('one','admin','in_progress','2026-12-31T21:00Z',null),
      ('one',null,'awaiting_owner','2026-12-31T21:00Z',null);`);
    const domain = load('lib/capture-requests.ts', {'./db':{getDb:()=>db},'./asset-usage':{},'./capture-allowance':{}});
    const day = shared.johannesburgDayBounds(new Date('2026-12-31T22:30Z'));
    assert.equal(await domain.countCaptureRequests({ownerUserId:'one',statuses:['completed'],completedAfter:day.start,completedBefore:day.end}),1);
    assert.equal(await domain.countCaptureRequests({ownerUserId:'one',statuses:['submitted','in_progress'],unassignedOnly:true}),1);
    const counts = await domain.getCaptureQueueCounts(new Date('2026-12-31T22:30Z'));
    assert.equal(counts.completedToday,2);assert.equal(counts.overdue,2);assert.equal(counts.awaitingOwner,1);assert.equal(counts.unassigned,2);
  } finally { await db.close(); }
});
test('attention cards retain available sources and show unavailable when a source fails', async () => {
  const module = load('lib/admin-attention.ts', {
    './account-constants': { AIM4PRICE_ADMIN_EMAIL:'admin@test' }, './account-profile': {ensureAccountProfileColumns:async()=>{}},
    './db': {getDb:()=>({query:async()=>({rows:[{count:'4'}]})})}, './capture-requests':{getCaptureQueueCounts:async()=>{throw Error('Offline');}},
  });
  const original = console.error;console.error=()=>{};
  try { const cards=await module.getAdminAttention();assert.equal(cards[0].count,4);assert.ok(cards.slice(1).every(card=>card.count===null));assert.equal(cards[0].href,'/admin?status=pending_payment'); } finally { console.error=original; }
});

test('account signup periods and activity dates follow SAST independently of the host timezone', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Africa/Johannesburg']) {
      process.env.TZ = zone;
      const now = new Date('2026-12-31T22:30:00Z');
      for (const period of ['month', 'year']) {
        const range = shared.adminSignupDateRange(period, now);
        assert.equal(range.start.toISOString(), '2026-12-31T22:00:00.000Z', zone);
        assert.equal(range.end.toISOString(), period === 'month' ? '2027-01-31T22:00:00.000Z' : '2027-12-31T22:00:00.000Z');
        assert.ok(new Date('2026-12-31T21:59:59Z') < range.start);
        assert.ok(new Date('2026-12-31T22:00:00Z') >= range.start);
      }
      const week = shared.adminSignupDateRange('week', new Date('2026-11-15T22:30:00Z'));
      assert.equal(week.start.toISOString(), '2026-11-15T22:00:00.000Z');
      assert.equal(week.end.toISOString(), '2026-11-22T22:00:00.000Z');
      const leap = shared.adminSignupDateRange('month', new Date('2028-02-28T23:30:00Z'));
      assert.equal(leap.end.toISOString(), '2028-02-29T22:00:00.000Z');
      assert.equal(shared.formatAdminLastActive('2026-12-31T22:00:00Z', now), 'Today');
      assert.equal(shared.formatAdminLastActive('2026-12-31T21:59:59Z', now), 'Yesterday');
      assert.equal(shared.formatAdminLastActive(null, now), 'Never');
      assert.equal(shared.formatAdminLastActive('invalid', now), 'Never');
      assert.equal(shared.formatAdminAccountDate('2026-12-31T22:00:00Z'), '01 Jan 2027');
      assert.equal(shared.formatAdminAccountDate('invalid'), 'Unknown');
      assert.equal(shared.adminSignupDateRange('all', now), null);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});
