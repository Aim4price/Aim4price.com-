import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
function load(file,deps={}){const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const module={exports:{}};Function('require','module','exports',code)(id=>id in deps?deps[id]:require(id),module,module.exports);return module.exports;}
const shared=load('lib/billing-shared.ts'),constants=load('lib/account-constants.ts');
const report=load('lib/billing-report.ts',{'./billing-shared':shared,'./report-theme':load('lib/report-theme.ts')});
const template=load('lib/billing-email-template.ts',{'./billing-shared':shared,'./billing-report':report,'./email-brand':load('lib/email-brand.ts')});
test('invoice email includes clear payment details, escaped customer content and plain text',()=>{
 const result=template.buildBillingEmail({number:'A4P-2026-000001',customer:{name:'<img src=x onerror=alert(1)>',businessName:'Farm & Co',reference:'PO-7'},totalCents:39900,paidCents:10000,dueDate:'2026-09-27',issuer:shared.BILLING_ISSUER},'https://aim4price.test/billing');
 assert.match(result.html,/&lt;img/);assert.doesNotMatch(result.html,/<img src=x/);assert.match(result.html,/Farm &amp; Co/);
 for(const text of ['Payment reference','4113 0591 64','View invoice','27 Sept 2026','PO-7'])assert.ok(result.html.includes(text),text);
 assert.ok(result.text.includes(shared.money(29900)));assert.ok(result.html.includes(shared.money(29900)));assert.match(result.text,/Recorded payments/);
});
test('billing suspension is atomic, invoice-linked, audited and cleared on admin status changes',async()=>{
 const pg=new PGlite();let failAudit=false;
 const query=async(sql,values)=>{if(failAudit&&sql.includes('insert into aim4price_billing_events'))throw Error('Audit failed');const result=await pg.query(sql,values);return {...result,rowCount:result.rows.length||result.affectedRows||0};};
 const db={query,connect:async()=>({query,release(){}})};
 const schema=load('lib/billing-schema.ts');
 const billing=load('lib/billing.ts',{'./db':{getDb:()=>db},'./billing-schema':schema,'./billing-shared':shared,'./billing-report':report,'./admin-work-tracker':{ensureAdminWorkTrackerSchema:async()=>{}}});
 const access=load('lib/billing-suspension.ts',{'./db':{getDb:()=>db},'./account-profile':{ensureAccountProfileColumns:async()=>{}},'./account-constants':constants,'./billing':{...billing,ensureBillingSchema:async()=>{}}});
 const admin=load('lib/admin-users.ts',{'./db':{getDb:()=>db},'./account-profile':{ensureAccountProfileColumns:async()=>{}},'./account-constants':constants,'./account-deletion':{},'./admin-storage-usage':{}});
 const id='10000000-0000-4000-8000-000000000001';
 const command={id,version:2,accountStatus:'active',reason:'Payment remains outstanding. Please contact Aim4price.'};
 try{
  await pg.exec('create table "user"(id text primary key,name text,email text); create table account_profiles(user_id text primary key,account_status text,display_name text,account_type text,account_subtype text,introduced_by_option text,created_at timestamptz default now(),updated_at timestamptz default now());');
  await pg.exec(readFileSync(new URL('../database/migrations/116-billing-suspension.sql',import.meta.url),'utf8'));await pg.exec(schema.BILLING_SCHEMA_SQL);
  await pg.exec(`insert into "user" values ('owner','Customer','customer@example.test'),('other','Other','other@example.test'); insert into account_profiles(user_id,account_status) values('owner','active'),('other','active');`);
  await pg.query(`insert into aim4price_billing_invoices(id,user_id,number,status,customer,issuer,lines,total_cents,due_date,version) values($1,'owner','A4P-2026-000001','issued',$2,'{}','[]',39900,'2026-09-27',2)`,[id,JSON.stringify({name:'Customer',email:'customer@example.test'})]);
  for(const input of [{...command,reason:''},{...command,version:1}])await assert.rejects(access.suspendBillingAccount(input,'admin'));
  await assert.rejects(access.suspendBillingAccount(command,'owner'),/own account/);
  await pg.query('update "user" set email=$1 where id=$2',['aim4price@gmail.com','owner']);await assert.rejects(access.suspendBillingAccount(command,'admin'),/Admin accounts/);await pg.query('update "user" set email=$1 where id=$2',['customer@example.test','owner']);
  for(const status of ['draft','void']){await pg.query('update aim4price_billing_invoices set status=$2,number=$3 where id=$1',[id,status,status==='draft'?null:'A4P-2026-000001']);await assert.rejects(access.suspendBillingAccount(command,'admin'),/issued invoice/);}
  await pg.query("update aim4price_billing_invoices set status='issued',paid_cents=39900 where id=$1",[id]);await assert.rejects(access.suspendBillingAccount(command,'admin'),/outstanding balance/);
  await pg.query('update aim4price_billing_invoices set paid_cents=0 where id=$1',[id]);
  failAudit=true;await assert.rejects(access.suspendBillingAccount(command,'admin'),/Audit failed/);failAudit=false;
  assert.equal((await pg.query("select account_status from account_profiles where user_id='owner'")).rows[0].account_status,'active');
  await access.suspendBillingAccount({...command,userId:'other'},'admin');
  const hold=await access.getBillingSuspension('owner');assert.equal(hold.invoice.id,id);assert.equal(hold.reason,command.reason);assert.equal(await access.getBillingSuspension('other'),null);
  assert.equal((await pg.query('select actor_id,action from aim4price_billing_events')).rows[0].actor_id,'admin');
  await assert.rejects(access.suspendBillingAccount(command,'admin'),/Account access changed/);
  await access.suspendBillingAccount({...command,accountStatus:'suspended',reason:'Updated customer-visible reason.'},'admin');assert.equal((await access.getBillingSuspension('owner')).reason,'Updated customer-visible reason.');
  assert.equal((await pg.query("select count(*)::int as n from aim4price_billing_events where action='account_suspension_updated'")).rows[0].n,1);
  await admin.setAdminUserAccountStatus('owner','active');assert.equal(await access.getBillingSuspension('owner'),null);
  await admin.setAdminUserAccountStatus('owner','suspended');assert.equal(await access.getBillingSuspension('owner'),null,'old billing reason must not reappear on a later suspension');
 }finally{await pg.close();}
});
