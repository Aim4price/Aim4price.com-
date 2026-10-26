const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks={}) {
 const out={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText)(n=>{if(n in mocks)return mocks[n];throw Error('Unexpected dependency '+n);},out);return out;
}
const policy=load('lib/team-access-policy.ts');
const {TEAM_ACCESS_SCHEMA}=load('lib/team-access-schema.ts',{'./db':{}});
const member={id:'member',email:'staff@example.com',emailVerified:true,name:'Workshop staff'};
const owner={id:'owner',email:'owner@example.com',emailVerified:true,name:'Owner'};
const aId=randomUUID(), bId=randomUUID(),otherId=randomUUID(),reg1=randomUUID(),reg2=randomUUID(),docId=randomUUID();
const asset=(id,registerId)=>({id,registerId,title:'Tractor',brandName:'Brand',modelName:'Model',yearModel:2024,serialNumber:'SERIAL',licenseRegistrationNumber:'ABC',condition:'good',photos:['/api/asset-register/uploads/private-photo'],value:987654,replacementPriceExVat:1234567,insuredValueExVat:999999,specsJson:{marketPrice:888888,financeBalance:777777},financeNote:'FINANCIAL SECRET',note:'PRIVATE NOTE',documents:['PRIVATE INVOICE'],hours:500,userId:'owner'});
async function setup() {
 const db=new PGlite();await db.exec('CREATE TABLE "user"(id text primary key); INSERT INTO "user" VALUES (\'owner\'),(\'member\'),(\'other\'); CREATE TABLE asset_register_items(id uuid primary key,user_id text,register_id uuid);');await db.exec(TEAM_ACCESS_SCHEMA);
 await db.exec("CREATE TABLE asset_maintenance_records(id text,user_id text,asset_id uuid,status text)");
 await db.query("INSERT INTO asset_maintenance_records VALUES('maintenance','owner',$1,'upcoming')",[aId]);
 await db.query('INSERT INTO asset_register_items VALUES($1,$2,$3),($4,$2,$5),($6,$7,$3)',[aId,'owner',reg1,bId,reg2,otherId,'other']);
 let session={user:member};let ownerActive=true;
 const query=(sql,args)=>db.query(sql,args);const client={query,release(){}};const pool={query,connect:async()=>client};
 const assets=[asset(aId,reg1),asset(bId,reg2)];
 const docs=[{id:docId,title:'Approved manual',fileName:'manual.pdf',notes:'PRIVATE NOTES',assetLinks:[{id:aId,title:'Tractor'}],deletedAtIso:null}];
 const registers=[{id:reg1,businessName:'Farm A',totalValue:987654},{id:reg2,businessName:'Farm B',totalValue:987654}];
 const service=load('lib/team-access.ts',{
  './asset-history-schema':{setAssetHistoryActor:async()=>{}},
  './db':{getDb:()=>pool},'./auth-session':{getAnyServerSession:async()=>session},
  './account-profile':{getAccountProfile:async user=>({accountType:user.id==='owner'?'owner':'business',accountStatus:user.id==='owner'&&!ownerActive?'suspended':'active',businessName:'Private business'})},
  './sharing-foundation':{sharingPlan:async id=>id==='owner'?'desktop':'free'},
  './asset-registers':{listAssetRegisters:async id=>id==='owner'?registers:[]},
  './asset-register-db':{listAssetRegisterItems:async(id,reg)=>id==='owner'?assets.filter(a=>a.registerId===reg):[],getAssetRegisterItemById:async(id,key)=>id==='owner'?assets.find(a=>a.id===key):null},
  './account-documents':{listAccountDocuments:async id=>id==='owner'?docs:[]},
  './asset-usage':{resolveAssetUsage:()=>({value:500,metric:'hours'})},
  './team-access-schema':{ensureTeamAccessSchema:async()=>{}},'./team-access-policy':policy,
 });
 const input={email:member.email,displayName:'Workshop staff',scope:'selected',registerIds:[reg1],assetIds:[],documentIds:[],permissions:{},expiresAt:null};
 async function invite(extra={}){return service.saveTeamGrant(owner,{...input,...extra});}
 async function active(extra={}){const grant=await invite(extra);return service.acceptTeamGrant(member,grant.id);}
 return {db,pool,client,assets,docs,service,input,invite,active,setSession:s=>session=s,setOwnerActive:s=>ownerActive=s};
}
test('permissions fail closed, dependencies are enforced, templates hide values',()=>{
 const permissions=policy.normalizeTeamPermissions({viewValues:'true',editDetails:1,manage_access:true,completeMaintenance:true});
 assert.deepEqual(permissions,policy.EMPTY_TEAM_PERMISSIONS);
 for(const template of Object.values(policy.TEAM_TEMPLATES))assert.equal(template.permissions.viewValues,false);
});
test('projection omits financial data, private JSON and document links; CSV cannot restore them',()=>{
 const grant={scope:'all',registerIds:[],assetIds:[],permissions:{...policy.EMPTY_TEAM_PERMISSIONS}};
 const output=policy.projectTeamAsset(asset(aId,reg1),grant,'Farm',{value:500,metric:'hours'});
 assert.equal(Object.hasOwn(output,'values'),false);
 const serialized=JSON.stringify(output)+policy.teamCsv([output],false);
 for(const secret of ['987654','1234567','999999','888888','777777','FINANCIAL','PRIVATE','private-photo'])assert.ok(!serialized.includes(secret),secret);
 grant.permissions.viewValues=true;const visible=policy.projectTeamAsset(asset(aId,reg1),grant,'Farm',{value:500,metric:'hours'});
 assert.equal(visible.values.current,987654);assert.ok(!JSON.stringify(visible).includes('financeBalance'));
 assert.ok(policy.teamCsv([{...visible,title:'=HYPERLINK("evil")'}],true).includes("'=HYPERLINK"));
});
test('asset edit allowlist rejects values, owner IDs, nested specifications and ungranted operations',()=>{
 const grant={permissions:{...policy.EMPTY_TEAM_PERMISSIONS,updateUsage:true}};
 for(const body of [{value:1},{userId:'owner'},{specsJson:{value:1}},{title:'changed'},{usage:-1},{usage:'900'}])assert.throws(()=>policy.validateTeamPatch(body,grant));
 assert.deepEqual(policy.validateTeamPatch({usage:900},grant),{usage:900});
 assert.throws(()=>policy.validateTeamPatch({usage:900,title:'changed'},grant));
});
test('only verified invited identity can accept; acceptance binds an individual account and is audited',async()=>{
 const f=await setup();try{
 const invite=await f.invite();await assert.rejects(f.service.loadTeamScope(invite.id));
 await assert.rejects(f.service.acceptTeamGrant({...member,emailVerified:false},invite.id));
 await assert.rejects(f.service.acceptTeamGrant({...member,id:'other',email:'other@example.com'},invite.id));
 const accepted=await f.service.acceptTeamGrant(member,invite.id);assert.equal(accepted.memberUserId,'member');
 const scope=await f.service.loadTeamScope(invite.id);assert.equal(scope.grant.ownerId,'owner');assert.equal(scope.actor.id,'member');
 f.setSession({user:{...member,id:'other'}});await assert.rejects(f.service.loadTeamScope(invite.id));
 assert.equal((await f.db.query("SELECT count(*)::int AS n FROM team_access_activity WHERE actor_id='member' AND action='Invitation accepted'")).rows[0].n,1);
 }finally{await f.db.close();}
});
test('scope applies to list, guessed IDs, register moves and cross-owner assets',async()=>{
 const f=await setup();try{
 const grant=await f.active();const scope=await f.service.loadTeamScope(grant.id);
 const assets=await f.service.teamAssetList(scope);assert.deepEqual(assets.map(a=>a.id),[aId]);
 assert.ok(!JSON.stringify(assets).includes('987654'));await assert.rejects(f.service.requireTeamAsset(scope,bId));await assert.rejects(f.service.requireTeamAsset(scope,otherId));
 f.assets[0].registerId=reg2;await assert.rejects(f.service.requireTeamAsset(scope,aId));
 }finally{await f.db.close();}
});
test('revocation, expiry, changed email and suspended owner take effect on subsequent requests',async()=>{
 const f=await setup();try{
 const grant=await f.active();f.setSession({user:{...member,email:'changed@example.com'}});await assert.rejects(f.service.loadTeamScope(grant.id));f.setSession({user:member});
 f.setOwnerActive(false);await assert.rejects(f.service.loadTeamScope(grant.id));f.setOwnerActive(true);
 await f.db.query("UPDATE team_access SET expires_at=now()-interval '1 second' WHERE id=$1",[grant.id]);await assert.rejects(f.service.loadTeamScope(grant.id));
 await f.db.query('UPDATE team_access SET expires_at=NULL WHERE id=$1',[grant.id]);
 await f.service.setTeamGrantStatus(owner,grant.id,grant.version,'revoked');await assert.rejects(f.service.loadTeamScope(grant.id));await assert.rejects(f.service.acceptTeamGrant(member,grant.id));
 }finally{await f.db.close();}
});
test('write locks reject stale permissions and revoked grants; concurrent owner edits use versions',async()=>{
 const f=await setup();try{
 const grant=await f.active({permissions:{updateUsage:true}});const old=await f.service.loadTeamScope(grant.id,'updateUsage');
 await f.service.lockTeamScope(f.client,old,aId,'updateUsage');
 const changed=await f.service.saveTeamGrant(owner,{...f.input,id:grant.id,version:grant.version,permissions:{}});
 await assert.rejects(f.service.lockTeamScope(f.client,old,aId,'updateUsage'));
 await assert.rejects(f.service.saveTeamGrant(owner,{...f.input,id:grant.id,version:grant.version}));
 await assert.rejects(f.service.setTeamGrantStatus({...owner,id:'other'},grant.id,changed.version,'revoked'));
 await f.service.setTeamGrantStatus(owner,grant.id,changed.version,'revoked');await assert.rejects(f.service.lockTeamScope(f.client,old,aId,'updateUsage'));
 }finally{await f.db.close();}
});
test('approved documents require every linked asset in scope and disappear when removed or unapproved',async()=>{
 const f=await setup();try{
 const grant=await f.active({documentIds:[docId]});const scope=await f.service.loadTeamScope(grant.id);assert.equal((await f.service.teamDocuments(scope)).length,1);
 f.docs[0].assetLinks.push({id:bId});assert.equal((await f.service.teamDocuments(scope)).length,0);
 f.docs[0].assetLinks.pop();f.docs[0].deletedAtIso=new Date().toISOString();assert.equal((await f.service.teamDocuments(scope)).length,0);
 scope.grant.documentIds=[];assert.equal((await f.service.teamDocuments(scope)).length,0);
 }finally{await f.db.close();}
});
test('owners cannot grant foreign assets/documents; invited business accounts cannot administer owner access',async()=>{
 const f=await setup();try{
 await assert.rejects(f.invite({assetIds:[otherId]}));await assert.rejects(f.invite({documentIds:[randomUUID()]}));
 await assert.rejects(f.service.requireTeamOwner());f.setSession({user:owner});assert.equal((await f.service.requireTeamOwner()).actor.id,'owner');
 await assert.rejects(f.invite({scope:'selected',registerIds:[],assetIds:[]}));
 }finally{await f.db.close();}
});
test('empty scope denies all; selected registers include future assets while explicit assets do not expand',()=>{
 assert.equal(policy.teamCanAccessAsset({scope:'selected',registerIds:[],assetIds:[]},{id:aId,registerId:reg1}),false);
 assert.equal(policy.teamCanAccessAsset({scope:'selected',registerIds:[reg1],assetIds:[]},{id:randomUUID(),registerId:reg1}),true);
 assert.equal(policy.teamCanAccessAsset({scope:'selected',registerIds:[],assetIds:[aId]},{id:bId,registerId:reg1}),false);
});
test('team access does not impersonate the owner or broaden existing desktop sessions',()=>{
 const auth=fs.readFileSync('lib/auth-session.ts','utf8');assert.ok(!auth.includes('team_access'));assert.ok(!auth.includes('teamAccess'));
 const service=fs.readFileSync('lib/team-access.ts','utf8');assert.match(service,/getAnyServerSession/);assert.ok(!service.includes('user: { ...session'));
 assert.equal(fs.readFileSync('database/migrations/143-desktop-team-access.sql','utf8').split('\n').slice(1).join('\n'),TEAM_ACCESS_SCHEMA);
 const {sharedEnquiryReturnTo}=load('lib/external-share-permissions.ts');assert.equal(sharedEnquiryReturnTo('/team'),'/team');assert.equal(sharedEnquiryReturnTo('//evil.example/team'),null);assert.equal(sharedEnquiryReturnTo('/team?owner=other'),null);
});

