const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:n==='./guest-enquiry-credits'?{guestEnquiryAccess:async()=>({access:'sign-in'})}:require(n),exports);return exports;}
const permissions=load('lib/external-share-permissions.ts');
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
async function setup(){
 const pg=new PGlite();
 await pg.exec(`CREATE TABLE account_profiles(user_id text PRIMARY KEY, business_name text); CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text,title text,serial_number text,replacement_price_ex_vat numeric); INSERT INTO account_profiles VALUES('owner','Owner Business');INSERT INTO asset_register_items VALUES('${A}','owner','Bakkie','OLD-A',100000),('${B}','owner','Truck','OLD-B',200000);`);
 await pg.exec('CREATE TABLE asset_leads(id uuid PRIMARY KEY,owner_user_id text,asset_register_item_id uuid,asset_snapshot_json jsonb,included_sections_json jsonb,updated_at timestamptz)');
 await pg.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text,"emailVerified" boolean);INSERT INTO "user" VALUES('owner','owner@example.com',true),('recipient','workshop@example.com',true);CREATE TABLE asset_groups(id uuid PRIMARY KEY,user_id text,name text);CREATE TABLE asset_group_members(group_id uuid,asset_id uuid);INSERT INTO asset_groups VALUES('30000000-0000-4000-8000-000000000001','owner','Vehicle fleet');INSERT INTO asset_group_members VALUES('30000000-0000-4000-8000-000000000001','${A}'),('30000000-0000-4000-8000-000000000001','${B}');`);
 const query=(sql,p)=> /create extension/i.test(sql)?Promise.resolve({rows:[]}):p?pg.query(sql,p):pg.exec(sql).then(r=>r.at(-1));
 const db={query,connect:async()=>({query,release(){}})};
 const assetDb={getAssetRegisterItemsByRefs:async refs=>(await pg.query('SELECT * FROM asset_register_items')).rows.filter(r=>refs.some(ref=>ref.userId===r.user_id&&ref.assetId===r.id)).map(r=>({id:r.id,title:r.title,serialNumber:r.serial_number,replacementPriceExVat:Number(r.replacement_price_ex_vat),photos:[]})),getAssetRegisterItemById:async(user,id)=>(await assetDb.getAssetRegisterItemsByRefs([{userId:user,assetId:id}]))[0]};
 const snapshot=load('lib/asset-share-snapshot.ts',{'./asset-usage':load('lib/asset-usage.ts'),'./tractor-logic':{conditionLabel:k=>k}});
 const groups={getAssetGroupById:async(user,id)=>{const g=(await pg.query('SELECT * FROM asset_groups WHERE id=$1 AND user_id=$2',[id,user])).rows[0];return g?{id:g.id,name:g.name,members:(await pg.query('SELECT asset_id FROM asset_group_members WHERE group_id=$1',[id])).rows.map(r=>({assetId:r.asset_id}))}:null;}};
 const base=load('lib/asset-share-links.ts',{'./asset-groups':groups,'./db':{getDb:()=>db},'./asset-share-snapshot':snapshot,'./asset-register-db':assetDb});
 const schema=load('lib/guest-lead-schema.ts',{'./db':{getDb:()=>db},'./asset-share-links':base,'./business-network':{ensureBusinessNetwork:async()=>{}}});
 const state={guestAccess:'sign-in',user:null,approved:false,type:'business',status:'active'};
 const foundation=load('lib/sharing-foundation.ts',{'./db':{getDb:()=>db}});
 const mocks={'./sharing-foundation':foundation,'./guest-enquiry-credits':{guestEnquiryAccess:async()=>({access:state.guestAccess})},'./db':{getDb:()=>db},'./guest-lead-schema':schema,'./business-network-shared':load('lib/business-network-shared.ts'),'./asset-register-db':assetDb,'./asset-share-snapshot':snapshot,'./asset-share-links':base,'./guest-business-access':{getGuestViewer:async()=>null},'./auth-session':{getServerSession:async options=>state.user&&(!options?.requireActive||state.type!=='business')?{user:state.user}:null},'./asset-register-account-access':{getAssetRegisterAccountAccess:async s=>s.user.id==='owner'?{}:null},'./business-accounts':{canBusinessContribute:async()=>state.approved,canBusinessRead:async()=>state.status==='active'},'./account-profile':{getAccountProfile:async()=>({accountType:state.type,accountStatus:state.status,businessName:'Verified Workshop'})},'./external-share-permissions':permissions};
 const leads=load('lib/guest-leads.ts',mocks);mocks['./guest-leads']=leads;
 const access=load('lib/external-lead-access.ts',mocks);mocks['./external-lead-access']=access;
 // Guest leads resolves the same access module lazily through this proxy.
 // Re-load to bind the completed mocks for protected report downloads.
 const fullLeads=load('lib/guest-leads.ts',mocks);
 const docs=load('lib/lead-submissions.ts',mocks);
 const corrections=load('lib/dealer-asset-corrections.ts',{...mocks,'./asset-register-revaluation':{revalueAssetRegisterItem:async()=>{}},'./database-schema-readiness':load('lib/database-schema-readiness.ts')});
 const details={recipientName:'Workshop',recipientEmail:'workshop@example.com',request:'Please check the assets.',replyName:'Owner Business',replyEmail:'owner@example.com',replyPhone:'',allowReply:false,permissions:{reports:true,replacementPrice:true,serialNumber:true,documents:true}};
 const report={label:'Selected report',fileName:'asset.pdf',data:Buffer.from('%PDF-1.4\nreport')};
 const link=await leads.createGuestLead('owner',[B,A],false,details,[report]);
 const signIn=(overrides={})=>{state.user={id:'recipient',name:'Manager',email:'workshop@example.com',emailVerified:true,...overrides};};
 return{mocks,pg,state,leads:fullLeads,access,docs,corrections,details,report,link,base,signIn,foundation,groups};
}
test('permission input defaults to read-only and signup returns only to valid enquiry paths',()=>{
 assert.deepEqual(permissions.normalizeExternalPermissions({reports:'true',serialNumber:true,admin:true}),{reports:false,serialNumber:true,replacementPrice:false,documents:false});
 for(const value of ['https://evil.test','//evil.test','/\\evil.test','/admin','/asset-share/short','/asset-share/'+'x'.repeat(43)+'?open=1&redirect=https://evil.test'])assert.equal(permissions.sharedEnquiryReturnTo(value),null);
 assert.equal(permissions.sharedEnquiryReturnTo('/asset-share/'+'x'.repeat(43)),'/asset-share/'+'x'.repeat(43));
});
test('verified recipients can read; contributions require the invited approved account',async()=>{
 const x=await setup();try{
  const lead=await x.leads.readLeadPage(x.link.token);
  assert.equal(lead.share.umbrellaName,'');assert.equal(lead.share.senderName,'Owner Business');assert.equal(lead.share.assets.length,2);
  assert.equal((await x.access.externalLeadAccess(lead)).access,'sign-in');
  await assert.rejects(x.access.requireExternalLeadAction(x.link.token,'documents'),e=>e.status===401);
  x.signIn({email:'forwarded@example.com'});x.state.approved=true;
  assert.equal((await x.access.externalLeadAccess(lead)).access,'wrong-recipient');await assert.rejects(x.access.requireExternalLeadAction(x.link.token,'serialNumber'),e=>e.status===403);
  x.signIn({emailVerified:false});assert.equal((await x.access.externalLeadAccess(lead)).access,'verify-email');
  x.signIn();x.state.approved=false;assert.equal((await x.access.externalLeadAccess(lead)).access,'read-only');
  await assert.rejects(x.access.requireExternalLeadAction(x.link.token,'documents'),e=>e.status===403);
  x.state.approved=true;x.state.status='suspended';assert.equal((await x.access.externalLeadAccess(lead)).access,'suspended');
  x.state.status='active';assert.equal((await x.access.externalLeadAccess(lead)).access,'active');
  assert.equal((await x.leads.loadProtectedLeadReport(x.link.token,lead.reports[0].id)).status,200);
  x.state.approved=false;assert.equal((await x.leads.loadProtectedLeadReport(x.link.token,lead.reports[0].id)).status,200);
  x.state.type='dealer';assert.equal((await x.access.externalLeadAccess(lead)).access,'active');
  x.state.type='owner';assert.equal((await x.access.externalLeadAccess(lead)).access,'active');
  x.signIn({id:'owner',email:'owner@example.com'});assert.equal((await x.access.externalLeadAccess(lead)).access,'owner');
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
   '../../../../../lib/sharing-foundation':x.foundation,'../../../../../lib/business-network-api':{requireBusinessOrigin:r=>{if(r.headers.get('origin')!=='https://aim4price.test')throw Error('Foreign origin');},businessBody:r=>r.json(),businessJson:(d,status=200)=>Response.json(d,{status}),businessError:e=>Response.json({error:e.message},{status:400})},
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
  const response=await route.POST(request({dealerUserId:'spoofed',ownerUserId:'other',assetId:B}),ctx);assert.equal(response.status,200);const result=await response.json();assert.equal(result.correction.dealerUserId,'recipient');assert.equal(result.correction.ownerUserId,'owner');assert.equal(result.correction.assetId,B);
  assert.equal((await route.POST(request({assetId:'99999999-0000-4000-8000-000000000001'}),ctx)).status,400);
 }finally{await x.pg.close();}
});

test('untargeted links require verification and explicit owner approval; forwarded and revoked links stay locked',async()=>{
 const x=await setup();try{
  const created=await x.leads.createGuestLead('owner',[A],false,{...x.details,accessMode:'owner-approval',recipientName:'',recipientEmail:''},[x.report]);
  const token=created.token;
  x.signIn({emailVerified:false});x.state.approved=true;
  await assert.rejects(x.access.requestExternalLeadAccess(token),e=>e.status===403);
  x.signIn();x.state.approved=false;
  await x.access.requestExternalLeadAccess(token); // Verified reading requests do not wait for business approval.
  x.state.approved=true;
  assert.equal((await x.access.externalLeadAccess(await x.leads.readLeadPage(token))).access,'request-access');
  await assert.rejects(x.access.requireExternalLeadAction(token,'reports'),e=>e.status===403);
  await x.access.requestExternalLeadAccess(token);await x.access.requestExternalLeadAccess(token);
  await assert.rejects(x.access.listExternalAccessRequests(token),e=>e.status===403);
  await assert.rejects(x.access.reviewExternalAccessRequest(token,'recipient','approved'),e=>e.status===403);
  x.signIn({id:'forwarded',email:'forwarded@example.com'});await x.access.requestExternalLeadAccess(token);
  x.signIn({id:'owner',email:'owner@example.com'});
  const rows=await x.access.listExternalAccessRequests(token);assert.equal(rows.length,2);
  await x.access.reviewExternalAccessRequest(token,'recipient','approved');
  await assert.rejects(x.access.reviewExternalAccessRequest(token,'forwarded','approved'),e=>e.status===409);
  x.signIn();assert.equal((await x.access.requireExternalLeadAction(token,'reports')).user.id,'recipient');
  const lead=await x.leads.readLeadPage(token);assert.equal(lead.details.recipientUserId,'recipient');
  const pdf={fileName:'quote.pdf',contentType:'application/pdf',data:Buffer.from('%PDF-1.4 fixture')};
  await x.docs.submitLeadDocument(token,{kind:'quote'},pdf,'recipient');
  x.signIn({id:'different-account'});await assert.rejects(x.access.requireExternalLeadAction(token,'documents'),e=>e.status===403);
  x.signIn({id:'forwarded',email:'forwarded@example.com'});await assert.rejects(x.access.requireExternalLeadAction(token,'reports'),e=>e.status===403);
  x.signIn();x.state.approved=false;await assert.rejects(x.access.requireExternalLeadAction(token,'reports'),e=>e.status===403);
  x.state.approved=true;await x.base.revokeAssetShareLink('owner',token);await assert.rejects(x.access.requireExternalLeadAction(token,'reports'),e=>e.status===404);
 }finally{await x.pg.close();}
});
test('declined access cannot be reclaimed and transferred assets cannot be approved',async()=>{
 const x=await setup();try{
  const {token}=await x.leads.createGuestLead('owner',[A],false,{...x.details,accessMode:'owner-approval',recipientEmail:''},[x.report]);
  x.signIn();x.state.approved=true;await x.access.requestExternalLeadAccess(token);
  x.signIn({id:'owner',email:'owner@example.com'});await x.access.reviewExternalAccessRequest(token,'recipient','rejected');
  x.signIn();await assert.rejects(x.access.requestExternalLeadAccess(token),e=>e.status===403);
  x.signIn({id:'other',email:'other@example.com'});await x.access.requestExternalLeadAccess(token);
  await x.pg.query('UPDATE asset_register_items SET user_id=$1 WHERE id=$2',['new-owner',A]);
  x.signIn({id:'owner',email:'owner@example.com'});await assert.rejects(x.access.reviewExternalAccessRequest(token,'other','approved'),e=>e.status===403);
 }finally{await x.pg.close();}
});
test('access API ignores supplied identity and rejects foreign writes and non-owner approvals',async()=>{
 const x=await setup();try{
  const {token}=await x.leads.createGuestLead('owner',[A],false,{...x.details,accessMode:'owner-approval',recipientEmail:''},[x.report]);
  const {NextRequest}=require('next/server');
  const route=load('app/api/asset-share-links/[token]/access/route.ts',{
   '../../../../../lib/sharing-foundation':x.foundation,'../../../../../lib/business-network-api':{requireBusinessOrigin:r=>{if(r.headers.get('origin')!=='https://aim4price.test')throw Error('Foreign origin');},businessBody:r=>r.json(),businessJson:(data,status=200)=>Response.json(data,{status}),businessError:e=>Response.json({error:e.message},{status:400})},
   '../../../../../lib/external-lead-access':x.access,'../../../../../lib/business-network':{limitBusinessAction:async()=>{}},'../../../../../lib/auth-session':x.mocks['./auth-session'],
  });
  const ctx={params:{token}},url='https://aim4price.test/api/asset-share-links/'+token+'/access';
  const request=(method,body={},origin='https://aim4price.test')=>new NextRequest(url,{method,headers:{origin,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
  assert.equal((await route.POST(request('POST'),ctx)).status,401);
  x.signIn();x.state.approved=true;
  assert.equal((await route.POST(request('POST',{},'https://foreign.test'),ctx)).status,400);
  assert.equal((await route.POST(request('POST',{userId:'owner',email:'spoofed@example.com'}),ctx)).status,200);
  const saved=(await x.pg.query('SELECT * FROM asset_share_access_requests WHERE token=$1',[token])).rows[0];assert.equal(saved.user_id,'recipient');assert.equal(saved.email,'workshop@example.com');
  assert.equal((await route.GET(request('GET'),ctx)).status,403);
  assert.equal((await route.PATCH(request('PATCH',{userId:'recipient',decision:'approved'}),ctx)).status,403);
  x.signIn({id:'owner',email:'owner@example.com'});
  assert.equal((await route.PATCH(request('PATCH',{userId:'recipient',decision:'approved'},'https://foreign.test'),ctx)).status,400);
  assert.equal((await route.PATCH(request('PATCH',{userId:'recipient',decision:'approved'}),ctx)).status,200);
 }finally{await x.pg.close();}
});

test('shared Excel reports retain their format and remain gated like PDFs',async()=>{
 const x=await setup();try{
  const workbook=load('lib/simple-xlsx.ts').createXlsxWorkbook([{name:'Asset report',rows:[['Asset','Value'],['Bakkie',100000]]}]);
  const report={label:'Asset valuation · Excel',fileName:'valuation.xlsx',data:workbook};
  assert.equal(x.leads.sharedReportContentType(report),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await assert.rejects(x.leads.createGuestLead('owner',[A],false,x.details,[{...report,data:Buffer.from('not a workbook')}]),/valid PDF or Excel/);
  const {token}=await x.leads.createGuestLead('owner',[A],false,x.details,[report]);
  const lead=await x.leads.readLeadPage(token),id=lead.reports[0].id;
  assert.equal((await x.leads.loadProtectedLeadReport(token,id)).status,403);
  x.signIn();x.state.approved=true;
  const downloaded=await x.leads.loadProtectedLeadReport(token,id);assert.equal(downloaded.status,200);assert.equal(downloaded.report.content_type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const route=load('app/api/asset-share-links/[token]/reports/[reportId]/route.ts',{'../../../../../../lib/guest-leads':x.leads});
  const response=await route.GET(new Request('https://local.test'),{params:{token,reportId:id}});
  assert.equal(response.headers.get('content-type'),downloaded.report.content_type);assert.match(response.headers.get('content-disposition'),/^attachment/);
  await x.base.revokeAssetShareLink('owner',token);assert.equal((await x.leads.loadProtectedLeadReport(token,id)).status,404);
 }finally{await x.pg.close();}
});

test('legacy guests must sign in to a permanent account before downloading reports',async()=>{
 const x=await setup();
 try{
  const lead=await x.leads.readLeadPage(x.link.token),id=lead.reports[0].id;
  x.state.guestAccess='guest';
  assert.equal((await x.leads.loadProtectedLeadReport(x.link.token,id)).status,403);
  await assert.rejects(x.access.requireExternalLeadAction(x.link.token,'documents'),e=>e.status===401);
  for(const access of ['signup-required','wrong-recipient','suspended','sign-in']){
   x.state.guestAccess=access;assert.equal((await x.leads.loadProtectedLeadReport(x.link.token,id)).status,403);
  }
  x.state.guestAccess='guest';await x.base.revokeAssetShareLink('owner',x.link.token);
  assert.equal((await x.leads.loadProtectedLeadReport(x.link.token,id)).status,404);
 }finally{await x.pg.close();}
});

test('legacy WhatsApp-only enquiries require an owner-approved permanent account',async()=>{
 const x=await setup();try{
  const link=await x.leads.createGuestLead('owner',[A],false,{...x.details,recipientEmail:'',recipientWhatsApp:'+27821234567',permissions:permissions.EMPTY_EXTERNAL_PERMISSIONS},[]);
  const lead=()=>x.leads.readLeadPage(link.token);
  assert.equal((await x.access.externalLeadAccess(await lead())).access,'sign-in');
  x.signIn();
  assert.equal((await x.access.externalLeadAccess(await lead())).access,'request-access');
  await x.access.requestExternalLeadAccess(link.token);
  x.state.type='owner';x.signIn({id:'owner',email:'owner@example.com'});
  await x.access.reviewExternalAccessRequest(link.token,'recipient','approved');
  x.state.type='business';x.signIn();
  assert.equal((await x.access.externalLeadAccess(await lead())).access,'read-only');
  x.signIn({id:'forwarded',email:'another@example.com'});
  assert.equal((await x.access.externalLeadAccess(await lead())).access,'wrong-recipient');
 }finally{await x.pg.close();}
});

test('live links reflect owner edits and umbrella membership; removed members cannot receive corrections',async()=>{
 const x=await setup();try{
  const group='30000000-0000-4000-8000-000000000001';
  const link=await x.leads.createGuestLead('owner',[A],false,x.details,[x.report],{id:group,name:'Vehicle fleet'});
  assert.equal((await x.leads.readLeadPage(link.token)).share.assets.length,2);
  await x.pg.query("UPDATE asset_register_items SET title='Updated bakkie',serial_number='LIVE-SERIAL',replacement_price_ex_vat=98765 WHERE id=$1",[A]);
  let lead=await x.leads.readLeadPage(link.token);
  assert.equal(lead.share.assets.find(a=>a.assetId===A).serialNumber,'LIVE-SERIAL');
  assert.equal(lead.share.assets.find(a=>a.assetId===A).replacementPriceExVat,98765);
  await x.pg.query('DELETE FROM asset_group_members WHERE asset_id=$1',[A]);
  x.signIn();x.state.approved=true;
  assert.equal(await x.access.resolveExternalCorrectionAccess({dealerUserId:'recipient',sourceId:link.token+':'+A,field:'serialNumber'}),null);
  assert.equal((await x.access.resolveExternalCorrectionAccess({dealerUserId:'recipient',sourceId:link.token+':'+B,field:'serialNumber'})).asset_register_item_id,B);
  await x.pg.query('INSERT INTO asset_group_members VALUES($1,$2)',[group,A]);
  assert.equal((await x.leads.readLeadPage(link.token)).share.assets.length,2);
  await x.base.revokeAssetShareLink('owner',link.token);
  assert.equal(await x.leads.readLeadPage(link.token),null);
 }finally{await x.pg.close();}
});
test('free Dealer recipients keep verified access without Desktop and zero draft allowances never block contributions',async()=>{
 const x=await setup();try{
  x.signIn();x.state.type='dealer';x.state.status='pending_payment';
  await x.foundation.registerFreeSharingAccount('recipient');
  await x.foundation.saveSharingAllowances('admin',{assets:0,uploads:0,interactions:0,emails:0});
  assert.equal((await x.access.externalLeadAccess(await x.leads.readLeadPage(x.link.token))).access,'active');
  await x.docs.submitLeadDocument(x.link.token,{kind:'invoice'},{data:Buffer.from('%PDF-1.4'),fileName:'invoice.pdf',contentType:'application/pdf'},'recipient');
  const usage=await x.foundation.sharingUsageSummary('recipient');
  assert.equal(usage.asset_received.count,2);assert.equal(usage.upload.count,1);assert.equal(usage.upload.bytes,8);
  x.state.status='suspended';assert.equal((await x.access.externalLeadAccess(await x.leads.readLeadPage(x.link.token))).access,'suspended');
 }finally{await x.pg.close();}
});

test('directory live projection retains the selected valuation and photo boundaries',async()=>{
 const x=await setup();try{
  const details={...x.details,permissions:permissions.EMPTY_EXTERNAL_PERMISSIONS};
  const link=await x.leads.createGuestLead('owner',[A],true,details,[],undefined,{valuation:false,replacementPrice:false,mainPhotoOnly:true});
  await x.pg.query('UPDATE asset_register_items SET replacement_price_ex_vat=99999 WHERE id=$1',[A]);
  const item=(await x.leads.readLeadPage(link.token)).share.assets[0];
  assert.equal(item.valueExVat,null);assert.equal(item.replacementPriceExVat,null);assert.equal(item.serialNumber,'OLD-A');
 }finally{await x.pg.close();}
});
