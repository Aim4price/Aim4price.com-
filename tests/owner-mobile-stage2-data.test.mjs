import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function compile(path, dependencies = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', js)(name => dependencies[name] ?? dependencies[name.split('/').pop()] ?? {}, module, module.exports);
  return module.exports;
}
const copy = compile('lib/notification-copy.ts');
test('unnamed maintenance has a meaningful type fallback and preserves identity', () => {
  assert.equal(copy.maintenanceTaskTitle({ title: '  ', maintenanceType: 'checkup' }), 'Checkup');
  assert.equal(copy.maintenanceTaskTitle({ title: 'Radiator repair', maintenanceType: 'service' }), 'Radiator repair');
  const old = { id: 'maintenance-reminder:job:soon', title: 'Maintenance due soon', body: 'Troughs: . Due 2026-11-15.', isRead: true };
  assert.deepEqual(copy.normalizeNotificationCopy(old), { ...old, body: 'Troughs: Maintenance. Due 2026-11-15.' });
  assert.equal(copy.normalizeNotificationCopy({ id: 'maintenance-recurring:job', title: '', body: ' for Troughs was scheduled automatically.' }).body, 'Maintenance for Troughs was scheduled automatically.');
});
function notificationFixture(inbox, events) {
  const access = { ownerUserId: 'owner', ownerAppUserId: 'member', viewerKey: 'viewer', assetScope: 'all' };
  const marks = [];
  const api = compile('lib/owner-notification-inbox.ts', {
    'notification-inbox': { listNotificationInbox: async () => inbox, updateNotificationInboxState: async () => {} },
    'app-notification-state': { markAppNotificationKeys: async (_who, keys) => marks.push(...keys) },
    'owner-app-access': { ownerAppCan: () => true },
    'push-access': { currentPushIdentity: async () => ({ app: 'owner', accountId: 'owner', memberId: 'member' }), resolvePushAccess: async () => ({}) },
    'push-events': { listPushEvents: async () => events },
    'app-notification-history': { withAppNotificationHistory: async (_who, _access, items) => items },
  });
  const list = () => api.listOwnerNotificationInbox(access);
  list.mark = ids => api.markOwnerNotificationsRead(access, 'mark_read', ids);
  list.marks = marks;
  return list;
}
const notice = id => ({ id, category: 'maintenance', createdAtIso: '2026-11-09', state: 'new', assetId: 'asset', isRead: false });
test('owner inbox collapses the second reminder channel by record and stage, preserving inbox state', async () => {
  const saved = { ...notice('maintenance-reminder:job:soon'), state: 'history', isRead: true };
  const result = await notificationFixture([saved], [notice('maintenance:job:2026-11-15:due_soon')])();
  assert.equal(result.length, 1);
  assert.equal(result[0].id, saved.id);
  assert.equal(result[0].isRead, true);
  assert.equal(result[0].state, 'history');
  assert.equal(result[0].href, '/owner-app/assets/asset/maintenance?maintenanceId=job');
});
test('distinct maintenance jobs, new due stages and recurring confirmations are retained', async () => {
  const result = await notificationFixture([notice('maintenance-reminder:job:soon')], [notice('maintenance:other:2026-11-15:due_soon'), notice('maintenance:job:2026-11-15:overdue'), notice('maintenance-recurring:job')])();
  assert.equal(result.length, 4);
});
const maintenance = compile('lib/asset-maintenance.ts');
async function activity(records, scans) {
  const api = compile('lib/asset-activity.ts', {
    'asset-maintenance': { ...maintenance, listAssetMaintenanceRecords: async () => records },
    db: { getDb: () => ({ query: async sql => ({ rows: sql.includes('from public.asset_scan_events') ? scans : [] }) }) },
  });
  return api.listAssetActivity('owner', 'asset');
}
const job = { id: 'job', status: 'done', maintenanceType: 'service', title: 'Repair', completedNotes: 'Radiator repair', sourceScanEventId: 'scan', completedAtIso: '2026-11-09', completedBy: 'Gerald' };
test('legacy repair jobs use their recorded procedure rather than the service storage category', async () => {
  assert.equal((await activity([job], []))[0].title, 'Repair completed');
});
test('linked scan and maintenance are one activity while separate jobs remain visible', async () => {
  const rows = await activity([job, { ...job, id: 'other', sourceScanEventId: null }], [{ id: 'scan', note: 'Repaired radiator', location_text: 'Workshop', hours: null, created_at: '2026-11-09' }]);
  assert.equal(rows.length, 2);
  assert.ok(rows.some(item => item.id === 'maintenance:job' && item.detail.includes('Workshop')));
  assert.ok(rows.every(item => !item.detail.includes('0 hours')));
});
test('activity respects recorded usage units and does not invent units for older readings', async () => {
  const rows = await activity([], [
    { id: 'km', asset_usage_reading: 120, asset_usage_metric: 'km' },
    { id: 'percent', asset_usage_reading: 30, asset_usage_metric: 'percentage' },
    { id: 'legacy', hours: 42 },
    { id: 'none', hours: 0, asset_usage_metric: 'none' },
  ]);
  assert.equal(rows.find(row => row.id === 'work:km').detail, '120 km');
  assert.equal(rows.find(row => row.id === 'work:percent').detail, '30 % worked');
  assert.equal(rows.find(row => row.id === 'work:legacy').detail, '42 (usage reading)');
  assert.equal(rows.find(row => row.id === 'work:none').detail, '');
});
function manualFixture(allowed = true) {
  const writes = [];
  const api = compile('app/api/owner-app/assets/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } },
    'owner-app-access': { getOwnerAppAccess: async () => ({ ownerUserId: 'owner' }), ownerAppCan: () => allowed },
    'asset-register-db': { createManualAssetRegisterItem: async (owner, input) => { assert.equal(owner, 'owner'); writes.push(input); return { id: 'created' }; } },
  });
  return { writes, save: body => api.POST({ json: async () => ({ title: 'Asset', kind: 'equipment', value: 100, replacementPriceExVat: 200, ...body }) }) };
}
test('manual percentage usage is stored as percentage, never hours', async () => {
  const f = manualFixture();
  assert.equal((await f.save({ kind: 'tractor', usageMetric: 'percentage', hours: '30.5' })).status, 200);
  assert.equal(f.writes[0].kind, 'tractor');
  assert.equal(f.writes[0].lifeWorkedPercent, 30.5);
  assert.equal(f.writes[0].hours, null);
  assert.equal(f.writes[0].usageMetric, null);
  assert.equal(f.writes[0].specsJson.selectedUsageMode, 'percentage');
});
test('invalid percentages and unsupported units never write assets', async () => {
  for (const hours of ['', '-1', '100.1', 'NaN', 'Infinity']) {
    const f = manualFixture(); assert.equal((await f.save({ usageMetric: 'percentage', hours })).status, 400); assert.equal(f.writes.length, 0);
  }
  const f = manualFixture(); assert.equal((await f.save({ usageMetric: 'miles' })).status, 400);
});
test('stock and land replacement exemptions match desktop; buildings and equipment remain required', async () => {
  for (const body of [{ kind: 'stock' }, { kind: 'property', propertyAssetSubtype: 'land' }]) {
    const f = manualFixture(); assert.equal((await f.save({ ...body, replacementPriceExVat: '' })).status, 200);
  }
  for (const body of [{ kind: 'equipment' }, { kind: 'property', propertyAssetSubtype: 'building' }, { kind: 'property' }]) {
    const f = manualFixture(); assert.equal((await f.save({ ...body, replacementPriceExVat: '' })).status, 400); assert.equal(f.writes.length, 0);
  }
});
test('manual permissions and not-applicable usage are preserved', async () => {
  const denied = manualFixture(false); assert.equal((await denied.save({})).status, 403); assert.equal(denied.writes.length, 0);
  const f = manualFixture(); await f.save({ usageMetric: 'not_applicable', hours: '99' });
  assert.equal(f.writes[0].hours, null); assert.equal(f.writes[0].lifeWorkedPercent, null); assert.equal(f.writes[0].specsJson.usageApplicable, false);
});
const gauge = compile('lib/fuel-gauge.ts');
test('fuel gauges require intentional readings, including explicit empty and full', () => {
  for (const value of ['', ' ', 'NaN', 'Infinity', '-1', '101']) assert.equal(gauge.fuelGaugeReading(value), null);
  assert.equal(gauge.fuelGaugeError('', '100'), 'Choose the fuel level before filling.');
  assert.equal(gauge.fuelGaugeError('0', ''), 'Choose the fuel level after filling.');
  assert.equal(gauge.fuelGaugeError('0', '100'), '');
  assert.equal(gauge.fuelGaugeError('25', '25'), '');
  assert.match(gauge.fuelGaugeError('50', '25'), /cannot be lower/);
});

