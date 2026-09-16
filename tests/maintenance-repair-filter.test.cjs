const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks = {}, extra = '') {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8') + extra;
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)((name) => mocks[name] ?? {}, exports);
  return exports;
}
const record = (overrides = {}) => ({ status: 'done', maintenanceType: 'service', title: 'Service', completedNotes: '', notes: '', ...overrides });
const lib = load('lib/asset-maintenance.ts', {}, '\nexports.mergeHistory = mergeCompletedScanHistory;');

test('repair classification recognises saved notes and legacy titles, without treating services or checks as repairs', () => {
  for (const row of [record({ completedNotes: 'Repaired\nHydraulic hose replaced.' }), record({ notes: 'Repair details: pump replaced' }), record({ title: 'Repair' })]) {
    assert.equal(lib.assetMaintenanceRecordProcedureKind(row), 'repaired');
  }
  assert.equal(lib.assetMaintenanceRecordProcedureKind(record({ completedNotes: 'Serviced\nOil changed', title: 'Repair' })), 'serviced');
  assert.equal(lib.assetMaintenanceRecordProcedureKind(record({ maintenanceType: 'checkup', title: 'Checkup' })), 'checked');
  assert.equal(lib.assetMaintenanceRecordProcedureKind(record({ status: 'upcoming', title: 'Repair' })), null);
});

test('repair list retains account, asset, status and assignment SQL filters and only returns repair records', async () => {
  let query;
  const base = { user_id: 'owner', asset_register_item_id: 'asset', maintenance_type: 'service', status: 'done', usage_metric: 'hours', created_at: '2026-09-01', updated_at: '2026-09-01' };
  const api = load('lib/asset-maintenance.ts', {
    './database-schema-readiness': { isDatabaseSchemaReady: async () => true },
    './db': { getDb: () => ({ query: async (sql, values) => { query = { sql, values }; return { rows: [{ ...base, id: 'repair', title: 'Repair' }, { ...base, id: 'service', title: 'Service' }] }; } }) },
    './maintenance-catalogue': { maintenanceIdentity: () => ({}) },
    './asset-usage': { resolveAssetUsage: () => ({ metric: 'hours', value: 0 }) },
  });
  const rows = await api.listAssetMaintenanceRecords('owner', { assetId: 'asset', type: 'repair', status: 'done', assignedTo: 'manager' });
  assert.deepEqual(rows.map(r => r.id), ['repair']);
  assert.deepEqual(query.values, ['owner', 'asset', 'service', 'done', 'manager']);
  assert.match(query.sql, /m.user_id = \$1/);
});

test('historical scan repair filter excludes other work and respects selected assets', () => {
  const asset = { id: 'asset', title: 'Tractor' };
  const events = ['checked', 'serviced', 'repaired'].map((kind) => ({ id: kind, kind, assetRegisterItemId: 'asset', createdAtIso: '2026-09-01', note: kind }));
  const rows = lib.mergeHistory('owner', [asset], [], events, { type: 'repair' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Repair');
  assert.equal(lib.mergeHistory('owner', [asset], [], events, { type: 'repair', assetId: 'another' }).length, 0);
  assert.equal(lib.mergeHistory('owner', [asset], [], events, { type: 'repair', status: 'upcoming' }).length, 0);
});

test('list, report and completion endpoints accept the repair filter', () => {
  for (const file of ['app/api/maintenance/route.ts', 'app/api/maintenance/report/route.ts', 'app/api/maintenance/[maintenanceId]/complete/route.ts']) {
    const api = load(file, {}, '\nexports.parseFilterType = parseType;');
    assert.equal(api.parseFilterType('repair'), 'repair');
    assert.equal(api.parseFilterType('service'), 'service');
    assert.equal(api.parseFilterType('checkup'), 'checkup');
    assert.equal(api.parseFilterType('invalid'), null);
  }
});
