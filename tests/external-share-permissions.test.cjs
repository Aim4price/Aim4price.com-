const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),exports);return exports;}
const permissions=load('lib/external-share-permissions.ts');
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
async function setup(){
 const pg=new PGlite();
 await pg.exec(`CREATE TABLE account_profiles(user_id text PRIMARY KEY, business_name text); CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text,title text,serial_number text,replacement_price_ex_vat numeric); INSERT INTO account_profiles VALUES('owner','Owner Business');INSERT INTO asset_register_items VALUES('${A}','owner','Bakkie','OLD-A',100000),('${B}','owner','Truck','OLD-B',200000);`);
 await pg.exec('CREATE TABLE asset_leads(id uuid PRIMARY KEY,owner_user_id text,asset_register_item_id uuid,asset_snapshot_json jsonb,included_sections_json jsonb,updated_at timestamptz)');
 const query=(sql,p)=> /create extension/i.test(sql)?Promise.resolve({rows:[]}):p?pg.query(sql,p):pg.exec(sql).then(r=>r.at(-1));
 const db={query,connect:async()=>({query,release(){}})};
 const assetDb={getAssetRegisterItemsByRefs:async refs=>(await pg.query('SELECT * FROM asset_register_items')).rows.filter(r=>refs.some(ref=>ref.userId===r.user_id&&ref.assetId===r.id)).map(r=>({id:r.id,title:r.title,serialNumber:r.serial_number,replacementPriceExVat:Number(r.replacement_price_ex_vat),photos:[]})),getAssetRegisterItemById:async(user,id)=>(await assetDb.getAssetRegisterItemsByRefs([{userId:user,assetId:id}]))[0]};
 const snapshot=load('lib/asset-share-snapshot.ts',{'./asset-usage':load('lib/asset-usage.ts'),'./tractor-logic':{conditionLabel:k=>k}});
 const base=load('lib/asset-share-links.ts',{'./db':{getDb:()=>db},'./asset-share-snapshot':snapshot,'./asset-register-db':assetDb});
 const schema=load('lib/guest-lead-schema.ts',{'./db':{getDb:()=>db},'./asset-share-links':base,'./business-network':{ensureBusinessNetwork:async()=>{}}});
 const state={user:null,approved:false,type:'business',status:'active'};
 const mocks={'./db':{getDb:()=>db},'./guest-lead-schema':schema,'./business-network-shared':load('lib/business-network-shared.ts'),'./asset-register-db':assetDb,'./asset-share-snapshot':snapshot,'./asset-share-links':base,'./guest-business-access':{getGuestViewer:async()=>null},'./auth-session':{getServerSession:async options=>state.user&&(!options?.requireActive||state.type!=='business')?{user:state.user}:null},'./asset-register-account-access':{getAssetRegisterAccountAccess:async s=>s.user.id==='owner'?{}:null},'./business-accounts':{canBusinessContribute:async()=>state.approved},'./account-profile':{getAccountProfile:async()=>({accountType:state.type,accountStatus:state.status,businessName:'Verified Workshop'})},'./external-share-permissions':permissions};
 const leads=load('lib/guest-leads.ts',mocks);mocks['./guest-leads']=leads;
 const access=load('lib/external-lead-access.ts',mocks);mocks['./external-lead-access']=access;
 // Guest leads resolves the same access module lazily through this proxy.
 // Re-load to bind the completed mocks for protected report downloads.
 const fullLeads=load('lib/guest-leads.ts',mocks);
 const docs=load('lib/lead-submissions.ts',mocks);
 const corrections=load('lib/dealer-asset-corrections.ts',{...mocks,'./asset-register-revaluation':{revalueAssetRegisterItem:async()=>{}},'./database-schema-readiness':load('lib/database-schema-readiness.ts')});
 const details={recipientName:'Workshop',recipientEmail:'workshop@example.com',request:'Please check the assets.',replyName:'Owner Business',replyEmail:'owner@example.com',replyPhone:'',allowReply:false,permissions:{reports:true,replacementPrice:true,serialNumber:true,documents:true}};
 const report={label:'Selected report',fileName:'asset.pdf',data:Buffer.from('%PDF-1.4\nreport')};
 const link=await leads.createGuestLead('owner',[B,A],false,details,[report],{id:'fleet',name:'Vehicle fleet'});
 const signIn=(overrides={})=>{state.user={id:'recipient',name:'Manager',email:'workshop@example.com',emailVerified:true,...overrides};};
 return{mocks,pg,state,leads:fullLeads,access,docs,corrections,details,report,link,base,signIn};
}
test('permission input defaults to read-only and signup returns only to valid enquiry paths',()=>{
 assert.deepEqual(permissions.normalizeExternalPermissions({reports:'true',serialNumber:true,admin:true}),{reports:false,serialNumber:true,replacementPrice:false,documents:false});
 for(const value of ['https://evil.test','//evil.test','/\\evil.test','/admin','/asset-share/short'])assert.equal(permissions.sharedEnquiryReturnTo(value),null);
 assert.equal(permissions.sharedEnquiryReturnTo('/asset-share/'+'x'.repeat(43)),'/asset-share/'+'x'.repeat(43));
});
test('public preview remains available; protected actions require the invited verified and approved account',async()=>{
 const x=await setup();try{
  const lead=await x.leads.readLeadPage(x.link.token);
  assert.equal(lead.share.umbrellaName,'Vehicle fleet');assert.equal(lead.share.senderName,'Owner Business');assert.equal(lead.share.assets.length,2);
  assert.equal((await x.access.externalLeadAccess(lead)).access,'sign-in');
  await assert.rejects(x.access.requireExternalLeadAction(x.link.token,'documents'),e=>e.status===401);
  x.signIn({email:'forwarded@example.com'});x.state.approved=true;
  assert.equal((await x.access.externalLeadAccess(lead)).access,'wrong-recipient');await assert.rejects(x.access.requireExternalLeadAction(x.link.token,'serialNumber'),e=>e.status===403);
  x.signIn({emailVerified:false});assert.equal((await x.access.externalLeadAccess(lead)).access,'verify-email');
  x.signIn();x.state.approved=false;assert.equal((await x.access.externalLeadAccess(lead)).access,'approval-required');
  x.state.approved=true;x.state.status='suspended';assert.equal((await x.access.externalLeadAccess(lead)).access,'suspended');
  x.state.status='active';assert.equal((await x.access.externalLeadAccess(lead)).access,'active');
  assert.equal((await x.leads.loadProtectedLeadReport(x.link.token,lead.reports[0].id)).status,200);
  x.state.approved=false;assert.equal((await x.leads.loadProtectedLeadReport(x.link.token,lead.reports[0].id)).status,403);
  x.state.type='dealer';assert.equal((await x.access.externalLeadAccess(lead)).access,'active');
  x.state.type='owner';x.signIn({id:'owner',email:'owner@example.com'});assert.equal((await x.access.externalLeadAccess(lead)).access,'owner');
  await assert.rejects(x.access.requireExternalLeadAction(x.link.token,'serialNumber'));
 }finally{await x.pg.close();}
});
test('per-link permissions, reports, revocation, transfers, and asset indexes are enforced',async()=>{
 const x=await setup();try{
  x.signIn();x.state.approved=true;
  await assert.rejects(x.leads.createGuestLead('owner',[A],false,{...x.details,recipientEmail:''},[x.report]));
  await assert.rejects(x.leads.createGuestLead('owner',[A],false,{...x.details,permissions:{...x.details.permissions,reports:false}},[x.report]),/Enable Reports/);
  await assert.rejects(x.leads.createGuestLead('owner',[A],false,x.details,[]),/at least one/);
  const readonly=await x.leads.createGuestLead('owner',[A],false,{...x.details,permissions:permissions.EMPTY_EXTERNAL_PERMISSIONS},[]);
  await assert.rejects(x.access.requireExternalLeadAction(readonly.token,'documents'),e=>e.status===403);
  assert.equal(await x.access.resolveExternalCorrectionAccess({dealerUserId:'recipient',sourceId:x.link.token+':99',field:'serialNumber'}),null);
  assert.equal(await x.access.resolveExternalCorrectionAccess({dealerUserId:'spoofed',sourceId:x.link.token+':0',field:'serialNumber'}),null);
  assert.equal((await x.access.resolveExternalCorrectionAccess({dealerUserId:'recipient',sourceId:x.link.token+':1',field:'serialNumber'})).asset_register_item_id,B);
  await x.base.revokeAssetShareLink('owner',x.link.token);await assert.rejects(x.access.requireExternalLeadAction(x.link.token,'serialNumber'),e=>e.status===404);
  const second=await x.leads.createGuestLead('owner',[A],false,x.details,[x.report]);await x.pg.query('UPDATE asset_register_items SET user_id=$1 WHERE id=$2',['other',A]);await assert.rejects(x.access.requireExternalLeadAction(second.token,'reports'),e=>e.status===404);
 }finally{await x.pg.close();}
});
test('uploads use verified identity and proposals enter the existing owner approval queue without changing assets',async()=>{
 const x=await setup();try{
  x.signIn();x.state.approved=true;
  await x.docs.submitLeadDocument(x.link.token,{name:'Spoofed',contact:'fake@example.com',kind:'invoice',note:'Please review'},{data:Buffer.from('%PDF-1.4'),fileName:'invoice.pdf',contentType:'application/pdf'},'recipient');
  const doc=(await x.pg.query('SELECT * FROM asset_share_submissions')).rows[0];assert.equal(doc.actor_user_id,'recipient');assert.equal(doc.sender_name,'Verified Workshop');assert.equal(doc.sender_contact,'workshop@example.com');
  const input={dealerUserId:'recipient',dealerName:'Verified Workshop',actorName:'Manager',sourceType:'external',sourceId:x.link.token+':1',field:'serialNumber',value:'NEW-B'};
  const correction=await x.corrections.createOrUpdateDealerAssetCorrection(input);
  assert.equal(correction.sourceType,'external');assert.equal(correction.assetId,B);assert.equal(correction.status,'pending');
  assert.equal((await x.pg.query('SELECT serial_number FROM asset_register_items WHERE id=$1',[B])).rows[0].serial_number,'OLD-B');
  assert.equal((await x.corrections.listPendingOwnerAssetCorrections('owner')).length,1);assert.equal((await x.corrections.listPendingOwnerAssetCorrections('other')).length,0);
  await assert.rejects(x.corrections.createOrUpdateDealerAssetCorrection(input),/CORRECTION_SERIAL_PENDING/);
  const price=await x.corrections.createOrUpdateDealerAssetCorrection({...input,sourceId:x.link.token+':0',field:'replacementPriceExVat',value:150000});assert.equal(price.proposedReplacementPriceExVat,150000);
  await assert.rejects(x.corrections.resolveDealerAssetCorrection({ownerUserId:'other',correctionId:correction.id,decision:'accept',resolvedByUserId:'other'}),/CORRECTION_NOT_FOUND/);
  const rejected=await x.corrections.resolveDealerAssetCorrection({ownerUserId:'owner',correctionId:correction.id,decision:'reject',resolvedByUserId:'owner'});assert.equal(rejected.correction.status,'rejected');
  const again=await x.corrections.createOrUpdateDealerAssetCorrection(input);const accepted=await x.corrections.resolveDealerAssetCorrection({ownerUserId:'owner',correctionId:again.id,decision:'accept',resolvedByUserId:'owner'});assert.equal(accepted.correction.status,'accepted');assert.equal((await x.pg.query('SELECT serial_number FROM asset_register_items WHERE id=$1',[B])).rows[0].serial_number,'NEW-B');
  x.signIn({email:'forwarded@example.com'});await assert.rejects(x.docs.submitLeadDocument(x.link.token,{kind:'invoice'},{data:Buffer.from('x')},'recipient'),e=>e.status===403);
 }finally{await x.pg.close();}
});