function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}
for (const [path, name, end, variables] of [
  ['app/owner-app/operations/fuel/petrol-station/petrol-station-fuel-client.tsx', 'renderSlider', 'renderStep', { clampFuel: value => String(Math.max(0, Math.min(100, Number(value)))) }],
  ['app/fuel-scan/[publicFuelStorageCode]/fuel-scan-client.tsx', 'renderFuelSlider', 'renderActionChoice', { fuelPercentText: value => String(Number(value)), QUICK_FUEL_OPTIONS: [0,25,50,75,100], isSaving: false }],
]) {
  test(`${name}: blank gauge is labelled unchosen and 0% can be selected deliberately`, () => {
    const source = read(path);
    const fragment = source.slice(source.indexOf(`  function ${name}(`), source.indexOf(`  function ${end}(`));
    const module = { exports: {} };
    const jsx = (type, props) => ({ type, props });
    const code = ts.transpileModule(fragment + `\nmodule.exports = ${name};`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'module', 'exports', 'styles', ...Object.keys(variables), code)(() => ({ jsx, jsxs: jsx }), module, module.exports, {}, ...Object.values(variables));
    let chosen;
    const tree = nodes(module.exports('', value => { chosen = value; }));
    assert.ok(tree.some(node => node.type === 'strong' && node.props.children === 'Choose level'));
    const empty = tree.find(node => node.type === 'button' && node.props.children[0] === 0);
    assert.ok(empty, 'An explicit empty-tank option is available');
    empty.props.onClick();
    assert.equal(chosen, '0');
    assert.ok(nodes(module.exports(chosen, () => {})).some(node => node.type === 'strong' && node.props.children === '0%'));
  });
}


test('reading one reminder also reads the matching push event but leaves other tasks and stages unread', async () => {
  const f = notificationFixture([notice('maintenance-reminder:job:soon')], [notice('maintenance:job:2026-11-15:due_soon'), notice('maintenance:other:2026-11-15:due_soon'), notice('maintenance:job:2026-11-15:due')]);
  await f.mark(['maintenance-reminder:job:soon', 'maintenance-reminder:invisible:soon']);
  assert.deepEqual(f.marks, ['maintenance:job:2026-11-15:due_soon']);
});
