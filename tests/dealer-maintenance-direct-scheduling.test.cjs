const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const A='10000000-0000-4000-8000-000000000001';
const S='20000000-0000-4000-8000-000000000001';
async function setup(){
 const pg=new PGlite();
 await pg.exec(`CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text,title text);
 CREATE TABLE account_profiles(user_id text,display_name text,business_name text,phone text);
 CREATE TABLE "user"(id text,email text);
 CREATE TABLE asset_leads(id uuid PRIMARY KEY,owner_user_id text,partner_user_id text,asset_register_item_id uuid);
 CREATE TABLE asset_maintenance_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text,asset_register_item_id uuid,maintenance_type text,trigger_type text,status text,title text,notes text,assigned_field_manager_id uuid,assigned_name text,due_date date,due_usage numeric,usage_metric text,alert_before_value numeric,alert_before_unit text,recurring_enabled boolean,recurring_interval_value numeric,recurring_interval_unit text,created_at timestamptz,updated_at timestamptz);
 INSERT INTO asset_register_items VALUES('${A}','owner','Tractor');`);
 let beforeWrite=null;
 const query=(sql,params)=>/create extension/i.test(sql)?Promise.resolve({rows:[]}):params?pg.query(sql,params):pg.exec(sql).then(r=>r.at(-1));
 const db={query,connect:async()=>{if(beforeWrite){const fn=beforeWrite;beforeWrite=null;await fn();}return {query,release(){}};}};
 const mocks={
 './db':{getDb:()=>db},'./database-schema-readiness':{isDatabaseSchemaReady:async()=>false},
 './maintenance-catalogue':{},'./account-profile':{},'./asset-issue-notes':{},'./dealer-asset-corrections':{},
 './asset-register-db':{getAssetRegisterItemById:async(user,id)=>(await pg.query('SELECT id,title FROM asset_register_items WHERE id=$1 AND user_id=$2',[id,user])).rows[0]},
 './asset-maintenance':{ensureAssetMaintenanceTables:async()=>{},listAssetMaintenanceRecords:async()=>[]},
 };
 const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync('lib/dealer-maintenance-tracker.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>{if(!(n in mocks))throw Error(n);return mocks[n]},exports);
 await exports.ensureDealerMaintenanceTrackerTables();
 await pg.query(`INSERT INTO dealer_maintenance_access(id,owner_user_id,dealer_user_id,asset_register_item_id,can_create_maintenance_schedules) VALUES($1,'owner','dealer',$2,true)`,[S,A]);
 const create=(overrides={})=>exports.createDealerMaintenanceSchedule({dealerUserId:'dealer',draft:{accessId:S,maintenanceType:'service',triggerType:'date',dueDate:'2026-12-01',recurringEnabled:true,recurringIntervalValue:6,recurringIntervalUnit:'months'},...overrides});
 return {pg,create,beforeWrite:fn=>beforeWrite=fn};
}
test('permitted dealer creates an active owner schedule immediately, without a pending proposal; retries cannot duplicate it',async()=>{
 const x=await setup();try{
 const result=await x.create();const records=(await x.pg.query('SELECT * FROM asset_maintenance_records')).rows;
 assert.equal(records.length,1);assert.equal(records[0].id,result.maintenanceRecordId);assert.equal(records[0].user_id,'owner');assert.equal(records[0].status,'upcoming');assert.equal(Number(records[0].recurring_interval_value),6);
 assert.equal((await x.pg.query('SELECT * FROM dealer_maintenance_schedule_proposals')).rows.length,0);
 await assert.rejects(x.create(),/MAINTENANCE_ALREADY_SCHEDULED/);
 }finally{await x.pg.close();}
});
test('foreign dealer, revoked shares, missing permission and mismatched leads cannot create schedules',async()=>{
 const x=await setup();try{
 await assert.rejects(x.create({dealerUserId:'other'}),/TRACKING_ACCESS_NOT_FOUND/);
 await assert.rejects(x.create({draft:{accessId:S,leadId:A}}),/LEAD_NOT_FOUND/);
 await x.pg.query('UPDATE dealer_maintenance_access SET can_create_maintenance_schedules=false');
 await assert.rejects(x.create(),/MAINTENANCE_SCHEDULE_PERMISSION_REQUIRED/);
 await x.pg.query('UPDATE dealer_maintenance_access SET is_active=false');
 await assert.rejects(x.create(),/TRACKING_ACCESS_NOT_FOUND/);
 assert.equal((await x.pg.query('SELECT * FROM asset_maintenance_records')).rows.length,0);
 }finally{await x.pg.close();}
});
test('permission revocation and ownership changes between opening and saving are checked inside the transaction',async()=>{
 const x=await setup();try{
 x.beforeWrite(()=>x.pg.query('UPDATE dealer_maintenance_access SET can_create_maintenance_schedules=false'));
 await assert.rejects(x.create(),/MAINTENANCE_SCHEDULE_PERMISSION_REQUIRED/);
 await x.pg.query('UPDATE dealer_maintenance_access SET can_create_maintenance_schedules=true');
 x.beforeWrite(()=>x.pg.query("UPDATE asset_register_items SET user_id='new-owner'"));
 await assert.rejects(x.create(),/ASSET_NOT_FOUND/);
 assert.equal((await x.pg.query('SELECT * FROM asset_maintenance_records')).rows.length,0);
 }finally{await x.pg.close();}
});
test('saving a legacy pending proposal activates it once and removes it from the approval queue',async()=>{
 const x=await setup();try{
 const p=(await x.pg.query(`INSERT INTO dealer_maintenance_schedule_proposals(access_id,owner_user_id,dealer_user_id,asset_register_item_id,maintenance_type,trigger_type,title,due_date) VALUES($1,'owner','dealer',$2,'service','date','Old proposal','2026-12-01') RETURNING id`,[S,A])).rows[0];
 const created=await x.create({proposalId:p.id});
 const saved=(await x.pg.query('SELECT * FROM dealer_maintenance_schedule_proposals WHERE id=$1',[p.id])).rows[0];
 assert.equal(saved.proposal_status,'approved');assert.equal(saved.created_maintenance_record_id,created.maintenanceRecordId);
 await assert.rejects(x.create({proposalId:p.id}),/MAINTENANCE_PROPOSAL_NOT_FOUND/);
 }finally{await x.pg.close();}
});
