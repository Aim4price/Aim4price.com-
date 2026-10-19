const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

function load(file, mocks) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'exports', js)(name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('./')) return load(`lib/${name.slice(2)}.ts`, mocks);
    return require(name);
  }, exports);
  return exports;
}

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE assets(id text PRIMARY KEY, owner_id text, value integer, method text, revision text);
    CREATE TABLE runs(id serial PRIMARY KEY, value integer);
    CREATE TABLE history(id serial PRIMARY KEY, value integer CHECK(value >= 0));
    INSERT INTO assets VALUES('asset', 'owner', 800, 'aim4price', 'v1');
  `);
  let releases = 0;
  const transaction = { query: (sql, params) => db.query(sql, params), release: () => releases++ };
  const read = async (owner, id, client) => {
    assert.equal(client, transaction, 'the validation read must use the write transaction');
    const row = (await client.query('SELECT * FROM assets WHERE owner_id=$1 AND id=$2 FOR UPDATE', [owner, id])).rows[0];
    return row && { id: row.id, userId: row.owner_id, value: row.value, selectedMethod: row.method, updatedAtIso: row.revision };
  };
  const api = load('lib/asset-revaluation-save.ts', {
    './db': { getDb: () => ({ connect: async () => transaction }) },
    './asset-register-db': { getAssetRegisterItemById: read },
  });
  const expected = { id: 'asset', userId: 'owner', value: 800, selectedMethod: 'aim4price', updatedAtIso: 'v1' };
  const persist = async (client, failHistory = false) => {
    assert.equal(client, transaction);
    await client.query('INSERT INTO runs(value) VALUES(760)');
    await client.query("UPDATE assets SET value=760, revision='v2' WHERE id='asset'");
    await client.query('INSERT INTO history(value) VALUES($1)', [failHistory ? -1 : 760]);
    return { value: 760 };
  };
  const state = async () => ({
    asset: (await db.query('SELECT * FROM assets')).rows[0],
    runs: (await db.query('SELECT * FROM runs')).rows.length,
    history: (await db.query('SELECT * FROM history')).rows.length,
    releases,
  });
  return { db, api, expected, persist, state };
}

test('revaluation commits the run, value and history together', async () => {
  const f = await fixture();
  try {
    assert.deepEqual(await f.api.saveAssetRevaluation(f.expected, f.persist), { value: 760 });
    const state = await f.state();
    assert.equal(state.asset.value, 760);
    assert.equal(state.runs, 1);
    assert.equal(state.history, 1);
    assert.equal(state.releases, 1);
  } finally { await f.db.close(); }
});

test('history failure rolls back both the run and asset value; retry succeeds', async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.api.saveAssetRevaluation(f.expected, tx => f.persist(tx, true)), /check constraint/);
    const state = await f.state();
    assert.equal(state.asset.value, 800);
    assert.equal(state.asset.revision, 'v1');
    assert.equal(state.runs, 0);
    assert.equal(state.history, 0);
    assert.equal(state.releases, 1);
    await f.api.saveAssetRevaluation(f.expected, f.persist);
    assert.equal((await f.state()).history, 1);
  } finally { await f.db.close(); }
});

test('a second result from the same revision cannot write a duplicate run', async () => {
  const f = await fixture();
  try {
    await f.api.saveAssetRevaluation(f.expected, f.persist);
    await assert.rejects(f.api.saveAssetRevaluation(f.expected, f.persist), /asset changed/);
    const state = await f.state();
    assert.equal(state.runs, 1);
    assert.equal(state.history, 1);
    assert.equal(state.releases, 2);
  } finally { await f.db.close(); }
});

test('missing, foreign, manual and revisionless assets cannot enter persistence', async () => {
  const f = await fixture();
  try {
    const neverWrite = async () => assert.fail('must reject before any write');
    await assert.rejects(f.api.saveAssetRevaluation({ ...f.expected, userId: 'other' }, neverWrite), /ASSET_NOT_FOUND/);
    await assert.rejects(f.api.saveAssetRevaluation({ ...f.expected, updatedAtIso: '' }, neverWrite), /asset changed/);
    await f.db.query("UPDATE assets SET method='manual' WHERE id='asset'");
    await assert.rejects(f.api.saveAssetRevaluation(f.expected, neverWrite), /ASSET_NOT_REVALUEABLE/);
    assert.equal((await f.state()).runs, 0);
  } finally { await f.db.close(); }
});

test('transactional timeline capture propagates history errors instead of swallowing them', async () => {
  const sentinel = new Error('history storage unavailable');
  let calls = 0;
  const transaction = { query: async () => { calls++; throw sentinel; } };
  const api = load('lib/asset-depreciation-timeline.ts', {
    './db': { getDb: () => { throw new Error('must use transaction'); } },
    './depreciation-umbrella-summary': {},
    './report-chronology': {},
  });
  const previousAsset = { id: 'asset', userId: 'owner', value: 800, valuationRunId: 1 };
  await assert.rejects(api.captureAssetDepreciationLogEntry({
    transaction, previousAsset, asset: { ...previousAsset, value: 760, valuationRunId: 2 },
    eventType: 'automatic_revaluation_saved',
  }), error => error === sentinel);
  assert.equal(calls, 1);
});
