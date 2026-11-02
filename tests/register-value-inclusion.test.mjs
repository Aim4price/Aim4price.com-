import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

async function loadModule(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', output)(module, module.exports, name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  });
  return module.exports;
}
const helpers = await loadModule('../lib/asset-groups-shared.ts');
const a = '00000000-0000-0000-0000-000000000001';
const b = '00000000-0000-0000-0000-000000000002';
const registerId = '00000000-0000-0000-0000-000000000010';
const group = { id: 'umbrella', valueMode: 'separate', members: [
  { assetId: a, role: 'member', countsTowardTotal: true, sortOrder: 0 },
  { assetId: b, role: 'member', countsTowardTotal: false, sortOrder: 1 },
] };

test('asset exclusions override umbrellas without changing stored values or asset counts', () => {
  const assets = [{ id: a, value: 100, specsJson: { includeInRegisterTotal: false } }, { id: b, value: 200 }];
  assert.equal(helpers.registerValueForAssets(assets, [group]), 0);
  assert.equal(helpers.groupRegisterValue(group, assets), 0);
  assert.equal(helpers.registerValueForDecoratedAssets(helpers.decorateAssetsWithGroups(assets, [group])), 0);
  assert.deepEqual(assets.map(x => x.value), [100, 200]);
  assert.equal(assets.length, 2);
  assert.equal(helpers.registerValueForAssets(assets, []), 200);
});

test('combined register exclusion is scoped and missing flags preserve existing totals', () => {
  const own = [{ id: a, value: 100 }, { id: b, value: 200 }];
  assert.equal(helpers.registerValueForAssets(own, []), 300);
  const combined = own.map(x => ({ ...x, registerIncludedInCombinedTotals: false }));
  assert.equal(helpers.registerValueForAssets(combined, []), 0);
  assert.equal(helpers.registerValueForDecoratedAssets(helpers.decorateAssetsWithGroups(combined, [])), 0);
  assert.equal(helpers.registerValueForAssets(own, []), 300);
});

test('replacement and current values obey identical eligibility including primary assets', () => {
  const primary = { ...group, valueMode: 'included_in_primary', members: group.members.map((m, i) => ({ ...m, role: i ? 'linked' : 'primary' })) };
  const assets = [{ id: a, value: 100, replacementPriceExVat: 500 }, { id: b, value: 200, replacementPriceExVat: 600 }];
  assert.equal(helpers.registerValueForAssets(assets, [primary]), 100);
  assert.equal(helpers.registerValueForAssets(assets.map(x => ({ ...x, value: x.replacementPriceExVat })), [primary]), 500);
  assets[0].specsJson = { includeInRegisterTotal: false };
  assert.equal(helpers.registerValueForAssets(assets, [primary]), 0);
});

