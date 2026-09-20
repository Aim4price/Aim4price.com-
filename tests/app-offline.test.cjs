const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
function load(file, mocks) {
  const module={exports:{}};
  const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  Function('module','exports','require',js)(module,module.exports,name=>name in mocks?mocks[name]:require(name));return module.exports;
}
function request(app, body, identity, method='POST') {
  return new NextRequest(`https://www.aim4price.com/api/app-offline/${app}/sync`,{method,headers:{origin:'https://www.aim4price.com','x-aim4price-offline-identity':identity||'','content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
}
function accessHelper(app,{staff='staff1',role='technician',subtype=false,realm=app}={}) {
  return load('lib/app-offline-access.ts',{
    './app-realm-server':{currentAppRealm:async()=>realm},
    './owner-app-access':{getOwnerAppAccess:async()=>({ownerUserId:'owner1',ownerAppUserId:staff,viewerKey:'user:'+staff,displayName:'Owner staff',permissions:role==='view_only'?['view']:['view','operate']}),ownerAppCan:(a,p)=>a.permissions.includes(p)},
    './field-manager-session':{requireActiveFieldManagerSession:async()=>({ok:true,session:{ownerUserId:'owner1',managerId:staff,displayName:'Field staff'}})},
    './field-manager':{fieldManagerCan:async()=>role!=='view_only'},
    './auth-session':{getServerSession:async()=>({user:{id:'dealer1'},dealerApp:{staffId:staff,role,displayName:'Dealer staff'}}),isDealerAppSession:()=>true},
    './account-profile':{getAccountProfile:async()=>({accountType:'dealer',accountStatus:'active',accountSubtype:subtype})},
    './dealer-app-access':load('lib/dealer-app-access.ts',{}),
    './middleman-account':{isMiddlemanAccountSubtype:v=>v===true},
    './notification-request-origin':{isTrustedNotificationRequest:req=>req.headers.get('origin')==='https://www.aim4price.com'},
  });
}
for(const app of ['owner','field','dealer','middleman']) test(`${app}: only the original app and actor may sync`,async()=>{
  const h=accessHelper(app,{subtype:app==='middleman'});
  const identity=(await h.requireAppOfflineAccess(request(app,null,null,'GET'),app)).access.identity;
  assert.equal((await h.requireAppOfflineAccess(request(app,{},identity),app)).ok,true);
  assert.equal((await h.requireAppOfflineAccess(request(app,{},identity+'other'),app)).response.status,409);
  const switched=accessHelper(app,{staff:'different',subtype:app==='middleman'});
  assert.equal((await switched.requireAppOfflineAccess(request(app,{},identity),app)).response.status,409);
  assert.equal((await accessHelper(app,{realm:'wrong'}).requireAppOfflineAccess(request(app,{},identity),app)).response.status,403);
});
test('view-only owner and technician dealer retain their exact offline permissions',async()=>{
  const owner=await accessHelper('owner',{role:'view_only'}).requireAppOfflineAccess(request('owner',null,null,'GET'),'owner');assert.equal(owner.access.canWork,false);assert.equal(owner.access.canFuel,false);
  const dealer=await accessHelper('dealer').requireAppOfflineAccess(request('dealer',null,null,'GET'),'dealer');assert.equal(dealer.access.canWork,true);assert.equal(dealer.access.canShowroom,false);assert.equal(dealer.access.canLeads,false);
});
test('dealer and middleman account subtypes cannot cross app boundaries',async()=>{
  for(const app of ['dealer','middleman']) assert.equal((await accessHelper(app,{subtype:app!=='middleman'}).requireAppOfflineAccess(request(app,null,null,'GET'),app)).response.status,403);
});
function syncRoute(access, overrides={}) {
  const calls=[];
  const handler=async req=>{calls.push(await req.json());return NextResponse.json({ok:true,asset:{id:'asset'}});};
  const errors=(error,status=400)=>NextResponse.json({ok:false,error},{status});
  const route=load('app/api/app-offline/[app]/sync/route.ts',{
    '../../../../../lib/app-offline-access':{requireAppOfflineAccess:async()=>({ok:true,access}),offlineError:errors,offlineHeaders:{}},
    '../../../../../lib/owner-app-access':{ownerAppCanAccessAsset:(a,id)=>id==='allowed'},
    '../../../../../lib/field-manager':{getFieldManagerAssetForOpen:async()=>null},
    '../../../../../lib/app-offline-notes':{saveOfflineNote:async()=>{throw Error('Unexpected note');}},
    '../../../../../lib/fuel-ledger':{saveFuelSlipTransaction:async()=>{throw Error('Unexpected slip');}},
    '../../../../../lib/dealer-maintenance-tracker':{getDealerTrackedAsset:async()=>null},
    '../../../../../lib/asset-maintenance':{completeAssetMaintenanceRecord:async()=>{throw Error('Unexpected completion');}},
    '../../../scan/assets/[publicAssetCode]/event/route':{POST:handler},
    '../../../fuel-scan/storage/[publicFuelStorageCode]/issue/route':{POST:handler},
    '../../../fuel-scan/storage/[publicFuelStorageCode]/refill/route':{POST:handler},
    '../../../fuel-scan/storage/[publicFuelStorageCode]/dipstick/route':{POST:handler},...overrides,
  });return {route,calls};
}
const item={kind:'work',assetId:'allowed',code:'A4P-TEST',payload:{clientEventId:'app-offline:stable-id'}};
test('owner asset restrictions are rechecked before work, tank fuel or fuel slips',async()=>{
  const {route,calls}=syncRoute({app:'owner',identity:'owner1:user1',owner:{},canWork:true,canFuel:true});
  for(const kind of ['work','fuel-issue','fuel-slip']) assert.equal((await route.POST(request('owner',{...item,kind,assetId:'denied'}),{params:{app:'owner'}})).status,403);
  assert.equal(calls.length,0);
});
test('app work keeps stable retry IDs; legacy field queue IDs survive the upgrade unchanged',async()=>{
  const {route,calls}=syncRoute({app:'field',identity:'owner1:manager1',canWork:true});
  for(let i=0;i<2;i++) await route.POST(request('field',item),{params:{app:'field'}});
  assert.equal(calls[0].clientEventId,calls[1].clientEventId);assert.match(calls[0].clientEventId,/^[a-f0-9]{64}$/);
  await route.POST(request('field',{...item,payload:{clientEventId:'field-offline:old-stable-id'}}),{params:{app:'field'}});
  assert.equal(calls[2].clientEventId,'field-offline:old-stable-id');
});
test('an ambiguous scan failure stays retryable rather than editable',async()=>{
  const {route}=syncRoute({app:'field',identity:'owner1:manager1',canWork:true},{'../../../scan/assets/[publicAssetCode]/event/route':{POST:async()=>NextResponse.json({ok:false,error:'Failed to save update.'},{status:400})}});
  assert.equal((await route.POST(request('field',item),{params:{app:'field'}})).status,503);
});
test('middleman cannot submit maintenance or fuel even with a crafted queued payload',async()=>{
  const {route,calls}=syncRoute({app:'middleman',identity:'middleman1:user1',canWork:false,canFuel:false});
  for(const kind of ['work','fuel-issue','dealer-maintenance']) assert.equal((await route.POST(request('middleman',{...item,kind}),{params:{app:'middleman'}})).status,403);
  assert.equal(calls.length,0);
});
test('owner snapshot excludes inaccessible, inactive and fuel-excluded assets from operational choices',async()=>{
  const snapshot=load('lib/app-offline-snapshot.ts',{
    './field-manager':{ensureFieldManagerAssetPublicCodes:async()=>{},listFieldManagerFuelStorages:async()=>[]},
    './asset-registers':{ensureAssetRegisterTables:async()=>{},listAssetRegisters:async()=>[{id:'r'}]},
    './asset-register-db':{listAssetRegisterItems:async()=>[{id:'allowed',title:'Tractor',qrStatus:'active'},{id:'denied',qrStatus:'active'},{id:'inactive',qrStatus:'deleted'}]},
    './owner-app-access':{ownerAppCanAccessAsset:(a,id)=>id!=='denied'},
    './asset-usage':{resolveAssetUsage:()=>({value:100,metric:'hours'})},
    './asset-maintenance':{listAssetMaintenanceRecords:async()=>[{id:'t',assetId:'allowed',status:'upcoming'},{id:'x',assetId:'denied',status:'upcoming'}]},
    './maintenance-catalogue-db':{getMaintenanceCatalogue:async()=>({})},'./maintenance-catalogue':{resolveMaintenanceChecklist:()=>({items:[]})},
    './fuel-ledger':{listFuelAssetsForUser:async()=>[{id:'allowed',isActive:true,canReceiveFuel:true,workUseExcluded:true}]},
    './dealer-maintenance-tracker':{},'./marketplace-db':{},'./partner-access':{},'./app-offline-notes':{},
  });
  const s=await snapshot.buildAppOfflineSnapshot({app:'owner',owner:{},userId:'owner1',canFuel:true});
  assert.deepEqual(s.assets.map(a=>a.id),['allowed']);assert.equal(s.assets[0].canReceiveFuel,false);assert.deepEqual(s.tasks.map(t=>t.id),['t']);
});
