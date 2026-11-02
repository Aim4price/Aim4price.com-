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
 assert.match(email.html,/aim4price-mark-black.png/);assert.match(email.html,/View maintenance/);
 assert.match(email.text,/last recorded usage/);assert.match(email.subject,/almost due/);
});
test('overdue wording is distinct and empty optional rows are omitted',()=>{
 const email=load().maintenanceReminderEmail({...record,computedStatus:'overdue',triggerType:'date',dueDate:'2026-11-02',recurringEnabled:false},'','','https://www.aim4price.com/maintenance');
 assert.match(email.subject,/overdue/);assert.match(email.text,/2026-11-02/);
 assert.doesNotMatch(email.html,/Last recorded usage|Serial \/ VIN|Scheduled by|Every 250/);
});