test('zero-total umbrellas save, reload and retain independent assets in PostgreSQL', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE asset_registers(id uuid primary key, user_id text);
      CREATE TABLE asset_register_items(id uuid primary key, user_id text, register_id uuid, value numeric, specs_json jsonb default '{}');
      CREATE TABLE asset_groups(id uuid primary key default gen_random_uuid(), user_id text, register_id uuid, name text, value_mode text, is_flagged boolean default false, created_at timestamptz default now(), updated_at timestamptz default now());
      CREATE TABLE asset_group_members(group_id uuid references asset_groups on delete cascade, asset_id uuid unique references asset_register_items, role text, relationship text, counts_toward_total boolean, sort_order integer, created_at timestamptz default now());`);
    await db.query('INSERT INTO asset_registers VALUES ($1, $2)', [registerId, 'owner']);
    await db.query('INSERT INTO asset_register_items(id,user_id,register_id,value) VALUES ($1,$3,$4,100),($2,$3,$4,200)', [a,b,'owner',registerId]);
    const query = async (sql, args) => { const result = await db.query(sql, args); return { ...result, rowCount: result.affectedRows ?? result.rows.length }; };
    const adapter = { query, connect: async () => ({ query, release() {} }) };
    const groups = await loadModule('../lib/asset-groups.ts', {
      './db': { getDb: () => adapter },
      './asset-groups-shared': helpers,
      './asset-registers': { ensureAssetRegisterTables: async () => {}, getAssetRegisterForUser: async (user, id) => (await db.query('SELECT * FROM asset_registers WHERE user_id=$1 AND id=$2', [user,id])).rows[0] },
      './asset-register-db': { getAssetRegisterItemsByRefs: async refs => (await db.query('SELECT id, register_id AS "registerId" FROM asset_register_items WHERE user_id=$1 AND id=ANY($2::uuid[])', [refs[0].userId,refs.map(x=>x.assetId)])).rows },
    });
    const input = { registerId, name: 'Zero total test', valueMode: 'separate', primaryAssetId: null, memberIds: [a,b], countsTowardTotalByAssetId: { [a]: false, [b]: false } };
    const saved = await groups.saveAssetGroup('owner', input);
    const reloaded = await groups.getAssetGroupById('owner', saved.id);
    assert.equal(reloaded.members.length, 2);
    assert.ok(reloaded.members.every(m=>m.countsTowardTotal === false));
    assert.equal(helpers.groupRegisterValue(reloaded, [{id:a,value:100},{id:b,value:200}]), 0);
    await groups.saveAssetGroup('owner', { ...input, groupId: saved.id, countsTowardTotalByAssetId: { [a]:true, [b]:false } });
    assert.equal((await groups.getAssetGroupById('owner', saved.id)).members.filter(m=>m.countsTowardTotal).length, 1);
    await assert.rejects(groups.saveAssetGroup('other-owner', input), /REGISTER_NOT_FOUND/);
    assert.equal(await groups.getAssetGroupById('other-owner', saved.id), null);
    await groups.deleteAssetGroup('owner', saved.id);
    assert.equal((await db.query('SELECT * FROM asset_register_items')).rows.length, 2);
  } finally { await db.close(); }
});

test('migration is repeatable and defaults existing registers to included', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE asset_registers(id text); INSERT INTO asset_registers VALUES (\'existing\');');
    const migration = await readFile(new URL('../database/migrations/150-register-value-inclusion.sql', import.meta.url), 'utf8');
    await db.exec(migration); await db.exec(migration);
    assert.equal((await db.query('SELECT include_in_combined_totals FROM asset_registers')).rows[0].include_in_combined_totals, true);
  } finally { await db.close(); }
});

test('register create/edit persists inclusion and SQL totals match umbrella and asset exclusions', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE asset_registers(id uuid primary key default gen_random_uuid(), user_id text, business_name text, email text, phone text, address_line_1 text, logo_urls jsonb default '[]', show_logos_on_register boolean default true, include_in_combined_totals boolean default true, is_primary boolean default false, is_selected boolean default false, created_at timestamptz default now(), updated_at timestamptz default now());
      CREATE TABLE asset_register_items(id uuid primary key, user_id text, register_id uuid, value numeric, replacement_price_ex_vat numeric, lifecycle_state text default 'active', specs_json jsonb default '{}');
      CREATE TABLE asset_group_members(asset_id uuid, counts_toward_total boolean);`);
    await db.query('INSERT INTO asset_registers(id,user_id,business_name,is_primary,is_selected) VALUES ($1,\'owner\',\'Original\',true,true)',[registerId]);
    await db.query('INSERT INTO asset_register_items(id,user_id,register_id,value,replacement_price_ex_vat) VALUES ($1,\'owner\',$3,100,500),($2,\'owner\',$3,200,600)',[a,b,registerId]);
    const api = await loadModule('../lib/asset-registers.ts', {
      './db': { getDb: () => db }, './database-schema-readiness': { isDatabaseSchemaReady: async () => true }, './report-branding': { selectReportLogoUrl: () => '' },
    });
    const created = await api.createAssetRegister('owner', { businessName:'Excluded register',includeInCombinedTotals:false });
    assert.equal(created.includeInCombinedTotals, false);
    let original = await api.getAssetRegisterForUser('owner',registerId);
    assert.equal(original.totalValue,300); assert.equal(original.totalReplacementPrice,1100);
    await db.query('INSERT INTO asset_group_members VALUES ($1,false)',[b]);
    original = await api.getAssetRegisterForUser('owner',registerId);
    assert.equal(original.totalValue,100); assert.equal(original.totalReplacementPrice,500);
    await db.query(`UPDATE asset_register_items SET specs_json='{"includeInRegisterTotal":false}' WHERE id=$1`,[a]);
    original = await api.getAssetRegisterForUser('owner',registerId);
    assert.equal(original.totalValue,0); assert.equal(original.totalReplacementPrice,0); assert.equal(original.assetCount,2);
    const updated = await api.updateAssetRegister('owner',created.id,{businessName:'Renamed'});
    assert.equal(updated.includeInCombinedTotals,false, 'unrelated edits preserve the flag');
    assert.equal((await api.updateAssetRegister('owner',created.id,{businessName:'Renamed',includeInCombinedTotals:true})).includeInCombinedTotals,true);
    assert.equal(await api.getAssetRegisterForUser('other-owner',created.id).catch(()=>null),null);
  } finally { await db.close(); }
});
