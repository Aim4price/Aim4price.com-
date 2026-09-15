import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const source = readFileSync(new URL('../lib/asset-registers.ts', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('async function setSinglePrimaryRegister('), source.indexOf('async function insertAssetRegister('));
const javascript = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

test('register selection reads avoid writes and repair only inconsistent state', async (t) => {
  const db = new PGlite();
  await db.exec(`create table asset_registers (
    id text primary key, user_id text, is_primary boolean, is_selected boolean,
    created_at timestamptz, updated_at timestamptz
  );
  insert into asset_registers values
    ('primary', 'owner', true, false, '2025-01-01', '2025-01-01'),
    ('selected', 'owner', false, true, '2025-02-01', '2025-02-01'),
    ('other', 'other-owner', true, true, '2025-01-01', '2025-01-01');`);
  let writes = 0;
  let affectedRows = 0;
  const trackedDb = { query: async (sql, params) => {
    const result = await db.query(sql, params);
    if (/^\s*update/i.test(sql)) { writes++; affectedRows += result.affectedRows; }
    return result;
  } };
  const helpers = new Function('getDb', 'cleanText', `${javascript}; return { normalizeSelectedRegister, setSingleSelectedRegister, setSinglePrimaryRegister };`)(() => trackedDb, value => String(value ?? '').trim());
  try {
    await t.test('parallel combined and overview reads preserve selection and timestamps without updates', async () => {
      const before = await db.query('select * from asset_registers order by id');
      const results = await Promise.all(Array.from({ length: 24 }, () => helpers.normalizeSelectedRegister('owner', 'primary')));
      assert.ok(results.every(id => id === 'selected'));
      assert.equal(writes, 0);
      assert.deepEqual((await db.query('select * from asset_registers order by id')).rows, before.rows);
    });
    await t.test('setting an already correct selection or primary changes no rows', async () => {
      await helpers.setSingleSelectedRegister('owner', 'selected');
      await helpers.setSinglePrimaryRegister('owner', 'primary');
      assert.equal(affectedRows, 0);
    });
    await t.test('missing selection falls back to primary without touching another owner', async () => {
      await db.query("update asset_registers set is_selected = false where user_id = 'owner'");
      assert.equal(await helpers.normalizeSelectedRegister('owner', 'primary'), 'primary');
      assert.deepEqual((await db.query('select id from asset_registers where is_selected order by id')).rows, [{ id: 'other' }, { id: 'primary' }]);
    });
    await t.test('duplicate selections retain the most recent and repair the extra selected flag', async () => {
      await db.query("update asset_registers set is_selected = true, updated_at = '2030-01-01' where id = 'selected'");
      assert.equal(await helpers.normalizeSelectedRegister('owner', 'primary'), 'selected');
      assert.deepEqual((await db.query("select id from asset_registers where user_id = 'owner' and is_selected")).rows, [{ id: 'selected' }]);
    });
  } finally { await db.close(); }
});
