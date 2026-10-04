const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{randomUUID}=require('node:crypto');
function load(file,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),exports);return exports;}
const maths=load('lib/approved-value-baseline.ts');
test('approved value follows subsequent curve movement without repeating past depreciation',()=>{
 const specs={approved_value_baseline:{version:1,amount:800000,modelValue:700000}};
 assert.equal(maths.applyApprovedValueBaseline(700000,specs),800000);
 assert.equal(maths.applyApprovedValueBaseline(665000,specs),760000);
 assert.equal(maths.applyApprovedValueBaseline(840000,specs),960000);
 // Keeping R800k after replacement increases rebases at the new raw model value.
 assert.equal(maths.applyApprovedValueBaseline(798000,{approved_value_baseline:{version:1,amount:800000,modelValue:840000}}),760000);
 assert.equal(maths.applyApprovedValueBaseline(500000,{approved_value_baseline:{version:1,amount:0,modelValue:700000}}),0);
 assert.equal(maths.applyApprovedValueBaseline(500000,{}),500000);
 assert.equal(maths.applyApprovedValueBaseline(500000,{approved_value_baseline:{version:1,amount:800000,modelValue:null}}),500000);
});
test('owner decisions preserve automatic valuation, require latest revision, audit once and reject replay changes',async()=>{
 let asset={id:randomUUID(),userId:'owner',value:700000,replacementPriceExVat:1000000,updatedAtIso:'v1',selectedMethod:'aim4price',hours:5000,condition:'good',specsJson:{privateField:'keep'}};
 const events=new Map(),proposals=new Map(),saved=[];let allowed=true,revoked=false,rawValue=700000;const usage=[];
 const query=async(sql,p=[])=>{
  if(sql.startsWith('SELECT owner_id'))return {rows:events.has(p[0])?[events.get(p[0])]:[]};
  if(sql.startsWith('SELECT * FROM asset_value_requests'))return {rows:proposals.has(p[0])?[proposals.get(p[0])]:[]};
  if(sql.startsWith('SELECT id FROM asset_value_requests'))return {rows:proposals.get(p[0])?.status==='pending'?[{id:p[0]}]:[]};
  if(sql.startsWith('UPDATE asset_value_requests SET status'))proposals.get(p[0]).status=p[1];
  if(sql.startsWith('INSERT INTO asset_value_requests'))proposals.set(p[0],{id:p[0],owner_id:p[1],asset_id:p[2],actor_id:p[3],actor_name:p[4],amount:p[5],reason:p[6],submitted_value:p[7],status:'pending'});
  return {rows:[]};};
 const client={query,release(){}};
 const api=load('lib/asset-value-requests.ts',{'./db':{getDb:()=>({query,connect:async()=>client})},'./dealer-asset-corrections':{ensureDealerAssetCorrectionTables:async()=>{}},'./account-profile':{getAccountProfile:async()=>({businessName:'Test Dealer'})},'./approved-value-baseline':maths,'./asset-register-db':{getAssetRegisterItemById:async(owner,id)=>owner==='owner'&&id===asset.id?{...asset}:null,saveApprovedAssetValue:async(tx,a,value,baseline,replacement)=>{assert.equal(tx,client);asset={...a,value,replacementPriceExVat:replacement??a.replacementPriceExVat,specsJson:{...a.specsJson,approved_value_baseline:baseline},updatedAtIso:'v'+(saved.length+2)};saved.push(asset);return asset}},'./asset-register-revaluation':{revalueAssetRegisterItem:async args=>{assert.equal(args.previewOnly,true);return {newValueExVat:args.ignoreApprovedBaseline?rawValue:maths.applyApprovedValueBaseline(rawValue,asset.specsJson)}}},'./asset-depreciation-timeline':{captureAssetDepreciationLogEntry:async()=>{}},'./shared-asset-activity':{ensureSharedAssetActivity:async()=>{},recordSharedAssetActivity:async(tx,e)=>{events.set(e.id,{owner_id:e.ownerId,asset_id:e.assetId,actor_id:e.actorId,after_data:e.after})}},'./shared-asset-contributions':{contributionScope:async(t,p)=>{assert.equal(p,'suggestValue');if(!allowed)throw Error('not shared');return {ownerId:'owner',assetId:asset.id,user:{id:'dealer',name:'Professional'},lock:async()=>{if(revoked)throw Error('revoked')}}}},'./sharing-foundation':{ensureSharingFoundation:async()=>{},recordSharingUsage:async x=>usage.push(x)},'./business-network':{limitBusinessAction:async()=>{}}});
 const actor={id:'owner',name:'Owner'};const suggestion={requestId:randomUUID(),amount:800000,reason:'Inspected equipment'};
 allowed=false;await assert.rejects(api.suggestAssetValue({leadId:'lead'},suggestion),/not shared/);allowed=true;revoked=true;await assert.rejects(api.suggestAssetValue({leadId:'lead'},suggestion),/revoked/);revoked=false;
 await api.suggestAssetValue({leadId:'lead'},suggestion);await api.suggestAssetValue({leadId:'lead'},suggestion);assert.equal(asset.value,700000);assert.equal(usage.length,1);assert.equal(proposals.size,1);
 await assert.rejects(api.suggestAssetValue({leadId:'lead'},{...suggestion,amount:900000}),/Invalid save/);
 const approval={requestId:randomUUID(),action:'approve',proposalId:suggestion.requestId,revision:'v1',reason:'Accept inspected estimate'};
 await assert.rejects(api.decideAssetValue('other',asset.id,actor,approval),/unavailable/);
 await assert.rejects(api.decideAssetValue('owner',asset.id,actor,{...approval,revision:'old'}),/changed/);
 await api.decideAssetValue('owner',asset.id,actor,approval);await api.decideAssetValue('owner',asset.id,actor,approval);assert.equal(saved.length,1);assert.equal(asset.value,800000);assert.equal(asset.selectedMethod,'aim4price');assert.equal(asset.specsJson.privateField,'keep');assert.equal(asset.specsJson.approved_value_baseline.modelValue,700000);
 await assert.rejects(api.decideAssetValue('owner',asset.id,actor,{...approval,reason:'different'}),/Invalid save/);
 rawValue=840000;await api.decideAssetValue('owner',asset.id,actor,{requestId:randomUUID(),action:'replacement',mode:'keep',replacementPrice:1200000,reason:'Keep assessed value',revision:asset.updatedAtIso});assert.equal(asset.value,800000);assert.equal(asset.specsJson.approved_value_baseline.modelValue,840000);
 rawValue=798000;assert.equal(maths.applyApprovedValueBaseline(rawValue,asset.specsJson),760000);
 const another={...suggestion,requestId:randomUUID()};await api.suggestAssetValue({leadId:'lead'},another);await api.decideAssetValue('owner',asset.id,actor,{requestId:randomUUID(),action:'decline',proposalId:another.requestId,revision:asset.updatedAtIso,reason:'Insufficient evidence'});assert.equal(asset.value,800000);assert.equal(proposals.get(another.requestId).status,'declined');
 for(const amount of [-1,NaN,Infinity,'12',1e13])assert.throws(()=>api.valueAmount(amount));
 asset={...asset,selectedMethod:'manual'};await api.decideAssetValue('owner',asset.id,actor,{requestId:randomUUID(),action:'override',amount:500000,reason:'Manual assessment',revision:asset.updatedAtIso});assert.equal(asset.value,500000);assert.equal(asset.specsJson.approved_value_baseline.modelValue,null);
 await assert.rejects(api.decideAssetValue('owner',asset.id,actor,{requestId:randomUUID(),action:'replacement',mode:'recalculate',replacementPrice:1000000,reason:'Manual calculation',revision:asset.updatedAtIso}),/Manual values/);
});
test('value endpoints derive owner scope from sign-in, require manage rights and trusted writes',async()=>{
 let session=null,origin=true,manage=true,scopeCalls=[],decisions=[];
 class AccessError extends Error{constructor(message,status){super(message);this.status=status}}
 const api=load('lib/asset-value-api.ts',{'./auth-session':{getServerSession:async()=>session,getAnyServerSession:async()=>session,isOwnerAppSession:s=>!!s.ownerApp,isDealerAppSession:()=>false,isAdminSupportSession:()=>false},'./asset-register-account-access':{getAssetRegisterAccountAccess:async()=>true},'./owner-app-access':{getOwnerAppAccess:async()=>({}),ownerAppCan:()=>manage},'./account-constants':{isAim4priceAdminEmail:e=>e==='admin@test'},'./business-network-api':{businessJson:(data,status=200)=>({data,status}),businessBody:r=>r.body,requireBusinessOrigin:()=>{if(!origin)throw new AccessError('origin',403)}},'./db':{getDb:()=>({query:async()=>({rows:[]})})},'./asset-value-requests':{readAssetValueReview:async(owner,id)=>{scopeCalls.push({owner,id});return{}},listValueRequests:async()=>[],ensureValueRequests:async()=>{},valueAmount:n=>n,previewReplacementValue:async()=>({}),decideAssetValue:async(owner,id,actor,body)=>{decisions.push({owner,id,actor,body});return{ok:true}},suggestAssetValue:async()=>({created:false})},'./shared-asset-contributions':{contributionScope:async()=>{throw new AccessError('not shared',403)}},'./asset-register-db':{getAssetRegisterItemById:async()=>null},'./external-lead-access':{ExternalLeadAccessError:AccessError},'./asset-value-mail':{notifyValueSuggestion:async()=>{throw Error('must not send')}}});
 const req={method:'GET',nextUrl:new URL('https://test/api?ownerId=foreign')};
 assert.equal((await api.ownerValueApi(req,'asset')).status,401);
 session={user:{id:'owner',name:'Owner',email:'owner@test'}};assert.equal((await api.ownerValueApi(req,'asset')).status,200);assert.equal(scopeCalls[0].owner,'owner');assert.equal((await api.ownerValueApi(req,'asset',true)).status,403);
 session.ownerApp={ownerAppUserId:'staff'};manage=false;assert.equal((await api.ownerValueApi(req,'asset')).status,403);manage=true;
 origin=false;assert.equal((await api.ownerValueApi({...req,method:'POST',body:{}},'asset')).status,403);assert.equal(decisions.length,0);origin=true;
 await api.ownerValueApi({...req,method:'POST',body:{action:'override',ownerId:'foreign'}},'asset');assert.equal(decisions[0].owner,'owner');assert.equal(decisions[0].actor.id,'staff');
 assert.equal((await api.sharedValueApi(req,{leadId:'lead'})).status,403);
});
test('value request SQL commits approvals once and rolls back stale decisions',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try{
 await db.exec('CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text,title text,value numeric,specs_json jsonb,updated_at timestamptz);');
 const id=randomUUID();await db.query("INSERT INTO asset_register_items VALUES($1,'owner','Tractor',700000,'{}','2026-10-01T00:00:00Z')",[id]);
 const query=async(sql,p)=>{if(sql.includes('pg_advisory_xact_lock'))return {rows:[]};if(!p&&sql.includes(';')){await db.exec(sql);return {rows:[]}}return db.query(sql,p);};const tx={query,release(){}};const dbMock={getDb:()=>({query,connect:async()=>tx})};
 const activity=load('lib/shared-asset-activity.ts',{'./db':dbMock});
 const getAsset=async(owner,assetId)=>{const r=(await db.query('SELECT * FROM asset_register_items WHERE user_id=$1 AND id=$2',[owner,assetId])).rows[0];return r?{id:r.id,userId:r.user_id,title:r.title,value:Number(r.value),specsJson:r.specs_json,updatedAtIso:new Date(r.updated_at).toISOString(),selectedMethod:'aim4price',hours:5000,condition:'good',replacementPriceExVat:1000000}:null};
 const api=load('lib/asset-value-requests.ts',{'./db':dbMock,'./dealer-asset-corrections':{ensureDealerAssetCorrectionTables:async()=>{}},'./account-profile':{getAccountProfile:async()=>({businessName:'Workshop'})},'./approved-value-baseline':maths,'./asset-register-db':{getAssetRegisterItemById:getAsset,saveApprovedAssetValue:async(client,a,amount,baseline)=>{await client.query("UPDATE asset_register_items SET value=$2,specs_json=$3::jsonb,updated_at=now() WHERE id=$1",[a.id,amount,JSON.stringify({...a.specsJson,approved_value_baseline:baseline})]);return getAsset(a.userId,a.id)}},'./asset-register-revaluation':{revalueAssetRegisterItem:async()=>({newValueExVat:700000})},'./asset-depreciation-timeline':{captureAssetDepreciationLogEntry:async()=>{}},'./shared-asset-activity':activity,'./shared-asset-contributions':{contributionScope:async()=>({ownerId:'owner',assetId:id,user:{id:'dealer',name:'Dealer'},lock:async()=>{}})},'./sharing-foundation':{ensureSharingFoundation:async()=>{},recordSharingUsage:async()=>{}},'./business-network':{limitBusinessAction:async()=>{}}});
 const proposalId=randomUUID();await api.suggestAssetValue({leadId:'lead'},{requestId:proposalId,amount:800000,reason:'Inspected machine'});
 assert.equal((await api.listValueRequests('owner',id))[0].status,'pending');
 const review=await api.readAssetValueReview('owner',id),action={requestId:randomUUID(),action:'approve',proposalId,revision:review.asset.revision,reason:'Owner accepts estimate'};
 await assert.rejects(api.decideAssetValue('owner',id,{id:'owner',name:'Owner'},{...action,revision:'stale'}),/changed/);
 assert.equal((await api.listValueRequests('owner',id))[0].status,'pending');assert.equal((await getAsset('owner',id)).value,700000);
 await api.decideAssetValue('owner',id,{id:'owner',name:'Owner'},action);await api.decideAssetValue('owner',id,{id:'owner',name:'Owner'},action);
 assert.equal((await getAsset('owner',id)).value,800000);assert.equal((await api.listValueRequests('owner',id))[0].status,'approved');assert.equal((await api.readAssetValueReview('owner',id)).history.length,1);
 }finally{await db.close();}
});
test('public revaluation previews and saves use the approved anchor on both engines',async()=>{
 for(const kind of ['equipment','tractor']){
  const writes=[];let raw=665000;
  const asset={id:'asset',userId:'owner',kind,selectedMethod:'aim4price',value:800000,yearModel:2023,hours:5000,condition:'good',replacementPriceExVat:1000000,updatedAtIso:'2026-10-04T00:00:00Z',specsJson:{approved_value_baseline:{version:1,amount:800000,modelValue:700000}}};
  const row={id:1,sector_key:'agriculture',family_key:kind==='tractor'?'tractors':'equipment',brand_slug:'brand',model_id:'model'};
  const result=()=>({aim4priceValueExVat:raw,replacementPriceUsedExVat:1000000,sector:{id:1,key:'agriculture'},family:{id:1,key:'equipment'},brand:{name:'Brand'},model:{brand:'Brand',model:'Tractor'},year:2023,usageAmount:5000,condition:'good',specsJson:{}});
  const api=load('lib/asset-register-revaluation.ts',{'./approved-value-baseline':maths,'./asset-register-valuation-recovery':{recoverLegacyValuationInput:async()=>row},'./asset-register-db':{getAssetRegisterItemById:async()=>asset,updateAssetRegisterItemFromGenericValuation:async input=>{writes.push(input);return {...asset,value:input.selectedValueExVat}},updateAssetRegisterItemFromValuation:async input=>{writes.push(input);return {...asset,value:input.selectedValueExVat}}},'./db':{getDb:()=>({query:async()=>({rows:[row]})})},'./equipment-types':{isSectorKey:()=>true},'./generic-valuation':{getGenericSelectedMethodValue:r=>r.aim4priceValueExVat,runGenericValuation:async()=>result()},'./valuation-runs':{getSelectedMethodValue:r=>r.aim4priceValueExVat,saveGenericValuationRunFromResult:async()=>({runId:2}),saveValuationRunFromResult:async()=>({runId:2})},'./server-valuation':{runServerValuation:async()=>result()}});
  if(kind==='equipment'){assert.equal((await api.revalueAssetRegisterItem({userId:'owner',assetId:'asset',previewOnly:true})).newValueExVat,760000);assert.equal((await api.revalueAssetRegisterItem({userId:'owner',assetId:'asset',previewOnly:true,ignoreApprovedBaseline:true})).newValueExVat,665000);}
  const saved=await api.revalueAssetRegisterItem({userId:'owner',assetId:'asset'});assert.equal(saved.newValueExVat,760000);assert.equal(writes[0].selectedValueExVat,760000);assert.equal(writes[0].expectedUpdatedAtIso,asset.updatedAtIso);
 }
});
