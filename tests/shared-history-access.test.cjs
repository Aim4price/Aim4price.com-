const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>{if(n in mocks)return mocks[n];throw Error(`Unexpected dependency: ${n}`);},exports);return exports;}
class Denied extends Error{constructor(message,status=403){super(message);this.status=status;}}
const permissions=load('lib/external-share-permissions.ts');
test('history is opt-in, including legacy and read-only links',()=>{
 for(const value of [undefined,{}, {allReports:true,updateDetails:true}, {history:'true'}]) assert.equal(permissions.assetLinkPermissions(value).history,false);
 const selected=permissions.readOnlyAssetLinkPermissions({history:true,maintenanceReports:true,costOfOwnership:false,updateDetails:true,addCosts:true,suggestValue:true});
 assert.equal(selected.history,true);assert.equal(selected.maintenanceReports,true);assert.equal(selected.costOfOwnership,false);
 for(const key of ['updateDetails','addCosts','suggestValue','serialNumber','maintenanceSchedules'])assert.equal(selected[key],false);
 assert.equal(permissions.readOnlyAssetLinkPermissions().history,false);
});
function fixture(){
 const state={allowed:new Set(),owner:false,reads:0,restores:0};
 const scope={ownerId:'owner',assetId:'asset',get user(){return {id:state.owner?'owner':'recipient'};},lock:async()=>{}};
 const mocks={
 './asset-history-restore':{restoreAssetDetails:async()=>{state.restores++;return {ok:true};}},
 './asset-history':{historyPaperworkFields:['insurance_policy_number'],listUnifiedAssetHistory:async(o,a,options)=>{state.reads++;return options;}},
 './asset-history-report':{assetHistoryPdfResponse:async(r,o,a,options)=>{state.reads++;return {status:200,pdf:options};}},
 './shared-asset-contributions':{contributionScope:async(t,p)=>{if(!state.owner&&!state.allowed.has(p))throw new Denied('Not shared');return scope;}},
 './asset-register-db':{getAssetRegisterItemById:async()=>({id:'asset'})},
 './business-network-api':{businessJson:(data,status=200)=>({data,status}),businessError:e=>({status:e.status||400}),requireBusinessOrigin:()=>{},businessBody:r=>r.json()},
 './external-lead-access':{ExternalLeadAccessError:Denied},
 };
 for(const name of ['asset-usage','db','my-invoices','maintenance-catalogue','asset-checklist-db','asset-maintenance','shared-asset-activity','sharing-foundation','business-network'])mocks['./'+name]={};
 const {sharedAssetWork}=load('lib/shared-asset-work.ts',mocks);
 return {state,call:(target,method='GET',query='')=>sharedAssetWork({method,nextUrl:new URL('https://example.test/history'+query),json:async()=>({eventId:'10000000-0000-4000-8000-000000000001',confirmed:true})},target,'history')};
}
for(const target of [{leadId:'lead'},{token:'token',assetId:'asset'}])test(`history API requires explicit permission and rejects recipient restores (${Object.keys(target)[0]})`,async()=>{
 const x=fixture();x.state.allowed.add('updateDetails');
 for(const query of ['', '?format=pdf'])assert.equal((await x.call(target,'GET',query)).status,403);
 assert.equal(x.state.reads,0);
 x.state.allowed=new Set(['history']);
 const response=await x.call(target);assert.equal(response.status,200);assert.equal(response.data.owner,false);assert.deepEqual(response.data.categories,['details']);assert.ok(!response.data.detailFields.includes('insurance_policy_number'));
 assert.equal((await x.call(target,'POST')).status,403);assert.equal(x.state.restores,0);
 x.state.allowed.add('maintenanceReports');x.state.allowed.add('costOfOwnership');
 const pdf=await x.call(target,'GET','?format=pdf');assert.equal(pdf.status,200);assert.equal(pdf.pdf.owner,false);assert.deepEqual(pdf.pdf.categories,['details','maintenance','costs']);
 x.state.allowed.clear();assert.equal((await x.call(target)).status,403);
 x.state.owner=true;assert.equal((await x.call(target)).data.owner,true);assert.equal((await x.call(target,'POST')).status,200);assert.equal(x.state.restores,1);
});
test('history uses signed-in read access and the dedicated dealer permission column',async()=>{
 const state={allow:false,write:null};
 const mocks={
 './asset-history-schema':{setAssetHistoryActor:async()=>{}},
 './live-shared-asset-access':{requireLiveSharedAsset:async(token,asset,permission,write)=>{state.write=write;assert.equal(permission,'history');return {lead:{ownerId:'owner'},user:{id:'recipient'},assetId:asset};}},
 './db':{getDb:()=>({query:async(sql)=>{assert.match(sql,/a\.can_view_history=true/);assert.match(sql,/a\.is_active=true/);return {rows:state.allow?[{id:'access'}]:[]};}})},
 './auth-session':{getServerSession:async()=>({user:{id:'recipient'}})},
 './account-profile':{getAccountProfile:async()=>({accountType:'dealer',accountStatus:'active'})},
 './dealer-maintenance-tracker':{ensureDealerMaintenanceTrackerTables:async()=>{}},
 './external-lead-access':{ExternalLeadAccessError:Denied},
 './partner-access':{getAssetLeadForPartner:async()=>({ownerUserId:'owner',assetRegisterItemId:'asset'})},
 './asset-register-db':{},'./asset-register-uploads':{},'./my-invoices':{},'./sharing-foundation':{},
 };
 const {contributionScope}=load('lib/shared-asset-contributions.ts',mocks);
 await contributionScope({token:'token',assetId:'asset'},'history');assert.equal(state.write,false);
 await assert.rejects(contributionScope({leadId:'lead'},'history'),e=>e.status===403);
 state.allow=true;const scope=await contributionScope({leadId:'lead'},'history');assert.equal(scope.ownerId,'owner');
 state.allow=false;await assert.rejects(scope.lock(mocks['./db'].getDb()),e=>e.status===403);
});
