const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,mocks={}){const out={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(name in mocks)return mocks[name];throw Error('Unexpected dependency '+name)},out);return out;}
const policy=load('lib/team-access-policy.ts');
const workspace=load('lib/team-workspace-policy.ts',{'./team-access-policy':policy});
const empty=()=>({...policy.EMPTY_TEAM_PERMISSIONS});
const all=()=>({...policy.TEAM_TEMPLATES.manager.permissions});
const url=path=>new URL(path,'https://www.aim4price.com');
const next={NextResponse:{json:(body,init={})=>new Response(JSON.stringify(body),{...init,headers:{'content-type':'application/json',...init.headers}})}};
test('legacy grants never acquire new page or download permissions',()=>{
 const old={viewValues:true,editDetails:true,updateUsage:true,viewMaintenance:true,completeMaintenance:true,uploadDocuments:true,viewPhotos:true,uploadPhotos:true,exportAssets:true};
 const normalized=policy.normalizeTeamPermissions(old);
 for(const {key} of policy.TEAM_PERMISSIONS) assert.equal(normalized[key],old[key]===true,key);
});
test('dependent actions are explicit and disabling parent access removes dependent grants',()=>{
 let p=policy.updateTeamPermission(empty(),'manageBudgets',true);
 for(const key of ['viewCosts','viewFuel','viewFuelCosts','viewBudgets','manageBudgets'])assert.equal(p[key],true,key);
 assert.equal(p.viewValues,false);assert.equal(p.viewCostDocuments,false);
 p=policy.updateTeamPermission(p,'viewFuel',false);
 for(const key of ['viewFuelCosts','viewBudgets','manageBudgets'])assert.equal(p[key],false,key);
});
test('all named page actions require their own permission and unknown actions fail closed',()=>{
 const cases=[['/api/fuel','GET','viewFuel'],['/api/fuel','POST','manageFuelStorage'],['/api/fuel/slips','POST','addFuel'],['/api/fuel/slips/one','PATCH','editFuel'],['/api/fuel/slips/one','DELETE','voidFuel'],['/api/fuel/report','GET','exportFuel'],['/api/fuel/documents/download','GET','viewFuelDocuments'],['/api/my-invoices','GET','viewCosts'],['/api/my-invoices','POST','addCosts'],['/api/my-invoices/one','PATCH','editCosts'],['/api/my-invoices/one','DELETE','deleteCosts'],['/api/my-invoices/report','GET','exportCosts'],['/api/my-invoices/budgets','GET','viewBudgets'],['/api/my-invoices/budgets/one','PATCH','manageBudgets'],['/api/my-invoices/documents/one/download','GET','viewCostDocuments'],['/api/asset-map','GET','viewMap'],['/api/asset-map/report','GET','exportMap'],['/api/asset-register/location','POST','updateLocation'],['/api/maintenance','GET','viewMaintenance'],['/api/maintenance/one/complete','POST','completeMaintenance'],['/api/maintenance/report','GET','exportMaintenance']];
 for(const [path,method,key] of cases){assert.equal(workspace.teamWorkspacePermission(path,method),key);assert.throws(()=>workspace.assertTeamWorkspaceRequest(empty(),url(path),method));assert.doesNotThrow(()=>workspace.assertTeamWorkspaceRequest({...empty(),[key]:true},url(path),method));}
 for(const [path,method] of [['/api/maintenance','POST'],['/api/fuel/storage/one/pin','POST'],['/api/asset-register','DELETE'],['/api/marketplace','POST'],['/api/account','PATCH']])assert.throws(()=>workspace.assertTeamWorkspaceRequest(all(),url(path),method));
 for(const format of ['csv','xlsx','json'])assert.throws(()=>workspace.assertTeamWorkspaceRequest(all(),url('/api/fuel/report?format='+format),'GET'));
 for(const key of ['shareToken','accessId','accountantShareId'])assert.throws(()=>workspace.assertTeamWorkspaceRequest(all(),url('/api/fuel?'+key+'=other'),'GET'));
});
const event=(assetId='a')=>({id:'event-'+assetId,assetId,storageId:'tank',storageName:'Tank',storagePublicCode:'PIN_SECRET',eventType:'asset_issue',litres:10,totalAmount:91234,pricePerLitre:91235,vatAmount:91236,documentFileUrl:'https://private.test/file.pdf',evidenceFileUrl:'https://private.test/evidence',evidenceFileName:'secret.pdf',paymentMethod:'PRIVATE_CARD',cardNumberMasked:'SECRET_CARD',addedByEmail:'private@owner',note:'PRIVATE_PRICE_NOTE',slipNote:'PRIVATE_PRICE_NOTE',latitude:-33,longitude:18,locationText:'PRIVATE_LOCATION',workAreaText:'PRIVATE_LOCATION',storageLevelBefore:5000,storageLevelAfter:4990,createdAtIso:new Date().toISOString()});
const slip=(assetId='a')=>({...event(assetId),id:'slip-'+assetId,targetType:'asset',pricePerLitre:91235,vatAmount:91236,uploadId:'SECRET_UPLOAD',invoiceDocumentId:'SECRET_DOC',rawExtractedText:'SECRET_OCR',extractionWarnings:['SECRET_WARNING'],note:'PRIVATE_PRICE_NOTE'});
test('fuel quantities are scoped independently of money, tank stock, maps and originals',()=>{
 const data={assets:[{id:'a',currentValue:987654,isActive:true},{id:'b',currentValue:123456,isActive:true}],storages:[{id:'tank',capacityLitres:10000,currentLitres:5000,reorderLevelLitres:1000,publicFuelStorageCode:'SECRET_PIN'}],recentEvents:[event(),event('b'),{...event(''),eventType:'stock_in'}],recentFuelSlips:[slip(),slip('b'),{...slip(''),targetType:'storage_tank'}]};
 const output=workspace.projectTeamFuelLedger(data,new Set(['a']),{...empty(),viewFuel:true});
 assert.equal(output.assets.length,1);assert.equal(output.storages.length,0);assert.equal(output.recentEvents.length,1);assert.equal(output.recentFuelSlips.length,1);assert.equal(output.recentEvents[0].litres,10);
 const json=JSON.stringify(output);for(const secret of ['91234','91235','91236','987654','123456','SECRET','PRIVATE','private.test','private@owner','5000','4990'])assert.ok(!json.includes(secret),secret);
 const full=workspace.projectTeamFuelLedger(data,new Set(['a']),all());assert.equal(full.recentEvents.length,2);assert.equal(full.recentFuelSlips[0].totalAmount,91234);assert.equal(full.assets[0].currentValue,987654);assert.equal(full.recentFuelSlips[0].rawExtractedText,'');assert.match(full.recentFuelSlips[0].documentFileUrl,/^\/api\/fuel\/documents\/download\?source=/);assert.equal(full.storages[0].publicFuelStorageCode,'');
});
test('cost totals use only allowed assets and fuel costs require fuel-price access',()=>{
 const invoice=(id,assetId,source,total)=>({id,assetId,source,totalIncVat:total,assetValue:987654,invoiceDocumentId:'SECRET_DOC',document:{uploadId:'SECRET_UPLOAD',rawExtractedText:'SECRET_OCR',extractionWarnings:['SECRET_WARNING']}});
 const data={assets:[{id:'a',value:987654},{id:'b',value:123456}],invoices:[invoice('1','a','manual',20),invoice('2','b','manual',50),invoice('3','a','fuel_slip',30)]};
 const summarize=invoices=>({total:invoices.reduce((sum,i)=>sum+i.totalIncVat,0)});
 const output=workspace.projectTeamCosts(data,new Set(['a']),{...empty(),viewCosts:true},summarize);
 assert.equal(output.summary.total,20);assert.equal(output.invoices.length,1);assert.equal(output.assets[0].value,0);assert.equal(output.invoices[0].document,null);assert.ok(!JSON.stringify(output).includes('SECRET'));
 const full=workspace.projectTeamCosts(data,new Set(['a']),all(),summarize);assert.equal(full.summary.total,50);assert.equal(full.invoices[0].assetValue,987654);assert.equal(full.invoices[0].document.rawExtractedText,'');
});
test('cost edit validates original scope before allowing a move to an accessible asset',async()=>{
 let updated=false;
 const routes=load('app/api/my-invoices/[invoiceId]/route.ts',{'next/server':next,'../../../../lib/team-workspace-policy':workspace,'../../../../lib/my-invoices':{getMyInvoiceById:async()=>({assetId:'outside',source:'manual'}),updateMyInvoice:async()=>{updated=true}},'../../../../lib/owner-workspace-access':{resolveOwnerWorkspaceContext:async()=>({ok:true,context:{ownerUserId:'owner',team:{grant:{permissions:all()}}}}),assertWorkspaceAssetAccess:async(_,id)=>{if(id!=='a')throw new policy.TeamAccessError('Asset unavailable')}}});
 const response=await routes.PATCH(new Request(url('/api/my-invoices/one'),{method:'PATCH',body:JSON.stringify({assetId:'a'})}),{params:{invoiceId:'one'}});
 assert.notEqual(response.status,200);assert.equal(updated,false);
});
test('fuel document and photo access do not silently turn on asset values or costs',()=>{
 for(const key of ['viewFuelDocuments','viewCostDocuments','viewPhotos','uploadPhotos']){const p=policy.updateTeamPermission(empty(),key,true);assert.equal(p.viewValues,false);assert.equal(p.viewFuelCosts,false);assert.equal(p.exportAssets,false);}
});
test('owner workspace bypasses delegated projections unchanged',async()=>{
 const data={invoices:[],assets:[],summary:{total:42}};
 const owner=load('lib/owner-workspace-access.ts',{'./db':{},'next/server':next,'./auth-session':{},'./asset-register-account-access':{},'./my-invoices':{},'./desktop-workspace':{},'./team-access':{},'./team-access-policy':policy,'./team-workspace-policy':workspace});
 assert.equal(await owner.filterCostLedgerForWorkspace({ownerUserId:'owner'},data),data);
 assert.equal(await owner.filterFuelLedgerForWorkspace({ownerUserId:'owner'},data),data);
});
test('fuel originals cannot be exposed through cost permissions alone',()=>{
 const invoice={source:'fuel_slip',assetValue:100,invoiceDocumentId:'receipt',document:{uploadUrl:'/private',rawExtractedText:'prices'}};
 const projected=workspace.projectTeamCostRecord(invoice,{...all(),viewFuelDocuments:false});
 assert.equal(projected.document,null);assert.equal(projected.invoiceDocumentId,null);
 const fuel=workspace.projectTeamFuelSlip(slip(),all(),'membership-a');
 assert.match(fuel.documentFileUrl,/&desktopMembershipId=membership-a$/);
});
test('workspace resolution rejects revoked grants and cross-origin writes without owner fallback',async()=>{
 let ownerLookups=0;
 const mocks={'./db':{},'next/server':next,'./auth-session':{getServerSession:async()=>{ownerLookups++;return null}},'./asset-register-account-access':{},'./my-invoices':{},'./team-access':{},'./team-access-policy':policy,'./team-workspace-policy':workspace};
 const team={grant:{id:'membership',ownerId:'owner',displayName:'Worker',permissions:all()},actor:{id:'worker',username:'worker@farm'}};
 const api=load('lib/owner-workspace-access.ts',{...mocks,'./desktop-workspace':{getDesktopScope:async()=>team}});
 for(const origin of [null,'https://other.test']){
  const request=new Request(url('/api/fuel/slips'),{method:'POST',headers:origin?{origin}:{}});
  const result=await api.resolveOwnerWorkspaceContext(request);assert.equal(result.ok,false);assert.equal(result.response.status,403);
 }
 const allowed=await api.resolveOwnerWorkspaceContext(new Request(url('/api/fuel/slips'),{method:'POST',headers:{origin:'https://www.aim4price.com'}}));
 assert.equal(allowed.context.ownerUserId,'owner');assert.equal(allowed.context.actorUserId,'worker');
 const revoked=load('lib/owner-workspace-access.ts',{...mocks,'./desktop-workspace':{getDesktopScope:async()=>{throw new policy.TeamAccessError('Revoked')}}});
 assert.equal((await revoked.resolveOwnerWorkspaceContext(new Request(url('/api/fuel')))).response.status,403);
 assert.equal(ownerLookups,0);
});
test('adding fuel cannot overwrite an existing record or attach arbitrary files',async()=>{
 let writes=0;
 const routes=load('app/api/fuel/slips/route.ts',{'next/server':next,'../../../../lib/fuel-ledger':{saveFuelSlipTransaction:async()=>{writes++}},'../../../../lib/owner-workspace-access':{resolveOwnerWorkspaceContext:async()=>({ok:true,context:{ownerUserId:'owner',team:{grant:{permissions:all()}}}})}});
 for(const field of ['id','slipId','fuelSlipId','captureRequestId','offlineEventId','uploadId','documentFileUrl']){
  const result=await routes.POST(new Request(url('/api/fuel/slips'),{method:'POST',body:JSON.stringify({targetType:'asset',assetId:'a',[field]:'existing'})}));
  assert.equal(result.status,403,field);
 }
 assert.equal(writes,0);
});
