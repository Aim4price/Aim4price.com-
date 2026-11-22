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
   CREATE TABLE account_profiles(user_id text PRIMARY KEY,account_type text,account_subtype text default 'contributor',account_status text default 'active',updated_at timestamptz);
   INSERT INTO "user" VALUES('owner','Owner','owner@test',true),('member','Member','member@test',true);
   INSERT INTO account_profiles VALUES('owner','business'),('member','business');`);
  const query=async(sql,args)=>{
   const r=args?await pg.query(sql,args):(await pg.exec(sql)).at(-1);
   return {...r,rowCount:r.affectedRows||r.rows.length};
  };
  const pool={query,connect:async()=>({query,release(){}})};
  const db={'./db':{getDb:()=>pool}};
  const membership=load('lib/business-workspaces.ts',{...db,'./guest-lead-schema':{}});
  const credits=load('lib/business-credits.ts',{...db,'./sharing-foundation':load('lib/sharing-foundation.ts',db),'./business-workspaces':membership});
  const owner=await membership.ensureBusinessWorkspace('owner');
  await pg.query("INSERT INTO business_workspace_members(business_id,user_id,role) VALUES($1,'member','member')",[owner.business_id]);
  await credits.ensureCreditSchema();
  const save=(key,userId='owner')=>credits.creditTransaction(db=>credits.spendBusinessCredit(db,userId,'Recorded a cost',key));
  const balance=()=>credits.creditBalance(pool,owner.business_id);
  await assert.rejects(credits.creditTransaction(async db=>{await credits.spendBusinessCredit(db,'owner','Recorded a cost','cost:failed');throw Error('rollback');}));
  assert.equal((await balance()).used,0);
  await pg.query("UPDATE business_workspaces SET monthly_allowance=1,enforce_credits=true");
  await save('cost:first');await save('cost:first');assert.equal((await balance()).used,1);
  await assert.rejects(save('cost:second'),credits.CreditLimitError);
  await pg.query("INSERT INTO business_owner_referrals(owner_id,business_id,rewarded_at,credits) VALUES('member',$1,now(),1)",[owner.business_id]);
  await save('cost:second','member');assert.equal((await balance()).used,2);
  assert.equal((await credits.creditHistory(pool,owner.business_id)).length,2);
  await pg.query("UPDATE business_completed_actions SET created_at=now()-interval '2 months'");
  assert.equal((await balance()).used,0);
  const setPlan=(plan)=>credits.creditTransaction(db=>credits.changeBusinessPlan(db,owner.business_id,'owner',plan));
  await pg.query('UPDATE business_workspaces SET upgrade_requested_at=now()');
  await setPlan('paid');await setPlan('paid');
  assert.equal((await pg.query("select account_type from account_profiles where user_id='owner'")).rows[0].account_type,'dealer');
  assert.equal((await pg.query("select plan from sharing_account_access where user_id='owner'")).rows[0].plan,'desktop');
  await save('cost:after-plan-change');assert.equal((await balance()).used,0);
  await setPlan('free');assert.equal((await pg.query('SELECT upgrade_requested_at FROM business_workspaces')).rows[0].upgrade_requested_at,null);
  assert.equal((await pg.query("select account_type from account_profiles where user_id='owner'")).rows[0].account_type,'business');
  assert.equal((await pg.query("select plan from sharing_account_access where user_id='owner'")).rows[0].plan,'free');
  await save('cost:after-plan-change');assert.equal((await balance()).used,1);
  assert.deepEqual((await pg.query('SELECT plan,actor_id FROM business_plan_changes ORDER BY id')).rows,[{plan:'paid',actor_id:'owner'},{plan:'free',actor_id:'owner'}]);
 }finally{if(previous===undefined)delete process.env.AIM4PRICE_BUSINESS_CREDIT_ENFORCEMENT;else process.env.AIM4PRICE_BUSINESS_CREDIT_ENFORCEMENT=previous;await pg.close();}
});
