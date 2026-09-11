const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
function load(file, mocks) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'exports', code)(name => name in mocks ? mocks[name] : require(name), exports);
  return exports;
}
function request(identity, origin = 'https://www.aim4price.com') {
  return new NextRequest('https://www.aim4price.com/api/field-manager/offline/sync?assetId=asset&code=A4P-TEST', { method: 'POST', headers: { origin, 'x-aim4price-offline-identity': identity || '', 'content-type': 'application/json' }, body: '{"clientEventId":"stable-id"}' });
}
test('offline sync requires the exact owner and manager and a same-origin request', async () => {
  const helper = load('lib/field-manager-offline-access.ts', { './notification-request-origin': load('lib/notification-request-origin.ts', {}), './field-manager-session': { requireActiveFieldManagerSession: async () => ({ ok: true, session: { ownerUserId: 'owner', managerId: 'manager' } }) } });
  for (const identity of ['', 'other:manager', 'owner:other']) assert.equal((await helper.requireOfflineIdentity(request(identity))).response.status, 409);
  assert.equal((await helper.requireOfflineIdentity(request('owner:manager', 'https://attacker.example'))).response.status, 403);
  assert.equal((await helper.requireOfflineIdentity(request('owner:manager'))).ok, true);
});
test('snapshot excludes other assets, other assigned managers, completed work and financial fields', async () => {
  const route = load('app/api/field-manager/offline/route.ts', {
    '../../../../lib/field-manager-offline-access': { requireOfflineIdentity: async () => ({ ok: true, identity: 'owner:manager', session: { ownerUserId: 'owner', managerId: 'manager', displayName: 'Manager' } }), offlineHeaders: { 'Cache-Control': 'private, no-store' } },
    '../../../../lib/field-manager': { listFieldManagerAssets: async () => [{ id: 'asset', title: 'Tractor', usageMetric: 'hours', value: 500000 }], fieldManagerCan: async () => true },
    '../../../../lib/asset-maintenance': { listAssetMaintenanceRecords: async () => [
      { id: 'allowed', assetId: 'asset', status: 'upcoming', assignedFieldManagerId: 'manager', assetValue: 500000 },
      { id: 'shared', assetId: 'asset', status: 'upcoming', assignedFieldManagerId: null },
      { id: 'other-manager', assetId: 'asset', status: 'upcoming', assignedFieldManagerId: 'other' },
      { id: 'other-asset', assetId: 'other', status: 'upcoming' }, { id: 'done', assetId: 'asset', status: 'done' },
    ] },
  });
  const response = await route.GET(new NextRequest('https://www.aim4price.com/api/field-manager/offline'));
  const body = await response.json();
  assert.deepEqual(body.tasks.map(t => t.id), ['allowed', 'shared']);
  assert.equal('value' in body.assets[0], false); assert.equal('assetValue' in body.tasks[0], false);
  assert.match(response.headers.get('cache-control'), /no-store/);
});
test('sync delegates unchanged credentials and event ID to existing field scan validation', async () => {
  let called = false;
  const route = load('app/api/field-manager/offline/sync/route.ts', {
    '../../../../../lib/field-manager-offline-access': { requireOfflineIdentity: async () => ({ ok: true }), offlineHeaders: {} },
    '../../../scan/assets/[publicAssetCode]/event/route': { POST: async (req, context) => {
      called = true;
      assert.equal(req.nextUrl.searchParams.get('fieldManager'), '1'); assert.equal(req.nextUrl.searchParams.get('assetId'), 'asset');
      assert.equal(req.headers.get('x-aim4price-offline-identity'), 'owner:manager');
      assert.equal((await req.json()).clientEventId, 'stable-id'); assert.equal(context.params.publicAssetCode, 'A4P-TEST');
      return NextResponse.json({ ok: true });
    } },
  });
  assert.equal((await route.POST(request('owner:manager'))).status, 200); assert.ok(called);
});
test('denied offline requests never reach scan or photo writes', async () => {
  for (const [file, dependency] of [['sync', '../../../scan/assets/[publicAssetCode]/event/route'], ['upload', '../../../scan/uploads/route']]) {
    const route = load(`app/api/field-manager/offline/${file}/route.ts`, {
      '../../../../../lib/field-manager-offline-access': { requireOfflineIdentity: async () => ({ ok: false, response: new NextResponse('Denied', { status: 401 }) }), offlineHeaders: {} },
      '../../../../../lib/field-manager': { fieldManagerCan: async () => { throw Error('must not be called'); } },
      [dependency]: { POST: async () => { throw Error('must not be called'); } },
    });
    assert.equal((await route.POST(request('owner:manager'))).status, 401);
  }
});
