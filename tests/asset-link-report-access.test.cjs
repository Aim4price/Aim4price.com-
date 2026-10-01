const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
const {NextRequest,NextResponse}=require('next/server');
function load(file,deps){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>deps[name] || {},exports);return exports;}
const A='10000000-0000-4000-8000-000000000001';
for(const [file,path,selector,broadQueries] of [
 ['app/api/asset-register/export/route.ts','/api/asset-register/export',`assetIds=${A}`,['','scope=all',`assetIds=${A},20000000-0000-4000-8000-000000000002`,`assetIds=${A}&groupId=other`,`assetIds=${A}&registerId=other`]],
 ['app/api/asset-map/report/route.ts','/api/asset-map/report',`assetId=${A}`,['','ids=other',`assetId=${A}&codes=other`,`assetId=${A}&assetId=other`,`assetId=${A}&registerId=all`]],
])test(`${path}: shared requests cannot bypass authorisation or widen the asset scope`,async()=>{
 let checks=[];
 const route=load(file,{
  'next/server':{NextResponse},
  '../../../../lib/auth-session':{getServerSession:async()=>({user:{id:'recipient',email:'recipient@example.test'}})},
  '../../../../lib/live-shared-asset-access':{requireLiveSharedAsset:async(...args)=>{checks.push(args);throw Error('Revoked or unauthorised');}},
  '../../../../lib/owner-workspace-access':{resolveOwnerWorkspaceContext:async()=>{throw Error('Must not fall back to owner access');}},
 });
 for(const query of broadQueries){const result=await route.GET(new NextRequest(`https://example.test${path}?shareToken=token&format=xlsx&${query}`));assert.equal(result.status,403);}
 assert.equal(checks.length,0,'Reject broadened scope before looking up the link');
 assert.equal((await route.GET(new NextRequest(`https://example.test${path}?shareToken=token&format=xlsx&${selector}`))).status,403);
 assert.deepEqual(checks,[['token',A,'allReports']]);
});

for(const [file,path,selector] of [
 ['app/api/asset-register/export/route.ts','/api/asset-register/export',`assetIds=${A}`],
 ['app/api/asset-map/report/route.ts','/api/asset-map/report',`assetId=${A}`],
])test(`${path}: approved shared reports use current owner data and exclude other assets`,async()=>{
 let title='Live tractor one';
 const item=()=>({id:A,registerId:'register',title,kind:'tractor',publicAssetCode:'SHARED',specsJson:{},lastKnownLat:-33,lastKnownLng:22,photos:[],selectedValueExVat:5000,value:5000});
 const other={...item(),id:'20000000-0000-4000-8000-000000000002',title:'PRIVATE-ASSET',publicAssetCode:'PRIVATE'};
 const assertOwner=owner=>assert.equal(owner,'owner');
 const route=load(file,{
  'next/server':{NextResponse},
  '../../../../lib/auth-session':{getServerSession:async()=>({user:{id:'recipient',email:'recipient@example.test'}})},
  '../../../../lib/live-shared-asset-access':{requireLiveSharedAsset:async(token,id,permission)=>{assert.equal(id,A);assert.equal(permission,'allReports');return {lead:{ownerId:'owner',details:{}},user:{id:'recipient'}};}},
  '../../../../lib/owner-workspace-access':{resolveOwnerWorkspaceContext:async()=>{throw Error('Must use link access');}},
  '../../../../lib/owner-app-access':{getOwnerAppAccess:async()=>null},
  '../../../../lib/account-profile':{getAccountProfile:async user=>{assertOwner(user.id);return {accountType:'owner',businessName:'Owner'};}},
  '../../../../lib/asset-register-account-access':{isAssetRegisterAccountType:()=>true},
  '../../../../lib/asset-register-db':{getAssetRegisterItemById:async(owner,id)=>{assertOwner(owner);assert.equal(id,A);return item();},listAssetRegisterItems:async(owner,registerId)=>{assertOwner(owner);assert.equal(registerId,'register');return [item(),other];}},
  '../../../../lib/asset-registers':{getAssetRegisterForUser:async(owner,id)=>{assertOwner(owner);assert.equal(id,'register');return {id,name:'Register'};},listAssetRegisters:async owner=>{assertOwner(owner);return [{id:'register',name:'Register'}];}},
  '../../../../lib/asset-groups':{listAssetGroups:async()=>[]},
  '../../../../lib/asset-groups-shared':{projectAssetGroupsToAssets:()=>new Map(),decorateAssetsWithGroups:items=>items,assetCountsTowardRegisterTotalFromMeta:()=>true},
  '../../../../lib/report-branding':{selectReportLogoUrl:()=>''},
  '../../../../lib/simple-xlsx':{createXlsxWorkbook:sheets=>Buffer.from(JSON.stringify(sheets))},
 });
 const get=()=>route.GET(new NextRequest(`https://example.test${path}?shareToken=token&format=xlsx&${selector}`));
 const first=await get();assert.equal(first.status,200);const firstData=await first.text();assert.match(firstData,/Live tractor one/);assert.doesNotMatch(firstData,/PRIVATE-ASSET/);
 title='Live tractor updated';const next=await get();assert.equal(next.status,200);const nextData=await next.text();assert.match(nextData,/Live tractor updated/);assert.doesNotMatch(nextData,/PRIVATE-ASSET|Live tractor one/);
});

test('shared fuel and depreciation reports require all-reports access; maintenance retains its explicit permission',async()=>{
 const checks=[];
 const route=load('app/api/asset-register/scan-report/route.ts',{
  'next/server':{NextResponse},
  '../../../../lib/auth-session':{getServerSession:async()=>({user:{id:'recipient'}})},
  '../../../../lib/owner-app-access':{getOwnerAppAccess:async()=>null},
  '../../../../lib/live-shared-asset-access':{requireLiveSharedAsset:async(...args)=>{checks.push(args);throw Error('Not authorised');}},
 });
 for(const kind of ['fuel','depreciation','maintenance']){
  const response=await route.GET(new NextRequest(`https://example.test/api/asset-register/scan-report?shareToken=token&assetId=${A}&report=${kind}`));assert.equal(response.status,403);
  assert.deepEqual(checks.at(-1),['token',A,kind==='maintenance'?'maintenanceReports':'allReports']);
 }
 const count=checks.length;
 assert.equal((await route.GET(new NextRequest(`https://example.test/api/asset-register/scan-report?shareToken=token&assetId=${A}&accessId=other&report=fuel`))).status,403);
 assert.equal(checks.length,count);
});
