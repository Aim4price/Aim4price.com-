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
 const allowed=manager.projectManagerAsset(asset,policy.TEAM_TEMPLATES.manager.permissions);assert.equal(allowed.value,123456);assert.deepEqual(allowed.documents,[]);
});
test('restricted support sessions reject arbitrary owner endpoints, even with all role permissions',()=>{
 for(const path of ['/api/admin/accounts','/api/account','/api/owner-app/users','/api/marketplace','/api/asset-register']) assert.equal(requests.managerRequestAllowed(path,'POST',policy.TEAM_TEMPLATES.manager.permissions),false,path);
 assert.equal(requests.managerRequestAllowed('/api/fuel/slips','POST',policy.EMPTY_TEAM_PERMISSIONS),false);
 assert.equal(requests.managerRequestAllowed('/api/fuel/slips','POST',policy.TEAM_TEMPLATES.manager.permissions),true);
});
test('legacy migration preserves identity, password, selected scope, deactivation and tank restrictions exactly once',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`CREATE TABLE field_managers(id uuid primary key,owner_user_id text,display_name text,username text,username_normalized text,password_hash text,is_active boolean,session_version int,failed_login_attempts int,login_locked_until timestamptz,last_login_at timestamptz,created_at timestamptz);
 CREATE TABLE field_manager_access_settings(field_manager_id uuid,asset_scope text,fuel_scope text,can_record_work boolean,can_schedule_maintenance boolean,can_record_fuel boolean,can_refill_fuel boolean);
 CREATE TABLE field_manager_asset_access(field_manager_id uuid,asset_id uuid); CREATE TABLE field_manager_group_access(field_manager_id uuid,group_id uuid); CREATE TABLE field_manager_fuel_storage_access(field_manager_id uuid,fuel_storage_id uuid);
 CREATE TABLE owner_app_users(id uuid primary key,parent_owner_user_id text,display_name text,username text,username_normalized text unique,password_hash text,is_active boolean,access_role text,permissions jsonb,session_version int,failed_login_attempts int,login_locked_until timestamptz,last_login_at timestamptz,created_at timestamptz,fuel_storage_ids uuid[]);
 CREATE TABLE owner_app_user_access_settings(owner_app_user_id uuid,asset_scope text); CREATE TABLE owner_app_user_asset_access(owner_app_user_id uuid,asset_id uuid); CREATE TABLE owner_app_user_group_access(owner_app_user_id uuid,group_id uuid);`);
 const id='00000000-0000-4000-8000-000000000001', asset='00000000-0000-4000-8000-000000000002', tank='00000000-0000-4000-8000-000000000003';
 await db.query("INSERT INTO field_managers VALUES($1,'farm','Worker','worker','worker','scrypt$unchanged',false,7,2,NULL,NULL,now())",[id]);
 await db.query("INSERT INTO field_manager_access_settings VALUES($1,'selected','selected',true,false,true,false)",[id]);
 await db.query('INSERT INTO field_manager_asset_access VALUES($1,$2)',[id,asset]);await db.query('INSERT INTO field_manager_fuel_storage_access VALUES($1,$2)',[id,tank]);
 const client={query:(sql,args)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):db.query(sql,args),release(){}};
 const api=load('lib/manager-user-migration.ts',{'./db':{getDb:()=>({connect:async()=>client})},'./team-access-policy':policy});
 await api.migrateManagerUsers();await api.migrateManagerUsers();
 const rows=(await db.query('SELECT * FROM owner_app_users')).rows;assert.equal(rows.length,1);const user=rows[0];assert.equal(user.id,id);assert.equal(user.password_hash,'scrypt$unchanged');assert.equal(user.is_active,false);assert.equal(user.session_version,8);assert.deepEqual(user.fuel_storage_ids,[tank]);assert.equal(user.permissions.recordFuelIssues,true);assert.equal(user.permissions.refillFuel,false);assert.equal(user.permissions.scheduleMaintenance,false);assert.equal(user.permissions.viewValues,false);assert.equal(user.permissions.viewFuelCosts,false);
 assert.equal((await db.query('SELECT * FROM owner_app_user_asset_access')).rows[0].asset_id,asset);
 await db.query("UPDATE owner_app_users SET display_name='Changed after migration'");await api.migrateManagerUsers();assert.equal((await db.query('SELECT display_name FROM owner_app_users')).rows[0].display_name,'Changed after migration');
 } finally {await db.close();}
});
test('retired app has no executable pages or user APIs; installed copies receive a retirement worker',()=>{
 for(const path of ['app/field-manager','app/api/field-manager','app/api/field-managers','lib/field-manager.ts'])assert.equal(fs.existsSync(path),false,path);
 const middleware=fs.readFileSync('middleware.ts','utf8');assert.match(middleware,/status: 410/);assert.match(middleware,/owner-app\/login/);
 assert.match(fs.readFileSync('public/field-manager-sw.js','utf8'),/unregister/);
});
