const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(path,deps={}) {const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(name in deps)return deps[name];throw Error(name)},exports);return exports;}
const policy=load('lib/team-access-policy.ts');
const manager=load('lib/manager-permissions.ts',{'./team-access-policy':policy});
const workspace=load('lib/team-workspace-policy.ts',{'./team-access-policy':policy});
const requests=load('lib/manager-request-policy.ts',{'./team-workspace-policy':workspace});
test('Manager shares desktop roles and explicit stored permissions cannot gain defaults',()=>{
 for(const key of ['operator','workshop','office','manager']) assert.deepEqual(manager.managerPermissions(key),policy.TEAM_TEMPLATES[key].permissions);
 assert.deepEqual(manager.managerPermissions('admin',{}),policy.EMPTY_TEAM_PERMISSIONS);
 assert.deepEqual(manager.managerPermissions('unknown'),policy.EMPTY_TEAM_PERMISSIONS);
});
test('restricted payload never contains hidden values, private JSON or photos',()=>{
 const asset={id:'a',title:'Tractor',value:123456,replacementPriceExVat:234567,insuredValueExVat:345678,photos:['PRIVATE_PHOTO'],note:'PRIVATE_NOTE',financeNote:'PRIVATE_FINANCE',specsJson:{financeBalance:999999,usageMetric:'hours'},documents:['PRIVATE_DOC'],latitude:3};
 const json=JSON.stringify(manager.projectManagerAsset(asset,policy.EMPTY_TEAM_PERMISSIONS));
 for(const secret of ['123456','234567','345678','999999','PRIVATE_'])assert.ok(!json.includes(secret),secret);
 assert.equal(JSON.parse(json).specsJson.usageMetric,'hours');
 const allowed=manager.projectManagerAsset(asset,Object.fromEntries(policy.TEAM_PERMISSIONS.map(p=>[p.key,true])));assert.equal(allowed.value,123456);assert.deepEqual(allowed.documents,[]);
});
test('restricted support sessions reject arbitrary owner endpoints, even with all role permissions',()=>{
 for(const path of ['/api/admin/accounts','/api/account','/api/owner-app/users','/api/marketplace','/api/asset-register']) assert.equal(requests.managerRequestAllowed(path,'POST',Object.fromEntries(policy.TEAM_PERMISSIONS.map(p=>[p.key,true]))),false,path);
 assert.equal(requests.managerRequestAllowed('/api/fuel/slips','POST',policy.EMPTY_TEAM_PERMISSIONS),false);
 assert.equal(requests.managerRequestAllowed('/api/fuel/slips','POST',policy.TEAM_TEMPLATES.manager.permissions),false);
 assert.equal(requests.managerRequestAllowed('/api/maintenance','POST',{...policy.EMPTY_TEAM_PERMISSIONS,scheduleMaintenance:true}),true);
 assert.equal(requests.managerRequestAllowed('/api/fuel/slips','POST',Object.fromEntries(policy.TEAM_PERMISSIONS.map(p=>[p.key,true]))),true);
});
for (const businessSuffix of ['', '@farm']) for (const collisionOwner of [null, 'farm', 'another-farm']) test(`legacy migration preserves identities and restrictions exactly once (collision: ${collisionOwner || 'none'}, suffix: ${businessSuffix || 'none'})`,async()=>{
 const db=new PGlite();
 try {
 await db.exec(`CREATE TABLE field_managers(id uuid primary key,owner_user_id text,display_name text,username text,username_normalized text,password_hash text,is_active boolean,session_version int,failed_login_attempts int,login_locked_until timestamptz,last_login_at timestamptz,created_at timestamptz);
 CREATE TABLE field_manager_access_settings(field_manager_id uuid,asset_scope text,fuel_scope text,can_record_work boolean,can_schedule_maintenance boolean,can_record_fuel boolean,can_refill_fuel boolean);
 CREATE TABLE field_manager_asset_access(field_manager_id uuid,asset_id uuid); CREATE TABLE field_manager_group_access(field_manager_id uuid,group_id uuid); CREATE TABLE field_manager_fuel_storage_access(field_manager_id uuid,fuel_storage_id uuid);
 CREATE TABLE owner_app_users(id uuid primary key,parent_owner_user_id text,display_name text,username text,username_normalized text unique,password_hash text,is_active boolean,access_role text,permissions jsonb,session_version int,failed_login_attempts int,login_locked_until timestamptz,last_login_at timestamptz,created_at timestamptz,fuel_storage_ids uuid[]);
 CREATE TABLE owner_app_user_access_settings(owner_app_user_id uuid,asset_scope text); CREATE TABLE owner_app_user_asset_access(owner_app_user_id uuid,asset_id uuid); CREATE TABLE owner_app_user_group_access(owner_app_user_id uuid,group_id uuid);`);
 const id='00000000-0000-4000-8000-000000000001', asset='00000000-0000-4000-8000-000000000002', tank='00000000-0000-4000-8000-000000000003';
 if (collisionOwner) {
   for (const [existingId,name] of [[asset,'worker'],[tank,'worker-field']]) await db.query("INSERT INTO owner_app_users(id,parent_owner_user_id,display_name,username,username_normalized,password_hash,is_active,access_role,permissions,session_version) VALUES($1,$2,'Existing', $3,$3,'existing-password',true,'manager','{\"viewValues\":true}',19)",[existingId,collisionOwner,name + businessSuffix]);
 }
 await db.query("INSERT INTO field_managers VALUES($1,'farm','Worker',$2,$2,'scrypt$unchanged',false,7,2,NULL,NULL,now())",[id,'worker' + businessSuffix]);
 await db.query("INSERT INTO field_manager_access_settings VALUES($1,'selected','selected',true,false,true,false)",[id]);
 await db.query('INSERT INTO field_manager_asset_access VALUES($1,$2)',[id,asset]);await db.query('INSERT INTO field_manager_fuel_storage_access VALUES($1,$2)',[id,tank]);
 const client={query:(sql,args)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):db.query(sql,args),release(){}};
 const api=load('lib/manager-user-migration.ts',{'./db':{getDb:()=>({connect:async()=>client})},'./team-access-policy':policy});
 await api.migrateManagerUsers();await api.migrateManagerUsers();
 const rows=(await db.query('SELECT * FROM owner_app_users')).rows;assert.equal(rows.length,collisionOwner ? 3 : 1);const user=rows.find(row=>row.id===id);
 if (collisionOwner) { assert.equal(user.username,'worker-field-00000000-1' + businessSuffix); for (const row of rows.filter(row=>row.id!==id)) { assert.equal(row.parent_owner_user_id,collisionOwner);assert.equal(row.password_hash,'existing-password');assert.equal(row.session_version,19);assert.deepEqual(row.permissions,{viewValues:true}); } } else assert.equal(user.username,'worker' + businessSuffix);
 assert.equal(user.id,id);assert.equal(user.password_hash,'scrypt$unchanged');assert.equal(user.is_active,false);assert.equal(user.session_version,8);assert.deepEqual(user.fuel_storage_ids,[tank]);assert.equal(user.permissions.recordFuelIssues,true);assert.equal(user.permissions.refillFuel,false);assert.equal(user.permissions.scheduleMaintenance,false);assert.equal(user.permissions.viewValues,false);assert.equal(user.permissions.viewFuelCosts,false);
 assert.equal((await db.query('SELECT * FROM owner_app_user_asset_access')).rows[0].asset_id,asset);
 await db.query("UPDATE owner_app_users SET display_name='Changed after migration'");await api.migrateManagerUsers();assert.equal((await db.query('SELECT display_name FROM owner_app_users')).rows[0].display_name,'Changed after migration');
 } finally {await db.close();}
});
test('retired app has no executable pages or user APIs; installed copies receive a retirement worker',()=>{
 for(const path of ['app/field-manager','app/api/field-manager','app/api/field-managers','lib/field-manager.ts'])assert.equal(fs.existsSync(path),false,path);
 const middleware=fs.readFileSync('middleware.ts','utf8');assert.match(middleware,/status: 410/);assert.match(middleware,/owner-app\/login/);
 assert.match(fs.readFileSync('public/field-manager-sw.js','utf8'),/unregister/);
});

