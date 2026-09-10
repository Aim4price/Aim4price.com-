const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function load(file,mocks={}){
 const filename=path.resolve(file),exports={};
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 const req=name=>Object.hasOwn(mocks,name)?mocks[name]:name.startsWith('.')?load(path.resolve(path.dirname(filename),name+'.ts'),mocks):require(name);
 new Function('require','exports','module',code)(req,exports,{exports});return exports;
}
const policy=load('lib/listing-alert-policy.ts');
const watch={enabled:true,delivery:'daily',filters:{...policy.EMPTY_LISTING_FILTERS,sector:'agricultural',family:'tractors',query:'Kubota',province:'Western Cape',minPrice:100000,maxPrice:500000}};
const listing={id:'asset-public',sectorKey:'agricultural',familyKey:'tractors',title:'2021 Kubota',brandName:'Kubota',modelName:'EK6090',province:'Western Cape',askingPriceExVat:420000};
test('listing interests require relevant, bounded criteria and reject identity injection',()=>{
 assert.deepEqual(policy.parseListingWatch(watch),watch);
 for(const change of [{accountId:'other'},{filters:{...watch.filters,maxPrice:NaN}},{filters:{...watch.filters,minPrice:600000}},{filters:{...watch.filters,sector:'private'}},{filters:{...policy.EMPTY_LISTING_FILTERS}},{delivery:'spam'}])assert.throws(()=>policy.parseListingWatch({...watch,...change}));
});
test('matches respect every selected field, inclusive price boundaries and family normalization',()=>{
 assert.equal(policy.matchesListingWatch(watch.filters,listing),true);
 for(const change of [{sectorKey:'motor'},{familyKey:'combines'},{brandName:'Other',title:'Other'},{province:'Gauteng'},{askingPriceExVat:500001},{askingPriceExVat:99999}])assert.equal(policy.matchesListingWatch(watch.filters,{...listing,...change}),false);
 assert.equal(policy.matchesListingWatch({...watch.filters,family:'orchard_tractors'},{...listing,familyKey:'orchard-tractors',askingPriceExVat:500000}),true);
});
const {notificationDeliveryPlan:plan}=load('lib/notification-delivery-plan.ts');
const event=(id,extra={})=>({id,category:'listings',title:id,body:'',href:'/dealer/marketplace',createdAtIso:'2026-09-10T15:00:00Z',delivery:'daily',...extra});
test('daily matching listings produce one daytime summary and never replay sent or read items',()=>{
 const matches=[event('a'),event('b'),event('read',{isRead:true})];
 assert.equal(plan(matches,new Set(),{listings:true},new Date('2026-09-01'),'dealer',new Date('2026-09-10T16:00Z')).length,0);
 const result=plan(matches,new Set(),{listings:true},new Date('2026-09-01'),'dealer',new Date('2026-09-11T07:00Z'));
 assert.equal(result.length,1);assert.deepEqual(result[0].ids,['listing-digest:2026-09-11','a','b']);assert.equal(result[0].event.href,'/dealer/notifications?category=listings');
 assert.equal(plan(matches,new Set(result[0].ids),{listings:true},new Date('2026-09-01'),'dealer',new Date('2026-09-11T09:00Z')).length,0);
 assert.equal(plan(matches,new Set(),{listings:true},new Date('2026-09-01'),'dealer',new Date('2026-09-11T02:00Z')).length,0);
});
test('urgent business updates precede instant listings; disabled categories and old transactions stay silent',()=>{
 const events=[event('stock',{delivery:'instant'}),event('lead',{category:'enquiries'}),event('old',{category:'enquiries',createdAtIso:'2025-01-01'})];
 const result=plan(events,new Set(),{listings:true,enquiries:true},new Date('2026-01-01'),'middleman');assert.deepEqual(result.map(x=>x.event.id),['lead','stock']);
 assert.equal(plan(events,new Set(),{listings:false,enquiries:false},new Date('2026-01-01'),'middleman').length,0);
});
const who={app:'dealer',accountId:'account',memberId:'member',version:1};
test('read state isolates app, account and member, even when event IDs overlap',async()=>{
 const saved=[];const state=load('lib/app-notification-state.ts',{'./app-notification-read-state':{markNotificationEventKeysRead:async(...args)=>saved.push(args)}});
 for(const identity of [who,{...who,app:'middleman'},{...who,accountId:'other'},{...who,memberId:'colleague'}])await state.markAppNotificationKeys(identity,['same']);
 assert.equal(new Set(saved.map(x=>x[0])).size,4);
});
function eventsFixture({read=[],app='dealer'}={}){
 return load('lib/push-events.ts',{
  './listing-alerts':{listMatchingListingEvents:async()=>[event('listing')]},'./app-notification-state':{readAppNotificationKeys:async()=>new Set(read)},
  './notifications':{listComputedHeaderNotifications:async()=>[
   {id:'lead',category:'lead',title:'Lead',createdAtIso:'2026-09-10'},
   {id:'discovery',category:'asset_discovery',assetDiscoveryEnquiryId:'enquiry',createdAtIso:'2026-09-10'},
   {id:'sourcing',category:'marketplace_sourcing',marketplaceSourcingRequestId:'request',createdAtIso:'2026-09-10'}]},
  './notification-inbox':{},'./asset-maintenance':{},'./asset-license-renewal':{},'./db':{},
  './dealer-maintenance-notification-inbox':{listDealerMaintenanceNotificationsForViewer:async()=>[{id:'maintenance',accessId:'access',status:'due',isRead:false,createdAtIso:'2026-09-10'}]},
 });
}
test('dealer inbox and phone events include business updates with exact app destinations',async()=>{
 const f=eventsFixture({read:['sourcing']});const access={categories:['enquiries','maintenance'],viewerKey:'staff',canLead:true,canSource:true,canDiscover:true};
 const inbox=await f.listPushEvents(who,access,{includeRead:true});assert.equal(inbox.length,4);
 assert.equal(inbox.find(x=>x.id==='sourcing').href,'/dealer/notifications/sourcing/request');
 assert.equal(inbox.find(x=>x.id==='discovery').href,'/dealer/notifications/enquiry/enquiry');
 assert.equal(inbox.find(x=>x.id==='maintenance').href,'/dealer/maintenance/access');
 assert.equal((await f.listPushEvents(who,access)).some(x=>x.id==='sourcing'),false);
});
test('middleman never gets dealer leads, and parts staff never get marketplace requests',async()=>{
 const f=eventsFixture();const access={categories:['enquiries'],canLead:true,canSource:true,canDiscover:true};
 const middleman=await f.listPushEvents({...who,app:'middleman'},access);assert.deepEqual(middleman.map(x=>x.id),['discovery','sourcing']);
 assert.ok(middleman.every(x=>x.href.startsWith('/middleman/')));
 const parts=await f.listPushEvents(who,{...access,canSource:false});assert.deepEqual(parts.map(x=>x.id),['lead','discovery']);
});
test('read mutations ignore IDs that no longer belong to this recipient',async()=>{
 const saved=[];const f=load('lib/app-notification-inbox.ts',{'./app-notification-history':{withAppNotificationHistory:async(_who,_access,events)=>events},'./push-events':{listPushEvents:async()=>[event('visible')]},'./push-access':{resolvePushAccess:async()=>({})},'./app-notification-state':{markAppNotificationKeys:async(...args)=>saved.push(args)}});
 await f.markAppNotificationsRead(who,['visible','other-user']);assert.deepEqual(saved,[[who,['visible']]]);
});
test('owner operations users cannot see financial, commercial or unscoped private notifications',async()=>{
 const items=[{id:'cost',category:'dealer_cost',assetId:'allowed'},{id:'private',category:'maintenance',assetId:'private'},{id:'global',category:'admin_message'},{id:'work',category:'maintenance',assetId:'allowed'}];
 const f=load('lib/owner-notification-inbox.ts',{'./app-notification-history':{},'./notification-inbox':{listNotificationInbox:async()=>items},'./owner-app-access':{ownerAppCan:(access,p)=>access.permissions.includes(p)},'./push-access':{currentPushIdentity:async()=>null},'./push-events':{},'./app-notification-state':{}});
 const result=await f.listOwnerNotificationInbox({ownerUserId:'account',assetScope:'selected',accessibleAssetIds:['allowed'],permissions:['view','operate']});assert.deepEqual(result.map(x=>x.id),['work']);
});
test('listing events reuse live public stock and exclude own, withdrawn and nonmatching assets',async()=>{
 const queries=[];
 const f=load('lib/listing-alerts.ts',{'./db':{getDb:()=>({query:async(sql,args)=>{queries.push([sql,args]);return sql.startsWith('select enabled')?{rows:[watch]}:{rows:[{listing_key:'asset-public',first_published_at:'2026-09-10'},{listing_key:'own',first_published_at:'2026-09-10'},{listing_key:'withdrawn',first_published_at:'2026-09-10'}]};}})},'./marketplace-db':{ensureMarketplaceColumns:async()=>{},listPublishedMarketplaceAssetListings:async()=>[listing,{...listing,id:'own',canManage:true},{...listing,id:'unpublished'}]}});
 const events=await f.listMatchingListingEvents(who);assert.equal(events.length,1);assert.equal(events[0].id,'listing:asset-public');assert.equal(events[0].delivery,'daily');
 assert.deepEqual(queries[1][1],['dealer','account','member']);assert.match(queries[1][0],/p.seller_id<>\$2/);assert.match(queries[1][0],/seller.account_status='active'/);
});
test('listing settings reject cross-origin requests before looking up any account',async()=>{
 const f=load('app/api/app-notifications/listings/route.ts',{'../../../../lib/push-access':{currentPushIdentity:()=>{throw Error('Must not run');}},'../../../../lib/listing-alerts':{}});
 const r=await f.POST(new Request('https://www.aim4price.com/api/app-notifications/listings',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'}));assert.equal(r.status,403);
});
test('history keeps resolved updates but removes revoked asset shares and newly forbidden categories',async()=>{
 const rows=[{event:{...event('completed',{category:'maintenance'}),assetId:'allowed'}},{event:{...event('revoked',{category:'maintenance'}),assetId:'private'}},{event:{...event('commercial',{category:'enquiries'}),sourceCategory:'marketplace_sourcing'}}];
 const f=load('lib/app-notification-history.ts',{'./db':{getDb:()=>({query:async(sql)=>sql.startsWith('select event')?{rows}:sql.startsWith('select asset')?{rows:[{asset_id:'allowed'}]}:{rows:[]}})},'./app-notification-state':{appNotificationViewer:()=> 'dealer:account:member',readAppNotificationKeys:async()=>new Set()}});
 const result=await f.withAppNotificationHistory(who,{categories:['maintenance','enquiries'],canSource:false},[]);
 assert.deepEqual(result.map(x=>x.id),['completed']);assert.equal(result[0].isRead,true);
});
test('owners receive invoice approvals and cost warnings without re-pushing checked decisions',async()=>{
 const f=load('lib/push-events.ts',{
  './listing-alerts':{listMatchingListingEvents:async()=>[]},'./app-notification-state':{readAppNotificationKeys:async()=>new Set()},
  './notifications':{listComputedHeaderNotifications:async()=>[{id:'invoice',category:'capture',createdAtIso:'2026-09-10'},{id:'budget',category:'cost_budget',createdAtIso:'2026-09-10'},{id:'read',category:'capture',createdAtIso:'2026-09-10'}]},
  './notification-inbox':{listNotificationInbox:async()=>[{id:'invoice'},{id:'budget'},{id:'read',isRead:true}]},
  './asset-maintenance':{listAssetMaintenanceRecords:async()=>[]},'./asset-license-renewal':{},'./dealer-maintenance-notification-inbox':{},'./db':{getDb:()=>({query:async()=>({rows:[]})})},
 });
 const result=await f.listPushEvents({...who,app:'owner'},{admin:true,categories:['approvals','costs'],viewerKey:'user:member'});
 assert.deepEqual(result.map(x=>[x.id,x.category]),[['invoice','approvals'],['budget','costs']]);
});
