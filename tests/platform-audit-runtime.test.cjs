const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'exports', code)(name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('.')) return load('lib/' + name.slice(2) + '.ts', mocks);
    return require(name);
  }, exports);
  return exports;
}
function fuelFixture() {
  let connections = 0, releases = 0;
  const statements = [];
  const client = { query: async sql => { statements.push(sql); if (sql.includes('insert into public.fuel_storage_units')) throw Error('Database write failed'); return { rows: [], rowCount: 0 }; }, release: () => { releases++; } };
  const ledger = load('lib/fuel-ledger.ts', {
    './db': { getDb: () => ({ query: async () => ({ rows: [], rowCount: 0 }), connect: async () => { connections++; return client; } }) },
    './account-profile': { ensureAccountProfileColumns: async () => {} },
    './scan-pin': { hashScanPin: async pin => { if (pin === 'bad') throw Error('Invalid PIN'); return 'hash'; } },
    './asset-register-uploads': { buildAssetRegisterUploadUrl: id => id ? '/api/asset-register/uploads/' + id : '' },
    './field-manager-session': {}, './field-manager': {}, './owner-app-access': {},
  });
  return { ledger, statements, counts: () => ({ connections, releases }) };
}
test('invalid tank, PIN, fuel issue and slip input never reserve pooled connections', async () => {
  const { ledger, counts } = fuelFixture();
  await assert.rejects(ledger.createFuelStorage('owner', { name: '' }), /Name/);
  await assert.rejects(ledger.createFuelStorage('owner', { name: 'Diesel', pin: 'bad' }), /PIN/);
  await assert.rejects(ledger.recordFuelAssetIssue({ userId: 'owner', storageId: 'tank', assetId: 'asset', litres: 0 }), /litres/i);
  await assert.rejects(ledger.recordFuelAssetIssue({ userId: 'owner', storageId: 'tank', assetId: 'asset', litres: 10 }), /percentage/);
  await assert.rejects(ledger.saveFuelSlipTransaction('owner', { targetType: 'asset' }), /Choose the asset/);
  await assert.rejects(ledger.saveFuelSlipTransaction('owner', { mode: 'automatic', targetType: 'asset', assetId: 'asset' }), /Upload/);
  assert.deepEqual(counts(), { connections: 0, releases: 0 });
});
test('tank creation rejects over-capacity opening stock before reserving a connection', async () => {
  const { ledger, counts } = fuelFixture();
  await assert.rejects(ledger.createFuelStorage('owner', { name: 'Diesel', currentLitres: 101, capacityLitres: 100 }), /cannot exceed/);
  assert.equal(counts().connections, 0);
});
test('valid tank creation still rolls back and releases on database failure', async () => {
  const { ledger, counts, statements } = fuelFixture();
  await assert.rejects(ledger.createFuelStorage('owner', { name: 'Diesel', currentLitres: 100, capacityLitres: 100 }), /Database write failed/);
  assert.deepEqual(counts(), { connections: 1, releases: 1 });
  assert.ok(statements.includes('ROLLBACK'));
});
test('offline queue reports blocked storage rather than returning a false saved result', async () => {
  const previous = global.window;
  global.window = { localStorage: { getItem: () => null, setItem: () => { throw Error('Quota exceeded'); } } };
  try {
    const queue = load('lib/offline-mutation-queue.ts');
    await assert.rejects(queue.enqueueOfflineMutation({ id: 'event', kind: 'asset-scan-update', endpoint: '/api/scan/asset', payload: {} }), /has not been saved/);
  } finally { global.window = previous; }
});
test('offline fallback retains failed requests and increments retries before successful removal', async () => {
  const previous = { window: global.window, fetch: global.fetch };
  const storage = new Map();
  global.window = { localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) } };
  try {
    const queue = load('lib/offline-mutation-queue.ts');
    await queue.enqueueOfflineMutation({ id: 'event', kind: 'asset-scan-update', endpoint: '/api/scan/asset', payload: { note: 'Oil changed' } });
    global.fetch = async () => new Response(JSON.stringify({ error: 'Try later' }), { status: 503 });
    await queue.syncOfflineMutations();
    await queue.syncOfflineMutations();
    const saved = JSON.parse([...storage.values()][0]);
    assert.equal(saved[0].attemptCount, 2);
    assert.equal(saved[0].payload.note, 'Oil changed');
    global.fetch = async () => new Response('{}');
    assert.deepEqual(await queue.syncOfflineMutations(), { syncedCount: 1, droppedCount: 0, pendingCount: 0 });
  } finally { global.window = previous.window; global.fetch = previous.fetch; }
});
