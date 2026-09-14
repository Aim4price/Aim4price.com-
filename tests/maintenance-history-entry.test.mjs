import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function route(session = { user: { id: 'owner-1' } }) {
  const calls = [];
  const exports = {};
  const source = readFileSync(new URL('../app/api/maintenance/route.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', code)((name) => {
    if (name.endsWith('/auth-session')) return { getServerSession: async () => session };
    if (name.endsWith('/asset-maintenance')) return {
      recordStandaloneAssetMaintenanceCompletion: async (owner, input) => { calls.push({ kind: 'history', owner, input }); return { id: 'saved', status: 'done' }; },
      createAssetMaintenanceRecord: async (owner, input) => { calls.push({ kind: 'schedule', owner, input }); return { id: 'scheduled' }; },
      listAssetMaintenanceData: async () => ({ records: [], assets: [] }),
    };
    return require(name);
  }, exports);
  return { ...exports, calls };
}
const completed = { status: 'done', assetId: 'asset-1', maintenanceType: 'service', completedAt: '2025-04-10', completedUsage: 2100, completedNotes: 'Service: Hydraulic hose\nCompany: Own workshop\nMechanic: John', completedBy: 'John', clientEventId: '11111111-1111-4111-8111-111111111111' };
const request = (body) => new Request('http://localhost/api/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('past work goes directly to owner-scoped history with its original date, usage and retry key', async () => {
  const api = route();
  assert.equal((await api.POST(request({ ...completed, userId: 'another-owner', sourceScanEventId: 'untrusted' }))).status, 200);
  assert.equal(api.calls.length, 1);
  const saved = api.calls[0];
  assert.equal(saved.kind, 'history');
  assert.equal(saved.owner, 'owner-1');
  assert.equal(saved.input.completedAt, completed.completedAt);
  assert.equal(saved.input.completedUsage, 2100);
  assert.equal(saved.input.sourceScanEventId, completed.clientEventId);
  assert.equal(saved.input.userId, undefined);
});

test('past work accepts unknown usage without creating an upcoming schedule', async () => {
  const api = route();
  assert.equal((await api.POST(request({ ...completed, completedUsage: null }))).status, 200);
  assert.equal(api.calls[0].kind, 'history');
  assert.equal(api.calls[0].input.completedUsage, null);
});

test('future dates, missing dates and invalid usage are rejected before writes', async () => {
  const api = route();
  for (const update of [{ completedAt: '2999-01-01' }, { completedAt: '' }, { completedAt: 'invalid' }, { completedUsage: -1 }, { completedUsage: 'bad' }]) {
    assert.equal((await api.POST(request({ ...completed, ...update }))).status, 400);
  }
  assert.equal(api.calls.length, 0);
});

test('sign-in is required for manual history', async () => {
  const api = route(null);
  assert.equal((await api.POST(request(completed))).status, 401);
  assert.equal(api.calls.length, 0);
});

test('upcoming scheduling continues to use the existing creation path', async () => {
  const api = route();
  assert.equal((await api.POST(request({ assetId: 'asset-1', maintenanceType: 'service', dueDate: '2026-12-01' }))).status, 200);
  assert.equal(api.calls[0].kind, 'schedule');
});