function routes(f) {
 class NextResponse extends Response {static json(body,options){return new NextResponse(JSON.stringify(body),{...options,headers:{'Content-Type':'application/json',...options?.headers}});}}
 const http=load('lib/team-access-http.ts',{'next/server':{NextResponse},'./team-access-policy':policy});
 let writes=[],downloads=0;
 const handlers={
  'next/server':{NextResponse},
  '../../../lib/team-access':f.service,
  '../../../../lib/team-access':f.service,
  '../../../../../lib/team-access':f.service,
 };
 for(const prefix of ['../../../','../../../../','../../../../../']){
  handlers[prefix+'lib/team-access-http']=http;handlers[prefix+'lib/team-access-policy']=policy;
  handlers[prefix+'lib/db']={getDb:()=>f.pool};
  handlers[prefix+'lib/business-network-api']={requireBusinessOrigin:r=>{if(r.headers.get('origin')!=='https://www.aim4price.com')throw new policy.TeamAccessError('Foreign origin',403);},businessBody:async r=>r.body};
 }
 handlers['../../../../lib/asset-register-db']={updateSharedAssetDetails:async(client,ownerId,assetId,patch)=>{writes.push({ownerId,assetId,patch});return {item:asset(assetId,reg1),before:{value:987654}};}};
 handlers['../../../../../lib/account-documents']={getAccountDocumentUploadReference:async(ownerId,id)=>{assert.equal(ownerId,'owner');assert.equal(id,docId);return {uploadId:'approved',fileName:'manual.pdf'};},createAccountDocument:async()=>{throw Error('Unexpected upload');},removeUnusedAccountDocumentUpload:async()=>{}};
 handlers['../../../../../lib/asset-register-uploads']={resolveAssetRegisterUploadBytes:async id=>{downloads++;assert.equal(id,'approved');return {status:'ready',upload:{data:Buffer.from('APPROVED FILE'),mimeType:'application/pdf'}};}};
 handlers['../../../../../lib/business-network']={limitBusinessAction:async()=>{}};
 handlers['../../../../../lib/asset-maintenance']={getAssetMaintenanceRecordById:async()=>({id:'maintenance',assetId:aId,maintenanceType:'service'}),listAssetMaintenanceRecords:async()=>[{id:'maintenance',assetId:aId,title:'Service',maintenanceType:'service',status:'upcoming',computedStatusLabel:'Upcoming',assetValue:987654,finance:{balance:888888}}],completeAssetMaintenanceRecord:async(ownerId,id,input,guard)=>{await guard.before(f.client);assert.equal(ownerId,'owner');assert.equal(guard.assetId,aId);assert.equal(input.completedBy,'Workshop staff');assert.equal(input.continueSchedule,undefined);writes.push({maintenance:id,input});await guard.after(f.client,{id});}};
 return {asset:load('app/api/team-workspaces/[membershipId]/route.ts',handlers),documents:load('app/api/team-workspaces/[membershipId]/documents/route.ts',handlers),maintenance:load('app/api/team-workspaces/[membershipId]/maintenance/route.ts',handlers),exports:load('app/api/team-workspaces/[membershipId]/export/route.ts',handlers),writes,get downloads(){return downloads;}};
}
function request(body={},query='') {return {body,url:'https://www.aim4price.com/api/team-workspaces/test'+query,nextUrl:new URL('https://www.aim4price.com/api/team-workspaces/test'+query),headers:new Headers({origin:'https://www.aim4price.com'})};}
test('real asset routes enforce actor and scope, ignore owner injection, and return no raw mutation snapshots',async()=>{
 const f=await setup();try{
 const grant=await f.active({permissions:{updateUsage:true}});const r=routes(f);const ctx={params:{membershipId:grant.id}};
 let response=await r.asset.GET(request(),ctx);assert.equal(response.status,200);assert.ok(!(await response.text()).includes('987654'));
 response=await r.asset.PATCH(request({assetId:bId,patch:{usage:900}}),ctx);assert.equal(response.status,404);assert.equal(r.writes.length,0);
 response=await r.asset.PATCH(request({assetId:aId,patch:{value:1}}),ctx);assert.equal(response.status,400);assert.equal(r.writes.length,0);
 response=await r.asset.PATCH(request({assetId:aId,userId:'other',patch:{usage:900}}),ctx);assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});assert.equal(r.writes[0].ownerId,'owner');
 const foreign=request({assetId:aId,patch:{usage:950}});foreign.headers.set('origin','https://evil.example');assert.equal((await r.asset.PATCH(foreign,ctx)).status,403);assert.equal(r.writes.length,1);
 f.setSession(null);assert.equal((await r.asset.GET(request(),ctx)).status,401);
 }finally{await f.db.close();}
});
test('real export and document routes reject disallowed downloads and omit hidden money from exported bytes',async()=>{
 const f=await setup();try{
 let grant=await f.active();const r=routes(f);const ctx={params:{membershipId:grant.id}};
 assert.equal((await r.exports.GET(request(),ctx)).status,403);
 assert.equal((await r.documents.GET(request({},'?id='+docId),ctx)).status,404);assert.equal(r.downloads,0);
 grant=await f.service.saveTeamGrant(owner,{...f.input,id:grant.id,version:grant.version,permissions:{exportAssets:true},documentIds:[docId]});
 let response=await r.exports.GET(request(),ctx);assert.equal(response.status,200);const csv=await response.text();assert.ok(!csv.includes('987654'));assert.ok(!csv.includes('value'));assert.match(response.headers.get('Cache-Control'),/no-store/);
 response=await r.documents.GET(request({},'?id='+docId),ctx);assert.equal(response.status,200);assert.equal(await response.text(),'APPROVED FILE');assert.equal(r.downloads,1);
 await f.service.setTeamGrantStatus(owner,grant.id,grant.version,'revoked');assert.equal((await r.documents.GET(request({},'?id='+docId),ctx)).status,403);assert.equal(r.downloads,1);
 }finally{await f.db.close();}
});
test('maintenance data excludes values and completion ignores forged actor and schedule controls',async()=>{
 const f=await setup();try{
 let grant=await f.active();const r=routes(f);const ctx={params:{membershipId:grant.id}};
 assert.equal((await r.maintenance.GET(request({},'?assetId='+aId),ctx)).status,403);
 grant=await f.service.saveTeamGrant(owner,{...f.input,id:grant.id,version:grant.version,permissions:{viewMaintenance:true,completeMaintenance:true}});
 const response=await r.maintenance.GET(request({},'?assetId='+aId),ctx);assert.equal(response.status,200);const text=await response.text();assert.ok(!text.includes('987654'));assert.ok(!text.includes('finance'));
 const complete=await r.maintenance.POST(request({assetId:aId,recordId:'maintenance',notes:'Oil replaced',company:'Workshop',mechanic:'Technician',completedBy:'Owner',continueSchedule:false}),ctx);assert.equal(complete.status,200);assert.equal(r.writes[0].input.completedBy,'Workshop staff');
 }finally{await f.db.close();}
});

test('retired assets cannot be opened through a remembered team URL',async()=>{
 const f=await setup();try{
 const grant=await f.active();const scope=await f.service.loadTeamScope(grant.id);
 await f.db.exec("ALTER TABLE asset_register_items ADD COLUMN lifecycle_state text DEFAULT 'active'");
 await f.db.query("UPDATE asset_register_items SET lifecycle_state='disposed' WHERE id=$1",[aId]);
 await assert.rejects(f.service.requireTeamAsset(scope,aId));
 }finally{await f.db.close();}
});

test('deleting an employee login removes its access without deleting the business audit trail',async()=>{
 const f=await setup();try{
 const grant=await f.active();
 await f.db.query('DELETE FROM "user" WHERE id=$1',['member']);
 const stored=(await f.db.query('SELECT member_user_id FROM team_access WHERE id=$1',[grant.id])).rows[0];
 assert.equal(stored.member_user_id,null);
 assert.ok((await f.db.query('SELECT id FROM team_access_activity WHERE membership_id=$1',[grant.id])).rows.length>=2);
 await assert.rejects(f.service.loadTeamScope(grant.id));
 }finally{await f.db.close();}
});
