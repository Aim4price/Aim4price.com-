const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,mocks) { const exports={}; new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name in mocks?mocks[name]:require(name),exports);return exports; }
class Denied extends Error {constructor(message,status){super(message);this.status=status;}}
test('native checklist scope preserves role, assignment and separate record/schedule permissions',async()=>{
 let owner={ownerUserId:'owner',permissions:['view']}, assigned=true, fm=true, record=false, schedule=true, dealerRole=true, shared={ownerUserId:'owner',assetId:'asset',permissions:{canViewMaintenanceReports:true}}, session={user:{id:'dealer'},dealerApp:{role:'maintenance'}};
 const api=load('lib/app-maintenance-access.ts',{
 './owner-app-access':{getOwnerAppAccess:async()=>owner,ownerAppCan:(a,p)=>a.permissions.includes(p),ownerAppCanAccessAsset:()=>assigned},
 './field-manager-session':{requireActiveFieldManagerSession:async()=>fm?{ok:true,session:{ownerUserId:'owner',managerId:'manager'}}:{ok:false,status:401,error:'Sign in'}},
 './field-manager':{getFieldManagerAssetForOpen:async()=>assigned?{id:'asset'}:null,fieldManagerCan:async(_,p)=>p==='record_work'?record:schedule},
 './auth-session':{getServerSession:async()=>session,isDealerAppSession:s=>!!s.dealerApp},
 './dealer-app-access':{dealerRoleCan:()=>dealerRole},'./account-profile':{getAccountProfile:async()=>({accountType:'dealer',accountStatus:'active'})},
 './dealer-maintenance-tracker':{getDealerTrackedAsset:async()=>shared},'./external-lead-access':{ExternalLeadAccessError:Denied}
 });
 assert.equal((await api.resolveAppMaintenanceAccess({},'owner','asset')).canEdit,false);
 owner.permissions.push('operate');assert.equal((await api.resolveAppMaintenanceAccess({},'owner','asset')).canEdit,true);
 assigned=false;await assert.rejects(api.resolveAppMaintenanceAccess({},'owner','asset'),e=>e.status===403);await assert.rejects(api.resolveAppMaintenanceAccess({},'field-manager','asset'),e=>e.status===403);
 assigned=true;assert.deepEqual(await api.resolveAppMaintenanceAccess({},'field-manager','asset'),{ownerId:'owner',assetId:'asset',canRecord:false,canEdit:false,canSchedule:true,canRemove:false});
 fm=false;await assert.rejects(api.resolveAppMaintenanceAccess({},'field-manager','asset'),e=>e.status===401);
 assert.equal((await api.resolveAppMaintenanceAccess({},'dealer','access')).canRecord,false);
 shared.permissions={canAddMaintenance:true};assert.equal((await api.resolveAppMaintenanceAccess({},'dealer','access')).canEdit,true);
 shared.permissions={canViewParts:true};await assert.rejects(api.resolveAppMaintenanceAccess({},'dealer','access'),e=>e.status===403);
 dealerRole=false;await assert.rejects(api.resolveAppMaintenanceAccess({},'dealer','access'),e=>e.status===403);
 owner=null;await assert.rejects(api.resolveAppMaintenanceAccess({},'owner','asset'),e=>e.status===401);
});
test('native checklist mutations require trusted origin, edit permission and a fresh asset scope',async()=>{
 let editable=true, trusted=true, revoked=false, writes=0;
 const api=load('lib/app-maintenance-checklist-api.ts',{
 './app-maintenance-access':{resolveAppMaintenanceAccess:async()=>({ownerId:revoked?'other':'owner',assetId:'asset',canEdit:editable,canRecord:editable,canSchedule:editable})},
 './external-lead-access':{ExternalLeadAccessError:Denied},'./trusted-request-origin':{isTrustedRequestOrigin:()=>trusted},
 './asset-checklist-db':{addAssetChecklistItem:async(owner,id,input,check)=>{assert.equal(owner,'owner');assert.equal(id,'asset');if(input.revoke)revoked=true;await check();writes++;return input;},removeAssetChecklistItem:async()=>{},listAssetChecklistItems:async()=>[]},
 './asset-register-db':{},'./maintenance-catalogue-db':{},'./maintenance-catalogue':{},'./asset-checklist-report':{},'./report-pdf':{},'./asset-usage':{}
 });
 const request=input=>({method:'POST',headers:new Headers(),nextUrl:new URL('https://www.aim4price.com/api/native/checklist'),json:async()=>input});
 assert.equal((await api.appMaintenanceChecklist(request({label:'Inspect hose'}),'owner','asset')).status,201);
 editable=false;assert.equal((await api.appMaintenanceChecklist(request({}),'owner','asset')).status,403);
 editable=true;trusted=false;assert.equal((await api.appMaintenanceChecklist(request({}),'owner','asset')).status,403);
 trusted=true;assert.equal((await api.appMaintenanceChecklist(request({revoke:true}),'owner','asset')).status,403);assert.equal(writes,1);
});
test('dealer can submit unscheduled work without inventing a maintenance record id',async()=>{
 let calls=[],allow=true;
 const api=load('app/api/dealer/maintenance/[accessId]/route.ts',{
 '../../../../../lib/dealer-app-access':{dealerRoleCan:()=>allow},'../../../../../lib/trusted-request-origin':{isTrustedRequestOrigin:()=>true},
 '../../../../../lib/auth-session':{getServerSession:async()=>({user:{id:'dealer',name:'Dealer'},dealerApp:{role:'maintenance'}}),isDealerAppSession:()=>true},
 '../../../../../lib/account-profile':{getAccountProfile:async()=>({accountType:'dealer',accountStatus:'active'})},
 '../../../../../lib/dealer-maintenance-tracker':{recordDealerStandaloneMaintenance:async input=>{calls.push(input);return {asset:{assetId:'asset'}}},completeDealerTrackedMaintenance:async()=>{throw Error('Must not complete a schedule');}}
 });
 const req=body=>new Request('https://www.aim4price.com/api/dealer/maintenance/access',{method:'POST',body:JSON.stringify(body)});
 const body={maintenanceType:'checkup',linkToScheduledMaintenance:false,confirmedComplete:true,completedBy:'Mechanic',clientEventId:'retry-key'};
 assert.equal((await api.POST(req(body),{params:{accessId:'access'}})).status,200);
 assert.equal(calls[0].maintenanceId,'');assert.equal(calls[0].maintenanceType,'checkup');assert.equal(calls[0].clientEventId,'retry-key');
 assert.equal((await api.POST(req({...body,linkToScheduledMaintenance:true}),{params:{accessId:'access'}})).status,400);
 allow=false;assert.equal((await api.POST(req(body),{params:{accessId:'access'}})).status,403);assert.equal(calls.length,1);
});
