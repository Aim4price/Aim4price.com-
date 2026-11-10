import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

function load(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)((name) => {
    if (!(name in dependencies)) throw new Error('Missing dependency: ' + name);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('move choices exclude deleted, empty, inactive and invalid memberships, preserving valid single-asset umbrellas', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table asset_registers (id uuid primary key, user_id text);
      create table asset_register_items (id uuid primary key, user_id text, register_id uuid, lifecycle_state text);
      create table asset_groups (id uuid primary key, user_id text, register_id uuid, name text,
        value_mode text default 'separate', is_flagged boolean default false,
        created_at timestamptz default now(), updated_at timestamptz default now());
      create table asset_group_members (group_id uuid references asset_groups on delete cascade, asset_id uuid,
        role text default 'member', relationship text default 'grouped', counts_toward_total boolean default true,
        sort_order int default 0, created_at timestamptz default now());
    `);
    await db.query('insert into asset_registers values ($1,$3),($2,$3)', [id(1), id(2), 'owner']);
    const add = async (n, state, assetOwner = 'owner', assetRegister = id(1), groupRegister = id(1)) => {
      await db.query('insert into asset_groups (id,user_id,register_id,name) values ($1,$2,$3,$4)', [id(n), 'owner', groupRegister, 'Group ' + n]);
      await db.query('insert into asset_register_items values ($1,$2,$3,$4)', [id(n + 100), assetOwner, assetRegister, state]);
      await db.query('insert into asset_group_members (group_id,asset_id) values ($1,$2)', [id(n), id(n + 100)]);
    };
    await add(10, 'active'); // valid single-member umbrella
    await add(11, 'disposed');
    await add(12, 'active', 'other-owner');
    await add(13, 'active', 'owner', id(2)); // stale membership after register move
    await add(14, 'active', 'owner', id(999)); // missing register
    await add(15, 'active', 'owner', id(2), null); // valid combined umbrella
    await add(16, 'active'); // explicitly deleted
    await add(17, 'active'); // missing asset
    await db.query('delete from asset_register_items where id=$1', [id(117)]);
    await db.query('insert into asset_groups (id,user_id,name) values ($1,$2,$3)', [id(18), 'owner', 'Empty']);
    const helpers = load('../lib/asset-groups.ts', {
      './db': { getDb: () => ({ query: db.query.bind(db), connect: async () => ({ query: db.query.bind(db), release() {} }) }) },
      './asset-register-db': { getAssetRegisterItemsByRefs: async () => [{ id:id(110), registerId:id(1) }] },
      './asset-registers': { ensureAssetRegisterTables: async () => {} },
      './asset-groups-shared': load('../lib/asset-groups-shared.ts'),
    });
    await helpers.deleteAssetGroup('owner', id(16));
    assert.deepEqual((await helpers.listAssetGroups('owner', null, true)).map(g => g.id).sort(), [id(10), id(15)]);
    // Historical memberships remain available to non-destination callers.
    assert.ok((await helpers.listAssetGroups('owner')).some(g => g.id === id(11)));
    for (const target of [11,12,13,14,16,17,18]) {
      await assert.rejects(helpers.moveAssetToGroup('owner', { assetId:id(110), targetGroupId:id(target), scope:'combined', registerId:null }), /ASSET_GROUP_NOT_FOUND/);
    }
    assert.equal((await db.query('select group_id::text from asset_group_members where asset_id=$1', [id(110)])).rows[0].group_id, id(10));
    // Dissolving the final member removes the option even if an empty row remains.
    await db.query('delete from asset_group_members where group_id=$1', [id(10)]);
    assert.deepEqual((await helpers.listAssetGroups('owner', null, true)).map(g => g.id), [id(15)]);
    await db.query('delete from asset_registers where id=$1', [id(2)]);
    assert.deepEqual(await helpers.listAssetGroups('owner', null, true), []);
  } finally { await db.close(); }
});

const client = readFileSync(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');
function loader(fetch, requestRef = { current:1 }) {
  const start = client.indexOf('  async function loadAssetRegisterMoveGroups(');
  const source = client.slice(start, client.indexOf('\n  }', start) + 4);
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const state = { groups:['stale'], registers:['deleted'], target:'deleted' };
  const deps = {
    ownerFetch:fetch, canManageAssetGroups:true, assetRegisterMoveGroupsRequestRef:requestRef,
    buildAssetGroupsApiUrl:() => '/api/asset-groups?scope=combined',
    setIsLoadingAssetRegisterMoveGroups:v => state.loading=v,
    setAssetRegisterMoveGroupLoadError:v => state.error=v,
    setAssetRegisterMoveTargetId:v => state.target=v,
    setAssetRegisterMoveGroups:v => state.groups=v,
    setAssetRegisterMoveRegisters:v => state.registers=v,
  };
  return { state, run:new Function(...Object.keys(deps), output + '; return loadAssetRegisterMoveGroups;')(...Object.values(deps)) };
}
test('opening/retrying refreshes both lists without cache and clears stale selection', async () => {
  const calls = [];
  const { state, run } = loader(async (url, options) => {
    calls.push([url, options.cache]);
    return Response.json(url.includes('asset-groups') ? { ok:true, groups:[{id:'live-group'}] } : { ok:true, registers:[{id:'live-register'}] });
  });
  await run(1);
  assert.deepEqual(calls, [['/api/asset-registers','no-store'], ['/api/asset-groups?scope=combined&destinations=1','no-store']]);
  assert.deepEqual(state, { groups:[{id:'live-group'}], registers:[{id:'live-register'}], target:'', loading:false, error:'' });
});
test('load failures cannot expose old destinations and closed-dialog responses are ignored', async () => {
  const failed = loader(async () => Response.json({ ok:false, error:'Unavailable' }, {status:503}));
  await failed.run(1);
  assert.deepEqual(failed.state.groups, []);
  assert.deepEqual(failed.state.registers, []);
  assert.equal(failed.state.error, 'Unavailable');
  const closed = loader(async () => Response.json({ok:true, groups:[{id:'old'}], registers:[{id:'old'}]}), {current:2});
  await closed.run(1);
  assert.deepEqual(closed.state.groups, []);
  assert.deepEqual(closed.state.registers, []);
});
