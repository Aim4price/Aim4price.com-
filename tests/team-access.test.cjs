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
 const db=new PGlite();await db.exec('CREATE TABLE "user"(id text primary key,email text); INSERT INTO "user" VALUES (\'owner\',\'owner@example.com\'),(\'member\',\'staff@example.com\'),(\'other\',\'other@example.com\'); CREATE TABLE asset_register_items(id uuid primary key,user_id text,register_id uuid);');await db.exec(TEAM_ACCESS_SCHEMA);
 await db.exec("CREATE TABLE asset_maintenance_records(id text,user_id text,asset_id uuid,status text)");
 await db.query("INSERT INTO asset_maintenance_records VALUES('maintenance','owner',$1,'upcoming')",[aId]);
 await db.query('INSERT INTO asset_register_items VALUES($1,$2,$3),($4,$2,$5),($6,$7,$3)',[aId,'owner',reg1,bId,reg2,otherId,'other']);
 let session={user:member};let ownerActive=true;
 const query=(sql,args)=>db.query(sql,args);const client={query,release(){}};const pool={query,connect:async()=>client};
 const assets=[asset(aId,reg1),asset(bId,reg2)];
 const docs=[{id:docId,title:'Approved manual',fileName:'manual.pdf',notes:'PRIVATE NOTES',assetLinks:[{id:aId,title:'Tractor'}],deletedAtIso:null}];
 const registers=[{id:reg1,businessName:'Farm A',totalValue:987654},{id:reg2,businessName:'Farm B',totalValue:987654}];
 let cookieToken='';
 const login=load('lib/team-login.ts',{'node:crypto':require('node:crypto'),'node:util':require('node:util'),'next/headers':{cookies:()=>({get:()=>cookieToken?{value:cookieToken}:undefined})},'./db':{getDb:()=>pool},'./team-access-schema':{ensureTeamAccessSchema:async()=>{}},'./team-access-policy':policy});
 const service=load('lib/team-access.ts',{
  './team-login':login,
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
 return {db,pool,client,assets,docs,service,login,getSession:()=>session,setCookie:t=>cookieToken=t,input,invite,active,setSession:s=>session=s,setOwnerActive:s=>ownerActive=s};
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
test('existing invited account can accept without verification; binding prevents another identity accepting',async()=>{
 const f=await setup();try{
 const invite=await f.invite();await assert.rejects(f.service.loadTeamScope(invite.id));
 assert.equal(invite.memberUserId,'member');
 await assert.rejects(f.service.acceptTeamGrant({...member,id:'other',email:'other@example.com'},invite.id));
 const accepted=await f.service.acceptTeamGrant({...member,emailVerified:false},invite.id);assert.equal(accepted.memberUserId,'member');
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
 assert.equal(fs.readFileSync('database/migrations/143-desktop-team-access.sql','utf8').split('\n').slice(1).join('\n')+fs.readFileSync('database/migrations/144-owner-managed-desktop-logins.sql','utf8')+fs.readFileSync('database/migrations/147-desktop-user-removal.sql','utf8'),TEAM_ACCESS_SCHEMA);
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

test('owner-created desktop password signs in without verification and cannot impersonate a personal account',async()=>{
 const f=await setup();try{
 const grant=await f.invite({email:'new@example.com',password:'Initial-password-123'});
 assert.equal(grant.managedLogin,true);assert.equal(grant.status,'active');assert.equal(grant.memberUserId,null);
 const token=await f.login.authenticateTeamLogin('owner','new@example.com','Initial-password-123');
 f.setSession(null);f.setCookie(token);
 const scope=await f.service.loadTeamScope(grant.id);assert.equal(scope.actor.managedGrantId,grant.id);assert.equal(scope.actor.emailVerified,false);
 await assert.rejects(f.service.requireTeamOwner());
 await assert.rejects(f.service.acceptTeamGrant(scope.actor,grant.id));
 const other=await f.active();await assert.rejects(f.service.loadTeamScope(other.id));
 await assert.rejects(f.login.authenticateTeamLogin('other','new@example.com','Initial-password-123'));
 await assert.rejects(f.login.authenticateTeamLogin('owner','new@example.com','wrong'));
 const stored=(await f.db.query('SELECT password_hash FROM team_access_logins WHERE grant_id=$1',[grant.id])).rows[0].password_hash;
 assert.ok(!stored.includes('Initial-password'));assert.ok(!JSON.stringify(grant).includes('password'));
 assert.equal((await f.db.query('SELECT count(*)::int AS n FROM "user" WHERE email=$1',['new@example.com'])).rows[0].n,0);
 }finally{await f.db.close();}
});
test('password reset and revoke invalidate managed sessions; permission edits preserve credential isolation',async()=>{
 const f=await setup();try{
 const grant=await f.invite({email:'new@example.com',password:'Initial-password-123'});
 const token=await f.login.authenticateTeamLogin('owner','new@example.com','Initial-password-123');f.setSession(null);f.setCookie(token);
 const stale=await f.service.loadTeamScope(grant.id);
 const updated=await f.invite({...grant,password:'Replacement-password-123'});
 await assert.rejects(f.service.loadTeamScope(grant.id));await assert.rejects(f.service.lockTeamScope(f.client,stale,aId,'editDetails'));
 await assert.rejects(f.login.authenticateTeamLogin('owner','new@example.com','Initial-password-123'));
 f.setCookie(await f.login.authenticateTeamLogin('owner','new@example.com','Replacement-password-123'));
 assert.equal((await f.service.loadTeamScope(grant.id)).grant.version,updated.version);
 const revoked=await f.service.setTeamGrantStatus(owner,grant.id,updated.version,'revoked');await assert.rejects(f.service.loadTeamScope(grant.id));
 const restored=await f.service.setTeamGrantStatus(owner,grant.id,revoked.version,'pending');assert.equal(restored.status,'active');await assert.rejects(f.service.loadTeamScope(grant.id));
 await f.login.authenticateTeamLogin('owner','new@example.com','Replacement-password-123');
 }finally{await f.db.close();}
});
test('existing personal account is invited by user ID; owner password never creates or replaces its credentials',async()=>{
 const f=await setup();try{
 const grant=await f.invite({password:'Must-never-be-used'});
 assert.equal(grant.managedLogin,false);assert.equal(grant.memberUserId,member.id);assert.equal(grant.status,'pending');
 assert.equal((await f.db.query('SELECT count(*)::int AS n FROM team_access_logins')).rows[0].n,0);
 await assert.rejects(f.login.authenticateTeamLogin('owner',member.email,'Must-never-be-used'));
 f.setSession({user:{...owner,emailVerified:false}});await f.service.requireTeamOwner();
 await f.service.acceptTeamGrant({...member,emailVerified:false},grant.id);
 f.setSession({user:{...member,emailVerified:false}});await f.service.loadTeamScope(grant.id);
 }finally{await f.db.close();}
});

test('desktop login route enforces origin, rate limits and isolated cookies; logout deletes the server session',async()=>{
 const f=await setup();try{
 await f.invite({email:'new@example.com',password:'Initial-password-123'});
 const limits=[];let blocked=false,token='';
 const json=(body,status=200)=>({body,status,cookies:{set:(...args)=>{json.lastCookie=args;}}});
 const route=load('app/api/team-login/route.ts',{
  'next/server':{},'next/headers':{cookies:()=>({get:()=>({value:token})})},
  '../../../lib/auth-session':{getAnyServerSession:async()=>f.getSession()},
  '../../../lib/account-profile':{getAccountProfile:async()=>({accountType:'owner',accountStatus:'active'})},
  '../../../lib/sharing-foundation':{sharingPlan:async()=> 'desktop'},'../../../lib/db':{getDb:()=>f.pool},
  '../../../lib/team-access-schema':{ensureTeamAccessSchema:async()=>{}},'../../../lib/team-login':f.login,
  '../../../lib/team-access-policy':policy,'../../../lib/team-access-http':{teamJson:json,teamError:e=>json({error:e.message},e.status||500)},
  '../../../lib/business-network-api':{requireBusinessOrigin:r=>{if(r.badOrigin)throw new policy.TeamAccessError('Invalid origin',403);},businessBody:async r=>r.body},
  '../../../lib/business-network':{limitBusinessAction:async(key,count)=>{limits.push({key,count});if(blocked)throw new Error('Too many requests. Please try again later.');}},
 });
 const req={body:{business:'owner',email:'new@example.com',password:'Initial-password-123'},headers:new Headers({'x-forwarded-for':'192.0.2.1'})};
 assert.equal((await route.POST({...req,badOrigin:true})).status,403);
 assert.equal((await route.POST(req)).status,409);
 f.setSession(null);blocked=true;assert.equal((await route.POST(req)).status,429);blocked=false;
 assert.equal((await route.POST(req)).status,200);assert.equal(json.lastCookie[0],'aim4price_desktop_user');assert.equal(json.lastCookie[2].httpOnly,true);assert.equal(json.lastCookie[2].sameSite,'lax');
 token=json.lastCookie[1];f.setCookie(token);assert.ok(await f.login.getManagedTeamActor());assert.ok(limits.some(l=>l.count===5));
 assert.equal((await route.DELETE(req)).status,200);assert.equal(json.lastCookie[2].maxAge,0);assert.equal(await f.login.getManagedTeamActor(),null);
 }finally{await f.db.close();}
});

test('owner creation emails existing accounts only and never includes the supplied password',async()=>{
 const f=await setup();try{
 f.setSession({user:{...owner,emailVerified:false}});const emails=[];
 const json=(body,status=200)=>({body,status});
 const route=load('app/api/team-access/route.ts',{
  'next/server':{},'../../../lib/db':{getDb:()=>f.pool},'../../../lib/team-access':f.service,
  '../../../lib/team-access-http':{teamJson:json,teamError:e=>json({error:e.message},e.status||500)},'../../../lib/team-access-policy':policy,
  '../../../lib/asset-registers':{},'../../../lib/account-documents':{},
  '../../../lib/business-network-api':{requireBusinessOrigin:()=>{},businessBody:async r=>r.body},
  '../../../lib/business-network':{limitBusinessAction:async()=>{}},
  '../../../lib/email':{getSiteOrigin:()=> 'https://aim4price.example',sendAim4priceEmail:async e=>emails.push(e)},
 });
 const existing=await route.POST({body:{...f.input,action:'save',password:'Do-not-email-this-password',sendInvitation:true}});
 assert.equal(existing.status,200);assert.equal(emails.length,1);assert.equal(emails[0].to,member.email);assert.ok(emails[0].text.includes('existing Aim4price account'));assert.ok(!JSON.stringify(emails).includes('Do-not-email-this-password'));
 const managed=await route.POST({body:{...f.input,email:'new@example.com',action:'save',password:'Initial-password-123',sendInvitation:true}});
 assert.equal(managed.status,200);assert.equal(managed.body.member.managedLogin,true);assert.equal(emails.length,1);assert.ok(!JSON.stringify(managed).includes('Initial-password-123'));
 }finally{await f.db.close();}
});

test('removal checks owner and version, ends access, preserves records, and allows a new invitation',async()=>{
 const f=await setup();try{
 const grant=await f.active();
 await assert.rejects(f.service.removeTeamGrant({...owner,id:'other'},grant.id,grant.version));
 await assert.rejects(f.service.removeTeamGrant(owner,grant.id,grant.version-1));
 await f.service.removeTeamGrant(owner,grant.id,grant.version);
 await assert.rejects(f.service.loadTeamScope(grant.id));
 assert.equal((await f.db.query('SELECT * FROM team_access')).rows.length,0);
 assert.equal((await f.db.query('SELECT * FROM "user" WHERE id=$1',[member.id])).rows.length,1);
 assert.equal((await f.db.query('SELECT * FROM asset_register_items')).rows.length,3);
 const activity=(await f.db.query('SELECT * FROM team_access_activity')).rows;
 assert.ok(activity.length>=3);assert.ok(activity.every(a=>a.membership_id===null));
 assert.ok(activity.some(a=>a.action==='Desktop user removed'));
 assert.notEqual((await f.invite()).id,grant.id);
 }finally{await f.db.close();}
});
test('removing a managed desktop login deletes its credentials and sessions',async()=>{
 const f=await setup();try{
 const grant=await f.invite({email:'new@example.com',password:'Initial-password-123'});
 await f.db.query("INSERT INTO team_access_sessions VALUES($1,$2,now()+interval '1 day')",['test-token',grant.id]);
 await f.service.removeTeamGrant(owner,grant.id,grant.version);
 assert.equal((await f.db.query('SELECT * FROM team_access_logins')).rows.length,0);
 assert.equal((await f.db.query('SELECT * FROM team_access_sessions')).rows.length,0);
 }finally{await f.db.close();}
});
