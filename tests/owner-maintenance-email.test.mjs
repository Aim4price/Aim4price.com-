import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const source=readFileSync(new URL('../lib/maintenance-reminders.ts',import.meta.url),'utf8');
const brand=readFileSync(new URL('../lib/email-brand.ts',import.meta.url),'utf8');
function load(overrides={}){
 const dependencies={maintenanceEmailsAllowed:async()=>true,maintenancePreferenceLink:async()=>'https://example.test/preferences',maintenanceAssetAvailable:async()=>true,process:{env:{}},getDb:()=>({query:async()=>({rows:[]})}),ensureAssetMaintenanceTables:async()=>{},listAssetMaintenanceRecords:async()=>[],getAssetMaintenanceRecordById:async()=>null,getAssetRegisterItemById:async()=>({serialNumber:'ABC'}),getSiteOrigin:()=> 'https://www.aim4price.com',sendAim4priceEmail:async()=>{},...overrides};
 const code=stripTypeScriptTypes(brand+'\n'+source.replace(/^import .*\n/gm,'')).replace(/^export /gm,'');
 return new Function(...Object.keys(dependencies),code+';return {maintenanceReminderEmail,sendMaintenanceReminderBatch,reminderStage};')(...Object.values(dependencies));
}
const record={id:'record',assetId:'asset',assetTitle:'Tractor <test>',title:'Oil & filter',status:'upcoming',computedStatus:'due_soon',triggerType:'usage',dueUsage:1500,currentUsage:1450,usageMetric:'hours',recurringEnabled:true,recurringIntervalValue:250,recurringIntervalUnit:'hours',assignedName:'',maintenanceType:'service'};

test('owner email shows recorded usage, interval, branding and safe content',()=>{
 const email=load().maintenanceReminderEmail(record,'VIN','Owner','https://www.aim4price.com/maintenance-reminder/record');
 assert.match(email.html,/Tractor &lt;test&gt;/);assert.match(email.html,/Oil &amp; filter/);
 assert.match(email.html,/Every 250 hours/);assert.match(email.html,/Last recorded usage/);
 assert.match(email.html,/aim4price-mark-black.png/);assert.match(email.html,/Manage maintenance/);
 assert.match(email.text,/last recorded usage/);assert.match(email.subject,/almost due/);
});
test('overdue wording is distinct and empty optional rows are omitted',()=>{
 const email=load().maintenanceReminderEmail({...record,computedStatus:'overdue',triggerType:'date',dueDate:'2026-11-02',recurringEnabled:false},'','','https://www.aim4price.com/maintenance');
 assert.match(email.subject,/overdue/);assert.match(email.text,/2026-11-02/);
 assert.doesNotMatch(email.html,/Last recorded usage|Serial \/ VIN|Scheduled by|Every 250/);
});
test('disabled rollout makes no database or provider calls',async()=>{
 const api=load({getDb:()=>{throw Error('Unexpected DB access');},sendAim4priceEmail:async()=>{throw Error('Unexpected send');}});
 assert.deepEqual(await api.sendMaintenanceReminderBatch(),{sent:0,failed:0,next:null,disabled:true});
});
test('enabled sender selects only owner, applies account filter and retains idempotency',async()=>{
 const emails=[];const queries=[];
 const query=async(sql,args)=>{queries.push({sql,args});
  if(sql.includes('SELECT DISTINCT user_id'))return {rows:[{user_id:'owner'}]};
  if(sql.includes('WITH RECURSIVE'))return {rows:[{scheduler_id:'dealer'}]};
  if(sql.includes('SELECT id,email,name')){assert.match(sql,/WHERE id=\$1$/);assert.deepEqual(args,['owner']);return {rows:[{id:'owner',email:'owner@example.test',name:'Owner'}]};}
  if(sql.includes('SELECT name,email'))return {rows:[{name:'Dealer'}]};
  if(sql.includes('RETURNING event_key'))return {rows:[{event_key:args[0]}]};
  return {rows:[]};
 };
 const api=load({process:{env:{MAINTENANCE_REMINDER_ENABLED:'true',MAINTENANCE_REMINDER_OWNER_IDS:' owner ',RESEND_API_KEY:'test'}},getDb:()=>({query}),listAssetMaintenanceRecords:async()=>[record],getAssetMaintenanceRecordById:async()=>record,sendAim4priceEmail:async email=>emails.push(email)});
 assert.equal((await api.sendMaintenanceReminderBatch()).sent,1);assert.equal(emails.length,1);assert.equal(emails[0].to,'owner@example.test');assert.equal(emails[0].idempotencyKey,'maintenance:record:owner:soon');
 assert.deepEqual(queries.find(q=>q.sql.includes('SELECT DISTINCT user_id')).args,['',['owner']]);
});
test('completion detected before sending suppresses reminder',async()=>{
 const query=async sql=>({rows:sql.includes('SELECT DISTINCT user_id')?[{user_id:'owner'}]:sql.includes('SELECT id,email,name')?[{id:'owner',email:'owner@example.test'}]:[]});
 const api=load({process:{env:{MAINTENANCE_REMINDER_ENABLED:'true'}},getDb:()=>({query}),listAssetMaintenanceRecords:async()=>[record],getAssetMaintenanceRecordById:async()=>({...record,status:'done'}),sendAim4priceEmail:async()=>{throw Error('Must not send');}});
 assert.equal((await api.sendMaintenanceReminderBatch()).sent,0);
});

test('asset removed between selection and provider call is not emailed',async()=>{
 let checks=0,sends=0;
 const query=async(sql,args)=>({rows:sql.includes('SELECT DISTINCT user_id')?[{user_id:'owner'}]:sql.includes('SELECT id,email,name')?[{id:'owner',email:'owner@example.test'}]:sql.includes('RETURNING event_key')?[{event_key:args[0]}]:[]});
 const api=load({process:{env:{MAINTENANCE_REMINDER_ENABLED:'true',RESEND_API_KEY:'test'}},getDb:()=>({query}),maintenanceAssetAvailable:async()=>++checks===1,listAssetMaintenanceRecords:async()=>[record],getAssetMaintenanceRecordById:async()=>record,sendAim4priceEmail:async()=>{sends++;}});
 assert.equal((await api.sendMaintenanceReminderBatch()).sent,0);assert.equal(checks,2);assert.equal(sends,0);
});