test('correction endpoint rejects foreign requests and forged access, then attributes the real approved recipient',async()=>{
 const x=await setup();try{
  const {NextRequest}=require('next/server');
  const route=load('app/api/asset-share-links/[token]/corrections/route.ts',{
   '../../../../../lib/business-network-api':{requireBusinessOrigin:r=>{if(r.headers.get('origin')!=='https://aim4price.test')throw Error('Foreign origin');},businessBody:r=>r.json(),businessJson:(d,status=200)=>Response.json(d,{status}),businessError:e=>Response.json({error:e.message},{status:400})},
   '../../../../../lib/external-lead-access':x.access,'../../../../../lib/dealer-asset-corrections':x.corrections,'../../../../../lib/account-profile':x.mocks['./account-profile'],'../../../../../lib/business-network':{limitBusinessAction:async()=>{}},
  });
  const ctx={params:{token:x.link.token}},url='https://aim4price.test/api/asset-share-links/'+x.link.token+'/corrections';
  const request=(body={},origin='https://aim4price.test')=>new NextRequest(url,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({assetIndex:0,field:'serialNumber',value:'CORRECTED',...body})});
  assert.equal((await route.POST(request({},'https://foreign.test'),ctx)).status,400);
  assert.equal((await route.POST(request(),ctx)).status,401);
  x.signIn({email:'forwarded@example.com'});x.state.approved=true;assert.equal((await route.POST(request(),ctx)).status,403);
  x.signIn({emailVerified:false});assert.equal((await route.POST(request(),ctx)).status,403);
  x.signIn();x.state.approved=false;assert.equal((await route.POST(request(),ctx)).status,403);
  x.state.approved=true;assert.equal((await route.POST(request({assetIndex:100}),ctx)).status,400);assert.equal((await route.POST(request({field:'ownerUserId'}),ctx)).status,400);
  const response=await route.POST(request({dealerUserId:'spoofed',ownerUserId:'other',assetId:B}),ctx);assert.equal(response.status,200);const result=await response.json();assert.equal(result.correction.dealerUserId,'recipient');assert.equal(result.correction.ownerUserId,'owner');assert.equal(result.correction.assetId,A);
 }finally{await x.pg.close();}
});