test('Manager user APIs translate database conflicts without exposing SQL details',async()=>{
 for(const itemRoute of [false,true]) {
  const prefix=itemRoute?'../../../../../lib/':'../../../../lib/';
  let failure=Object.assign(new Error('duplicate key value violates unique constraint private_index'),{code:'23505'});
  const api=load(itemRoute?'app/api/owner-app/users/[userId]/route.ts':'app/api/owner-app/users/route.ts',{
   'next/server':{NextResponse:{json:(body,options)=>({body,status:options.status})}},
   [prefix+'account-profile']:{getAccountProfile:async()=>({accountType:'owner',accountStatus:'active'})},
   [prefix+'auth-session']:{getServerSession:async()=>({user:{id:'owner'}}),isOwnerAppSession:()=>false},
   [prefix+'owner-app']:{createOwnerAppUser:async()=>{throw failure},updateOwnerAppUser:async()=>{throw failure}},
  });
  const submit=()=>itemRoute?api.PATCH({json:async()=>({})},{params:{userId:'staff'}}):api.POST({json:async()=>({})});
  let result=await submit();assert.equal(result.status,409);assert.match(result.body.error,/already in use/);assert.doesNotMatch(result.body.error,/private_index|constraint/);
  failure=Object.assign(new Error('relation private_table does not exist'),{code:'42P01'});
  result=await submit();assert.equal(result.status,500);assert.doesNotMatch(result.body.error,/private_table|relation/);
 }
});
