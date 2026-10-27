import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture() {
  const state = { role:'operations', registers:[], assets:[{id:id(1),registerId:id(10)}], writes:[], explicit:[] };
  const db = { query: async (sql,args=[]) => {
    if(sql.includes('coalesce(settings.asset_scope')) return {rows:[{asset_scope:'selected',access_role:state.role,asset_ids:state.explicit,group_ids:[],register_ids:state.registers}]};
    if(sql.startsWith('select * from public.owner_app_users')) return {rows:[{id:id(20),parent_owner_user_id:'owner',access_role:state.role}]};
    if(sql.includes('select explicit.asset_id')) return {rows:state.explicit.map(asset_id=>({asset_id}))};
    if(sql.includes('insert into public.owner_app_user_access_settings')) {state.registers=args[2];state.writes.push(args);}
    return {rows:[]};
  }};
  const deps = {'./db':{getDb:()=>db},'./app-login-namespace':{},'./app-login-name':{},'./asset-groups':{listAssetGroups:async()=>[]},'./asset-registers':{listAssetRegisters:async owner=>{assert.equal(owner,'owner');return [{id:id(10)}];}},'./owner-app-assets':{listAllOwnerAppAssets:async owner=>{assert.equal(owner,'owner');return {items:state.assets};}}};
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(new URL('../lib/owner-app.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(name=>deps[name]??require(name),module,module.exports);
  return {state,api:module.exports};
}
test('register grants reject foreign IDs, persist, include future assets and deduplicate explicit choices',async()=>{
  const {state,api}=fixture();
  const saved=await api.updateOwnerAppAssetAccessSettings('owner',id(20),{assetScope:'selected',assetIds:[],groupIds:[],registerIds:[id(10),id(99),id(10),'invalid']});
  assert.deepEqual(saved.registerIds,[id(10)]);
  state.explicit=[id(1)];
  assert.deepEqual(await api.resolveOwnerAppAccessibleAssetIds('owner',id(20)),[id(1)]);
  state.assets.push({id:id(2),registerId:id(10)},{id:id(3),registerId:id(99)});
  assert.deepEqual(await api.resolveOwnerAppAccessibleAssetIds('owner',id(20)),[id(1),id(2)]);
  await api.updateOwnerAppAssetAccessSettings('owner',id(20),{assetScope:'selected',assetIds:[],groupIds:[],registerIds:[]});
  assert.deepEqual(state.registers,[]);
});
test('admin access stays unrestricted and cannot be narrowed through this endpoint',async()=>{
 const {state,api}=fixture();state.role='admin';
 const result=await api.updateOwnerAppAssetAccessSettings('owner',id(20),{assetScope:'selected',registerIds:[id(10)]});
 assert.equal(result.assetScope,'all');assert.equal(state.writes.length,0);
});
