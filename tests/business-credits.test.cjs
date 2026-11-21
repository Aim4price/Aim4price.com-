const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks){
 const out={};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',code)(name=>mocks[name]||require(name),out);
 return out;
}
test('Business credits pool across members and preserve trial, upgrade, retry and last-credit behaviour',async()=>{
 const pg=new PGlite(), previous=process.env.AIM4PRICE_BUSINESS_CREDIT_ENFORCEMENT;
 try{
  await pg.exec(`CREATE TABLE "user"(id text PRIMARY KEY,name text,email text,"emailVerified" boolean);
   CREATE TABLE account_profiles(user_id text PRIMARY KEY,account_type text);
   INSERT INTO "user" VALUES('owner','Owner','owner@test',true),('member','Member','member@test',true);
   INSERT INTO account_profiles VALUES('owner','business'),('member','business');`);
  const query=async(sql,args)=>{
   const r=args?await pg.query(sql,args):(await pg.exec(sql)).at(-1);
   return {...r,rowCount:r.affectedRows||r.rows.length};
  };
  const pool={query,connect:async()=>({query,release(){}})};
  const db={'./db':{getDb:()=>pool}};
  const membership=load('lib/business-workspaces.ts',{...db,'./guest-lead-schema':{}});
  const credits=load('lib/business-credits.ts',{...db,'./business-workspaces':membership});
  const owner=await membership.ensureBusinessWorkspace('owner');
  await pg.query("INSERT INTO business_workspace_members(business_id,user_id,role) VALUES($1,'member','member')",[owner.business_id]);
  await credits.ensureCreditSchema();
  const event=(action,userId='owner')=>({action,userId,requestId:randomUUID(),token:'link',assetKey:'tractor'});
  const save=(action,phase)=>credits.creditTransaction(db=>credits.recordCredit(db,action,phase));
  const balance=()=>credits.creditBalance(pool,owner.business_id);
  const send=event('send');
  await assert.rejects(credits.creditTransaction(async db=>{await credits.recordCredit(db,send);throw Error('rolled back note');}));
  assert.equal((await balance()).used,0);
  const share=event('share','member');await save(share,'reserve');await save(share,'reserve');
  assert.equal((await balance()).held,1);await save(share,'cancel');assert.equal((await balance()).used,0);
  await save(share,'reserve');await save(share);await save(share);
  await pg.query(`INSERT INTO business_credit_events(business_id,actor_id,action,request_id,token,asset_key,state,units)
   SELECT $1,'owner','send',gen_random_uuid(),'link','tractor','complete',1 FROM generate_series(1,498)`,[owner.business_id]);
  process.env.AIM4PRICE_BUSINESS_CREDIT_ENFORCEMENT='true';
  const manage=event('manage');await save(manage);await save(manage);
  assert.equal((await balance()).used,500);
  await assert.rejects(save(event('send','member')),credits.CreditLimitError);
  await assert.rejects(save(event('share'),'reserve'),credits.CreditLimitError);
  const reply={...event('send'),visitId:manage.requestId};
  await save(reply);assert.equal((await balance()).used,500);
  const includedShare={...event('share'),visitId:manage.requestId};
  await save(includedShare,'reserve');await save(includedShare);assert.equal((await balance()).used,500);
  await assert.rejects(save({...event('send','member'),visitId:manage.requestId}),/visit/);
  await credits.checkBusinessWrite('owner','link','tractor');
  await save(manage,'close');
  await assert.rejects(credits.checkBusinessWrite('owner','link','tractor'),credits.CreditLimitError);
  process.env.AIM4PRICE_BUSINESS_CREDIT_ENFORCEMENT='false';await save(event('manage'));
  assert.equal((await balance()).used,501);
  process.env.AIM4PRICE_BUSINESS_CREDIT_ENFORCEMENT='true';
  await pg.query('UPDATE business_credit_events SET created_at=now()-interval \'2 months\'');
  assert.equal((await balance()).used,0);
  const setPlan=(plan)=>credits.creditTransaction(db=>credits.changeBusinessPlan(db,owner.business_id,'owner',plan));
  await pg.query('UPDATE business_workspaces SET upgrade_requested_at=now()');
  await setPlan('paid');await setPlan('paid');
  await save(event('send'));assert.equal((await balance()).used,0);
  await setPlan('free');assert.equal((await pg.query('SELECT upgrade_requested_at FROM business_workspaces')).rows[0].upgrade_requested_at,null);
  await save(event('send'));assert.equal((await balance()).used,1);
  assert.deepEqual((await pg.query('SELECT plan,actor_id FROM business_plan_changes ORDER BY id')).rows,[{plan:'paid',actor_id:'owner'},{plan:'free',actor_id:'owner'}]);
 }finally{if(previous===undefined)delete process.env.AIM4PRICE_BUSINESS_CREDIT_ENFORCEMENT;else process.env.AIM4PRICE_BUSINESS_CREDIT_ENFORCEMENT=previous;await pg.close();}
});
