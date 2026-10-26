const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
class LegacyValuationRecoveryError extends Error {}
const { randomUUID } = require('node:crypto');
function load(file, mocks = {}) {
  const exports = {};
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => name in mocks ? mocks[name] : require(name), exports);
  return exports;
}
const { AUTOMATIC_VALUATION_SCHEMA } = load('lib/automatic-valuation-schema.ts', { './db': {} });
async function setup() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE asset_register_items (
    id uuid PRIMARY KEY, user_id text, selected_method text, hours numeric, year_model integer,
    condition text, replacement_price_used_ex_vat numeric, value numeric,
    specs_json jsonb NOT NULL DEFAULT '{}', updated_at timestamptz DEFAULT now(), note text
  ); CREATE TABLE history(value numeric CHECK(value>=0));`);
  await db.exec(AUTOMATIC_VALUATION_SCHEMA);
  const id = randomUUID();
  await db.query("INSERT INTO asset_register_items(id,user_id,selected_method,hours,year_model,condition,replacement_price_used_ex_vat,value) VALUES($1,'owner','aim4price',1000,2023,'good',1000000,800000)", [id]);
  const query = (sql, args) => db.query(sql, args);
  const tx = { query, release() {} };
  const pool = { query, connect: async () => tx };
  const asset = async () => (await db.query('SELECT * FROM asset_register_items WHERE id=$1', [id])).rows[0];
  const jobs = async () => (await db.query('SELECT * FROM asset_valuation_jobs')).rows;
  const change = (hours = 1100) => db.query("UPDATE asset_register_items SET hours=$2,updated_at=clock_timestamp() WHERE id=$1", [id, hours]);
  const save = load('lib/asset-revaluation-save.ts', {
    './db': { getDb: () => pool },
    './asset-register-db': { getAssetRegisterItemById: async (owner, assetId, client) => {
      const row = (await client.query('SELECT * FROM asset_register_items WHERE id=$1 AND user_id=$2 FOR UPDATE', [assetId, owner])).rows[0];
      return row && { id: row.id, userId: row.user_id, selectedMethod: row.selected_method, updatedAtIso: row.updated_at.toISOString() };
    } },
  });
  const calculate = async (failHistory = false) => {
    const a = await asset();
    return save.saveAssetRevaluation({ id, userId: 'owner', updatedAtIso: a.updated_at.toISOString() }, async client => {
      await client.query('UPDATE asset_register_items SET value=760000,updated_at=clock_timestamp() WHERE id=$1', [id]);
      await client.query('INSERT INTO history VALUES($1)', [failHistory ? -1 : 760000]);
    });
  };
  const worker = fn => load('lib/automatic-valuation-worker.ts', {
    './asset-register-valuation-recovery': { LegacyValuationRecoveryError },
    './db': { getDb: () => pool }, './automatic-valuation-schema': { ensureAutomaticValuationSchema: async () => {} },
    './asset-register-revaluation': { revalueAssetRegisterItem: fn || (() => calculate()) },
  });
  return { db, id, asset, jobs, change, worker, calculate, pool };
}

test('current input changes coalesce; unchanged inputs and unrelated edits do not queue', async () => {
  const f = await setup();
  try {
    await f.db.query("UPDATE asset_register_items SET note='Added document' WHERE id=$1", [f.id]);
    await f.change(1000); assert.equal((await f.jobs()).length, 0);
    await f.change(); assert.equal((await f.jobs()).length, 1);
    assert.equal((await f.asset()).specs_json.automaticValuationStatus, 'pending');
    await f.change(1200); assert.equal((await f.jobs()).length, 1);
    assert.equal(Number((await f.jobs())[0].generation), 2);
    await f.change(1200); assert.equal(Number((await f.jobs())[0].generation), 2);
    await f.db.query('UPDATE asset_register_items SET replacement_price_used_ex_vat=1200000 WHERE id=$1', [f.id]);
    assert.equal(Number((await f.jobs())[0].generation), 3);
    await f.db.query("UPDATE asset_register_items SET specs_json=specs_json || '{\"life_worked_percent\":40}' WHERE id=$1", [f.id]);
    assert.equal(Number((await f.jobs())[0].generation), 4);
  } finally { await f.db.close(); }
});

test('input and job roll back together; manual values never queue', async () => {
  const f = await setup();
  try {
    await f.db.exec('BEGIN'); await f.change(); await f.db.exec('ROLLBACK');
    assert.equal((await f.jobs()).length, 0); assert.equal(Number((await f.asset()).hours), 1000);
    await f.db.query("UPDATE asset_register_items SET selected_method='manual',hours=2000 WHERE id=$1", [f.id]);
    assert.equal((await f.jobs()).length, 0); assert.equal(Number((await f.asset()).value), 800000);
  } finally { await f.db.close(); }
});

test('worker commits value and history once, clearing job and pending status atomically', async () => {
  const f = await setup();
  try {
    await f.change(); const worker = f.worker();
    assert.equal((await worker.processAutomaticValuations()).processed, 1);
    assert.equal((await worker.processAutomaticValuations()).processed, 0);
    assert.equal((await f.jobs()).length, 0);
    assert.equal((await f.asset()).specs_json.valuationNeedsUpdate, false);
    assert.equal((await f.asset()).specs_json.automaticValuationStatus, 'current');
    assert.equal((await f.db.query('SELECT * FROM history')).rows.length, 1);
  } finally { await f.db.close(); }
});

test('failure keeps inputs and previous value, retries durably, and then succeeds', async () => {
  const f = await setup();
  try {
    await f.change();
    await f.worker(() => f.calculate(true)).processAutomaticValuations();
    assert.equal(Number((await f.asset()).hours), 1100);
    assert.equal(Number((await f.asset()).value), 800000);
    assert.equal((await f.asset()).specs_json.automaticValuationStatus, 'retrying');
    assert.equal((await f.jobs())[0].attempts, 1);
    assert.equal((await f.db.query('SELECT * FROM history')).rows.length, 0);
    assert.equal((await f.worker().processAutomaticValuations()).processed, 0);
    await f.db.exec("UPDATE asset_valuation_jobs SET next_attempt_at=now()-interval '1 minute'");
    await f.worker().processAutomaticValuations();
    assert.equal(Number((await f.asset()).value), 760000);
    assert.equal((await f.jobs()).length, 0);
  } finally { await f.db.close(); }
});

test('newer input wins over failure from an old claim', async () => {
  const f = await setup();
  try {
    await f.change();
    await f.worker(async () => { await f.change(1300); throw Error('old request failed'); }).processAutomaticValuations(1);
    const job = (await f.jobs())[0];
    assert.equal(job.attempts, 0); assert.equal(job.last_error, null);
    assert.equal((await f.asset()).specs_json.automaticValuationStatus, 'pending');
    assert.equal(Number((await f.asset()).hours), 1300);
  } finally { await f.db.close(); }
});

test('leases prevent duplicate claims, recover after restart, and expose exhausted crashes', async () => {
  const f = await setup();
  try {
    await f.change();
    const { CLAIM_VALUATION_JOB } = f.worker();
    assert.equal((await f.db.query(CLAIM_VALUATION_JOB)).rows.length, 1);
    assert.equal((await f.db.query(CLAIM_VALUATION_JOB)).rows.length, 0);
    await f.db.exec("UPDATE asset_valuation_jobs SET lease_until=now()-interval '1 minute'");
    assert.equal((await f.db.query(CLAIM_VALUATION_JOB)).rows[0].attempts, 2);
    await f.db.exec("UPDATE asset_valuation_jobs SET attempts=5,lease_until=now()-interval '1 minute'");
    await f.worker().processAutomaticValuations();
    assert.equal((await f.asset()).specs_json.automaticValuationStatus, 'failed');
    assert.equal((await f.jobs())[0].claim_id, null);
    await f.change(1400); assert.equal((await f.jobs())[0].attempts, 0);
  } finally { await f.db.close(); }
});

test('explicit owner-approved value cancels pending work; future usage queues again', async () => {
  const f = await setup();
  try {
    await f.change();
    await f.db.exec("BEGIN; SELECT set_config('aim4price.valuation_write','resolved',true)");
    await f.db.query('UPDATE asset_register_items SET replacement_price_used_ex_vat=1500000 WHERE id=$1', [f.id]);
    await f.db.exec('COMMIT');
    assert.equal((await f.jobs()).length, 0); assert.equal(Number((await f.asset()).value), 800000);
    await f.change(1400); assert.equal((await f.jobs()).length, 1);
  } finally { await f.db.close(); }
});

test('deployment backfill resumes stale calculated assets without resetting retry counts', async () => {
  const f = await setup();
  try {
    await f.db.exec("ALTER TABLE asset_register_items DISABLE TRIGGER queue_asset_valuation");
    await f.db.query("UPDATE asset_register_items SET specs_json='{\"valuationNeedsUpdate\":true}' WHERE id=$1", [f.id]);
    await f.db.exec("ALTER TABLE asset_register_items ENABLE TRIGGER queue_asset_valuation");
    await f.db.exec(AUTOMATIC_VALUATION_SCHEMA);
    assert.equal((await f.jobs()).length, 1);
    await f.db.exec('UPDATE asset_valuation_jobs SET attempts=4');
    await f.db.exec(AUTOMATIC_VALUATION_SCHEMA);
    assert.equal((await f.jobs())[0].attempts, 4);
  } finally { await f.db.close(); }
});

test('stale drafts cannot reapply pending status; ownership transfer re-scopes queued work', async () => {
  const f = await setup();
  try {
    await f.change(); await f.worker().processAutomaticValuations();
    await f.db.query("UPDATE asset_register_items SET note='new note',specs_json=specs_json || '{\"valuationNeedsUpdate\":true,\"automaticValuationStatus\":\"pending\"}' WHERE id=$1", [f.id]);
    assert.equal((await f.asset()).specs_json.valuationNeedsUpdate, false);
    assert.equal((await f.asset()).specs_json.automaticValuationStatus, 'current');
    assert.equal((await f.jobs()).length, 0);
    await f.change(1400);
    await f.db.query("UPDATE asset_register_items SET user_id='new-owner' WHERE id=$1", [f.id]);
    assert.equal((await f.jobs())[0].owner_id, 'new-owner');
    assert.equal((await f.jobs())[0].claim_id, null);
  } finally { await f.db.close(); }
});

test('missing details stop automatic retries and correcting a brand queues a fresh attempt', async () => {
  const f = await setup();
  try {
    await f.change();
    await f.worker(async () => { throw new LegacyValuationRecoveryError('Add the brand name'); }).processAutomaticValuations();
    assert.equal((await f.asset()).specs_json.automaticValuationStatus, 'needs_details');
    assert.equal(Number((await f.asset()).value), 800000);
    assert.equal((await f.jobs())[0].attempts, 5);
    await f.db.exec("UPDATE asset_valuation_jobs SET next_attempt_at=now()-interval '1 minute'");
    assert.equal((await f.worker().processAutomaticValuations()).processed, 0);
    await f.db.query("UPDATE asset_register_items SET specs_json=specs_json || '{\"brandName\":\"Malcomess\"}' WHERE id=$1", [f.id]);
    assert.equal((await f.jobs())[0].attempts, 0);
    assert.equal((await f.asset()).specs_json.automaticValuationStatus, 'pending');
    await f.worker().processAutomaticValuations();
    assert.equal((await f.asset()).specs_json.automaticValuationStatus, 'current');
  } finally { await f.db.close(); }
});
