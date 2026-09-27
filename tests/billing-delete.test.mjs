import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
function load(file,deps={}){const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const module={exports:{}};Function('require','module','exports',code)(id=>id in deps?deps[id]:require(id),module,module.exports);return module.exports;}
const shared=load('lib/billing-shared.ts'),schema=load('lib/billing-schema.ts');
const report=load('lib/billing-report.ts',{'./billing-shared':shared,'./report-theme':load('lib/report-theme.ts')});
test('hard deletion removes invoice data atomically, retires identifiers, and scopes new invoice notifications',async()=>{
 const pg=new PGlite();let failDelete=false;
 const query=async(sql,values)=>{if(sql===schema.BILLING_SCHEMA_SQL){await pg.exec(sql);return {rows:[],rowCount:0};}if(sql.includes('pg_advisory_xact_lock'))return {rows:[],rowCount:1};if(failDelete&&sql==='delete from aim4price_billing_invoices where id=$1')throw Error('Delete failed');const r=await pg.query(sql,values);return {...r,rowCount:r.rows.length||r.affectedRows||0};};
 const db={query,connect:async()=>({query,release(){}})};
 const billing=load('lib/billing.ts',{'./db':{getDb:()=>db},'./billing-schema':schema,'./billing-shared':shared,'./billing-report':report,'./admin-work-tracker':{ensureAdminWorkTrackerSchema:async()=>{}}});
 const deletion=load('lib/billing-delete.ts',{'./db':{getDb:()=>db},'./account-profile':{ensureAccountProfileColumns:async()=>{}},'./billing':billing});
 const notifications=load('lib/billing-notifications.ts',{'./db':{getDb:()=>db},'./billing':billing,'./billing-shared':shared});
 const customer={name:'Customer',email:'customer@example.test',address:'George'};
 try{
  await pg.exec(`create table "user"(id text primary key,name text,email text);insert into "user" values('owner','Customer','customer@example.test'),('other','Other','other@example.test');create table account_profiles(user_id text primary key,account_status text,suspension_reason text,billing_suspension_invoice_id uuid,updated_at timestamptz);create table user_notifications(user_id text,event_key text);insert into account_profiles(user_id,account_status) values('owner','suspended');`);
  await billing.ensureBillingSchema();
  async function seed(status='issued',paid=0,user='owner',key=null){const id=randomUUID(),number=status==='draft'?null:'A4P-'+id;await pg.query(`insert into aim4price_billing_invoices(id,user_id,number,status,customer,issuer,lines,total_cents,paid_cents,due_date,issued_at,version,generation_key,report_html,pdf) values($1,$2,$3,$4,$5,'{}','[]',39900,$6,'2026-09-27',now(),2,$7,'invoice html',$8)`,[id,user,number,status,JSON.stringify(customer),paid,key,Buffer.from('pdf')]);return {id,version:2,confirmation:number||'DELETE',confirmed:true,reason:'Mistaken test invoice'};}
  const paid=await seed('issued',39900,'owner','signup:owner');
  await seed('draft');await seed('void');const other=await seed('issued',0,'other');
  const alerts=await notifications.listBillingNotifications('owner');assert.deepEqual(alerts.map(x=>x.id),['billing-invoice:'+paid.id]);assert.equal(alerts[0].href,'/billing');assert.equal(alerts[0].category,'billing');
  assert.deepEqual((await notifications.listBillingNotifications('other')).map(x=>x.id),['billing-invoice:'+other.id]);
  const empty=new Proxy({},{get:()=>async()=>[]});const surfaceDeps=Object.fromEntries(['./fuel-ledger','./asset-discovery','./partner-access','./asset-maintenance','./dealer-asset-corrections','./dealer-maintenance-tracker','./dealer-costs','./capture-requests','./cost-budgets','./marketplace-sourcing-requests'].map(name=>[name,empty]));
  const surface=load('lib/notifications.ts',{...surfaceDeps,'./db':{getDb:()=>({query:async()=>({rows:[]})})},'./billing-notifications':notifications});
  assert.deepEqual((await surface.listComputedHeaderNotifications({userId:'owner',accountType:'insurance'})).map(x=>x.id),['billing-invoice:'+paid.id],'the account bell includes billing events');

  await pg.query('insert into aim4price_billing_payments(id,invoice_id,amount_cents,payment_date,reference,actor_id) values($1,$2,39900,\'2026-09-27\',\'mistake\',\'admin\')',[randomUUID(),paid.id]);
  await pg.query("insert into aim4price_billing_events(invoice_id,actor_id,action) values($1,'admin','issued')",[paid.id]);
  await pg.query("insert into aim4price_billing_work(work_session_id,invoice_id) values('work', $1)",[paid.id]);
  await pg.query("insert into aim4price_billing_mail(id,invoice_id,status) values($1,$2,'sending')",[randomUUID(),paid.id]);
  await pg.query("update account_profiles set billing_suspension_invoice_id=$1,suspension_reason='Test' where user_id='owner'",[paid.id]);
  await pg.query('insert into user_notifications values($1,$2)',['owner','billing-invoice:'+paid.id]);
  for(const patch of [{reason:''},{confirmed:false},{confirmation:'wrong'},{version:1}])await assert.rejects(deletion.hardDeleteBillingInvoice({...paid,...patch},'admin'));
  await assert.rejects(deletion.hardDeleteBillingInvoice(paid,'admin'),/sending is in progress/);
  await pg.query("update aim4price_billing_mail set status='accepted' where invoice_id=$1",[paid.id]);
  failDelete=true;await assert.rejects(deletion.hardDeleteBillingInvoice(paid,'admin'),/Delete failed/);failDelete=false;
  assert.equal((await pg.query('select count(*)::int as n from aim4price_billing_payments')).rows[0].n,1);assert.equal((await pg.query('select count(*)::int as n from aim4price_billing_deletions')).rows[0].n,0);
  await deletion.hardDeleteBillingInvoice(paid,'admin');
  for(const table of ['aim4price_billing_mail','aim4price_billing_payments','aim4price_billing_events','aim4price_billing_work'])assert.equal((await pg.query(`select count(*)::int as n from ${table} where invoice_id=$1`,[paid.id])).rows[0].n,0,table);
  await assert.rejects(billing.getBillingInvoice(paid.id,'owner',true),/not found/);assert.equal((await notifications.listBillingNotifications('owner')).length,0);
  assert.equal((await pg.query('select count(*)::int as n from user_notifications')).rows[0].n,0);
  const profile=(await pg.query("select * from account_profiles where user_id='owner'")).rows[0];assert.equal(profile.account_status,'suspended');assert.equal(profile.billing_suspension_invoice_id,null);
  const receipt=(await pg.query('select * from aim4price_billing_deletions where invoice_id=$1',[paid.id])).rows[0];assert.equal(receipt.actor_id,'admin');assert.equal(receipt.generation_key,'signup:owner');
  await assert.rejects(billing.createBillingDraft({id:paid.id,userId:'owner',customer,lines:[{description:'Service',quantity:1,unitCents:39900}],dueDate:'2026-09-27'},'admin'),/permanently deleted/);
  // Retry an already processed signup after deletion: the period stays retired.
  await billing.queueSignupInvoice('owner',{customer,plan:{accountType:'owner',description:'Service',amountCents:39900,interval:'once',dueDays:7,version:1,enabled:true}});await billing.processSignupInvoices();assert.equal((await notifications.listBillingNotifications('owner')).length,0);
  const period='2026-09-27';const recurring=await seed('issued',0,'owner','recurring:owner:'+period);await deletion.hardDeleteBillingInvoice(recurring,'admin');
  await pg.query(`insert into aim4price_billing_agreements(user_id,customer,lines,interval,anchor_date,next_invoice_date,due_days,enabled) values('owner',$1,$2,'monthly',$3,$3,7,true)`,[JSON.stringify(customer),JSON.stringify([{description:'Service',quantity:1,unitCents:39900,totalCents:39900}]),period]);
  await billing.processRecurringInvoices(period);assert.equal((await pg.query('select count(*)::int as n from aim4price_billing_invoices where generation_key=$1',['recurring:owner:'+period])).rows[0].n,0);
  assert.equal((await pg.query("select next_invoice_date::text as date from aim4price_billing_agreements where user_id='owner'")).rows[0].date,'2026-10-27');
  for(const state of ['draft','void','issued']){const item=await seed(state);await deletion.hardDeleteBillingInvoice(item,'admin');await assert.rejects(billing.getBillingInvoice(item.id,null,true),/not found/);}
 }finally{await pg.close();}
});
