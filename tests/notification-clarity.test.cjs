const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,mocks={}) {
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(name=>{
    if(Object.hasOwn(mocks,name))return mocks[name];
    throw Error('Missing mock '+name);
  },module,module.exports);
  return module.exports;
}
const {normalizeNotificationCopy:normalize}=load('lib/notification-copy.ts');
test('historical shares retain names, asset punctuation, messages and read state',()=>{
  const original={id:'lead-partner:share:sent:timestamp',title:'New lead opportunity',body:'Farm sent a replacement quote opportunity for New Holland TT4.90. Message: Need replacement quote.',isRead:true,archivedAtIso:'2026-01-01',href:'/leads'};
  const corrected=normalize(original);
  assert.equal(corrected.body,'Farm has shared New Holland TT4.90 with you. Message: Need replacement quote.');
  assert.equal(corrected.title,'Asset shared with you');
  assert.equal(corrected.id,original.id);assert.equal(corrected.isRead,true);assert.equal(corrected.archivedAtIso,original.archivedAtIso);
  assert.deepEqual(normalize(corrected),corrected,'normalization is idempotent');
  assert.deepEqual(normalize({...original,id:'admin-message:1'}),{...original,id:'admin-message:1'},'user-authored messages are untouched');
});
test('historical share statuses describe opening, handling and removal accurately',()=>{
  for(const [status,title,body] of [
    ['viewed','Asset received and opened','New Holland TT4.90 has been received and opened by Business.'],
    ['accepted','Asset received and opened','New Holland TT4.90 has been received and opened by Business.'],
    ['quoted','Shared asset handled','Business marked New Holland TT4.90 as handled.'],
    ['declined','Shared asset removed','Business removed New Holland TT4.90 from their shared assets. Your Asset Register is unchanged.'],
  ]) {
    const item=normalize({id:`lead-owner:share:${status}:timestamp`,title:`Replacement quote lead ${status}`,body:`Business ${status} your replacement quote request for New Holland TT4.90.`});
    assert.equal(item.title,title);assert.equal(item.body,body);
  }
});
test('history does not claim a proposed change is already applied or an old invoice is currently unpaid',()=>{
  const item=normalize({id:'dealer-correction:1',title:'Dealer updated asset details',body:'Workshop updated the serial number from A to B for Tractor. Accept the change to update your Asset Register.'});
  assert.equal(item.title,'Asset detail changes proposed');
  assert.match(item.body,/suggested changing/);assert.match(item.body,/Review and accept/);
  assert.equal(normalize({id:'billing-invoice:1',title:'New Aim4price.com invoice',body:'Original invoice'}).title,'Invoice issued');
  assert.equal(normalize({id:'asset-discovery-requester:1',title:'Asset unavailable for 90 days',body:'Owner declined'}).title,'Owner is not selling currently');
});
test('licence alerts distinguish soon, today and overdue and respect dismissal',()=>{
  const api=load('lib/asset-license-renewal.ts',{'./db':{},'./asset-registers':{}});
  const asset={id:'asset',kind:'vehicle',isLicensed:true,licenseRegistrationNumber:'CA 123',specsJson:{licenseRenewalDate:'2026-11-01'}};
  for(const [today,expected] of [['2026-10-31','Licence renewal due soon'],['2026-11-01','Licence renewal due today'],['2026-11-02','Licence renewal overdue']]) {
    const result=api.buildAssetLicenseRenewalAlert(asset,null,today);assert.equal(result.heading,expected);assert.match(result.body,/CA 123/);
  }
  assert.equal(api.buildAssetLicenseRenewalAlert(asset,'2026-11-01','2026-11-02'),null);
});
test('invoice wording uses South African date and outstanding balance, including partial and full payments',async()=>{
  const shared=load('lib/billing-shared.ts');
  const rows=[
    {id:'past',paid_cents:2500,due_date:'2026-10-31'},
    {id:'today',paid_cents:0,due_date:'2026-11-01'},
    {id:'future',paid_cents:0,due_date:'2026-11-02'},
    {id:'paid',paid_cents:10000,due_date:'2026-10-31'},
  ].map(row=>({...row,number:row.id,total_cents:10000,issued_at:'2026-10-01'}));
  const api=load('lib/billing-notifications.ts',{'./db':{getDb:()=>({query:async(_sql,args)=>{assert.deepEqual(args,['owner']);return {rows};}})},'./billing':{ensureBillingSchema:async()=>{}},'./billing-shared':{...shared,dateKey:()=> '2026-11-01'}});
  const notices=await api.listBillingNotifications('owner');
  assert.deepEqual(notices.map(n=>n.title),['Invoice overdue','Invoice payment due today','Invoice issued','Invoice paid']);
  assert.ok(notices[0].body.includes(`${shared.money(7500)} outstanding of ${shared.money(10000)}`));
  assert.match(notices[3].body,/Paid in full/);assert.doesNotMatch(notices[3].body,/outstanding|Was due/);
  assert.equal(shared.dateKey(new Date('2026-10-31T22:30:00Z')),'2026-11-01');
});
test('assigned field-manager maintenance retains urgency and keeps per-viewer read state',async()=>{
  const api=load('lib/field-manager-notifications.ts',{
    './asset-issue-notes':{listOpenIssueNoteGroupsForAssets:async()=>[]},
    './field-manager':{listFieldManagerAssets:async()=>[{id:'asset',title:'Tractor'}]},
    './asset-maintenance':{listAssetMaintenanceRecords:async()=>['due_soon','due','overdue'].map(status=>({id:status,assetId:'asset',assetTitle:'Tractor',title:'Oil service',maintenanceType:'service',computedStatus:status,assignedFieldManagerId:'manager',triggerType:'usage',dueUsage:1500,usageMetric:'hours',updatedAtIso:'2026-11-01'}))},
    './app-notification-read-state':{listReadNotificationEventKeys:async()=>new Set(['field-manager-maintenance:overdue:overdue'])},
  });
  const notices=await api.listFieldManagerNotifications({ownerUserId:'owner',managerId:'manager'});
  assert.equal(notices[0].title,'Service overdue — assigned to you');assert.equal(notices[0].isRead,true);
  assert.ok(notices.some(n=>n.title==='Service due now — assigned to you'));
  assert.ok(notices.some(n=>n.title==='Service due soon — assigned to you'));
});
test('dealer maintenance keeps only the current urgency active and preserves each staff member’s read state',async()=>{
  const source=fs.readFileSync('lib/dealer-maintenance-tracker.ts','utf8');
  const start=source.indexOf('export async function syncDealerMaintenanceNotifications(');
  const end=source.indexOf('export async function markDealerMaintenanceNotificationsRead(',start);
  const code=ts.transpileModule(source.slice(start,end),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  let assets=[{accessId:'access',assetId:'asset',maintenanceRecords:[{id:'record',computedStatus:'overdue'}]}];
  const rows=['due_soon','due','overdue'].map(status=>({id:status,access_id:'access',asset_register_item_id:'asset',maintenance_record_id:'record',notification_status:status,title:status,body:'Tractor',read_at:null,created_at:'2026-11-01'}));
  const db={query:async sql=>{
    if(sql.includes('from public.dealer_maintenance_notifications')) {
      assert.match(sql,/access\.is_active = true/);assert.match(sql,/asset\.user_id = access\.owner_user_id/);assert.match(sql,/lifecycle_state/);
      return {rows};
    }
    return {rows:[]};
  }};
  const exports={};
  new Function('exports','ensureDealerMaintenanceTrackerTables','listDealerTrackedAssets','getDb','notificationBody','iso',code)(exports,async()=>{},async()=>assets,()=>db,()=> 'Tractor',v=>v);
  let notices=await exports.listDealerMaintenanceNotifications('dealer');
  assert.deepEqual(notices.map(n=>n.isCurrent),[false,false,true]);
  const inbox=load('lib/dealer-maintenance-notification-inbox.ts',{
    './dealer-maintenance-tracker':{listDealerMaintenanceNotifications:async()=>notices.map(n=>({...n,isRead:true}))},
    './db':{getDb:()=>db},
    './app-notification-read-state':{listReadNotificationEventKeys:async key=>key==='staff-a'?new Set(['dealer-notification:overdue']):new Set()},
  });
  const a=await inbox.listDealerMaintenanceNotificationsForViewer({dealerUserId:'dealer',viewerKey:'staff-a'});
  const b=await inbox.listDealerMaintenanceNotificationsForViewer({dealerUserId:'dealer',viewerKey:'staff-b'});
  assert.ok(a.every(n=>n.isRead));assert.deepEqual(b.map(n=>n.isRead),[true,true,false]);
  assets=[];notices=await exports.listDealerMaintenanceNotifications('dealer');
  assert.ok(notices.every(n=>!n.isCurrent&&n.isRead),'completed or no longer due work is history');
});
