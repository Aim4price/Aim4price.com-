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
    if (!(name in dependencies)) throw new Error(`Missing test dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const shared = load('../lib/asset-groups-shared.ts');
const groupId = '00000000-0000-4000-8000-000000000001';
const registerId = '00000000-0000-4000-8000-000000000002';
const otherRegisterId = '00000000-0000-4000-8000-000000000003';

test('umbrella flags persist independently and enforce owner/register scope', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table asset_groups (id uuid primary key, user_id text, register_id uuid, is_flagged boolean default false, updated_at timestamptz);
      create table asset_register_items (id text, is_flagged boolean);
      insert into asset_register_items values ('member', false);`);
    await db.query('insert into asset_groups (id,user_id,register_id) values ($1,$2,$3)', [groupId,'owner',registerId]);
    const helpers = load('../lib/asset-groups.ts', {
      './db': { getDb: () => db },
      './asset-register-db': {},
      './asset-registers': { ensureAssetRegisterTables: async () => {} },
      './asset-groups-shared': shared,
    });
    await helpers.setAssetGroupFlag('owner', groupId, true, registerId);
    assert.equal((await db.query('select is_flagged from asset_groups')).rows[0].is_flagged, true);
    assert.equal((await db.query('select is_flagged from asset_register_items')).rows[0].is_flagged, false);
    await assert.rejects(helpers.setAssetGroupFlag('other-owner', groupId, false, null), /ASSET_GROUP_NOT_FOUND/);
    await assert.rejects(helpers.setAssetGroupFlag('owner', groupId, false, otherRegisterId), /ASSET_GROUP_NOT_FOUND/);
    assert.equal((await db.query('select is_flagged from asset_groups')).rows[0].is_flagged, true);
    await helpers.setAssetGroupFlag('owner', groupId, false, registerId);
    assert.equal((await db.query('select is_flagged from asset_groups')).rows[0].is_flagged, false);
    await db.query('update asset_groups set register_id = null');
    await assert.rejects(helpers.setAssetGroupFlag('owner', groupId, true, registerId), /ASSET_GROUP_NOT_FOUND/);
    await helpers.setAssetGroupFlag('owner', groupId, true, null);
    assert.equal((await db.query('select is_flagged from asset_groups')).rows[0].is_flagged, true);
  } finally { await db.close(); }
});

test('flagged umbrellas sort ahead of alphabetical groups without changing members', () => {
  const groups = ['Alpha', 'Zulu'].map((name, i) => ({ id:name, name, isFlagged:i === 1, members:[{ assetId:name, role:'member', sortOrder:0 }] }));
  const assets = [{ id:'Alpha' }, { id:'Zulu' }, { id:'standalone' }];
  const ordered = shared.orderAssetsByGroups(assets, groups);
  assert.deepEqual(ordered.map(a => a.id), ['Zulu', 'Alpha', 'standalone']);
  groups[1].isFlagged = false;
  assert.deepEqual(shared.orderAssetsByGroups(assets, groups).map(a => a.id), ['Alpha', 'Zulu', 'standalone']);
});

function route(context) {
  const calls = [];
  const module = load('../app/api/asset-groups/route.ts', {
    'next/server': { NextResponse: { json:(body, init) => Response.json(body, init) } },
    '../../../lib/account-profile': { getAccountProfile:async () => ({ accountType:'owner' }) },
    '../../../lib/asset-register-account-access': { isAssetRegisterAccountType:() => true },
    '../../../lib/asset-groups': { setAssetGroupFlag:async (...args) => calls.push(args), listAssetGroups:async () => [] },
    '../../../lib/asset-register-db': { listAssetRegisterItems:async () => [] },
    '../../../lib/asset-groups-shared': shared,
    '../../../lib/asset-registers': { getAssetRegisterForUser:async (_owner,id) => ({ id }) },
    '../../../lib/owner-workspace-access': { resolveOwnerWorkspaceContext:async () => ({ ok:true, context }) },
  });
  return { ...module, calls };
}
function request(body, scope = '') {
  return { json:async () => body, nextUrl:new URL(`https://example.test/api/asset-groups${scope}`) };
}
const ownerContext = { ownerUserId:'owner', accountantRegisterId:'', accountantAccess:null };
test('flag API requires a boolean and uses the authenticated owner', async () => {
  const api = route(ownerContext);
  assert.equal((await api.PATCH(request({ groupId, registerId, isFlagged:'true' }))).status, 400);
  assert.equal(api.calls.length, 0);
  assert.equal((await api.PATCH(request({ groupId, registerId, isFlagged:true, userId:'someone-else' }))).status, 200);
  assert.deepEqual(api.calls, [['owner', groupId, true, registerId]]);
});
test('read-only and cross-register accountant flag requests cannot mutate umbrellas', async () => {
  for (const [allowDirectUpdates, body, scope] of [
    [false, { groupId, registerId, isFlagged:true }, ''],
    [true, { groupId, registerId:otherRegisterId, isFlagged:true }, ''],
    [true, { groupId, isFlagged:true }, '?scope=combined'],
  ]) {
    const api = route({ ...ownerContext, accountantRegisterId:registerId, accountantAccess:{ allowDirectUpdates } });
    assert.equal((await api.PATCH(request(body, scope))).status, 403);
    assert.equal(api.calls.length, 0);
  }
});
