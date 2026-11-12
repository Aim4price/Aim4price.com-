const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const {randomUUID,createHash}=require('node:crypto');
function load(file,mocks={}){const out={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(name in mocks)return mocks[name];throw Error('Unexpected dependency '+name)},out);return out;}
const policy=load('lib/team-access-policy.ts');
const account=load('lib/team-account-policy.ts',{'./team-access-policy':policy});
const clients=load('lib/team-client-policy.ts',{'./team-access-policy':policy});
test('Owner presets and existing grants gain no client capabilities; unsupported account types fail closed',()=>{
 assert.equal(account.teamAccountKind('finance'),null);
 assert.equal(account.teamAccountKind('dealer','machinery-middleman'),null);
 assert.equal(account.teamTemplates('owner'),policy.TEAM_TEMPLATES);
 for(const template of Object.values(policy.TEAM_TEMPLATES))for(const p of policy.CLIENT_TEAM_PERMISSIONS)assert.equal(template.permissions[p.key],false);
 const forged=account.accountTeamPermissions(Object.fromEntries(policy.TEAM_PERMISSIONS.map(p=>[p.key,true])),'owner');
 for(const p of policy.CLIENT_TEAM_PERMISSIONS)assert.equal(forged[p.key],false);
 assert.equal(forged.viewValues,true);
});
test('Dealer and Business presets separate financial and enquiry authority',()=>{
 const dealer=account.teamTemplates('dealer'),business=account.teamTemplates('business');
 assert.equal(dealer.sales.permissions.manageClientEnquiries,true);
 assert.equal(dealer.technician.permissions.manageClientEnquiries,false);
 assert.equal(dealer.technician.permissions.completeMaintenance,true);
 assert.equal(dealer.parts.permissions.viewClientContacts,false);assert.equal(dealer.parts.permissions.viewParts,true);assert.equal(dealer.parts.permissions.manageParts,true);
 for(const template of [dealer.viewer,dealer.sales,dealer.technician,dealer.parts,business.viewer,business.staff])for(const key of ['viewValues','viewClientValues','viewCosts','viewFuelCosts','deleteCosts'])assert.equal(template.permissions[key],false,key);
 for(const kind of ['owner','dealer','business'])for(const template of Object.values(account.teamTemplates(kind)))assert.deepEqual(policy.normalizeTeamPermissions(template.permissions),template.permissions);
});
test('Client work needs its own scope and values; owned all-assets scope grants no client access',()=>{
 const grant={scope:'all',clientWorkIds:['lead:a'],permissions:{...policy.EMPTY_TEAM_PERMISSIONS,viewClientWork:true,viewValues:true}};
 assert.equal(clients.clientWorkSelected(grant,'lead:a'),true);assert.equal(clients.clientWorkSelected(grant,'lead:b'),false);
 const output=clients.projectClientAsset({title:'Tractor',serialNumber:'A',yearModel:2024,usage:'100 h',condition:'good',valueExVat:987654,replacementPriceExVat:456789,photoUrls:['SECRET'],publicUrl:'TOKEN',financeBalance:12345},grant.permissions);
 assert.equal(Object.hasOwn(output,'values'),false);assert.ok(!JSON.stringify(output).includes('SECRET'));assert.ok(!JSON.stringify(output).includes('TOKEN'));
 const p=policy.updateTeamPermission({...grant.permissions,viewClientValues:true,viewClientContacts:true,manageClientEnquiries:true},'viewClientWork',false);
 for(const key of ['viewClientValues','viewClientContacts','manageClientEnquiries'])assert.equal(p[key],false);
 for(const status of ['closed','sent','delete','accepted_at=now()'])assert.throws(()=>clients.clientEnquiryStatus(status));
});
async function fixture(){
 const db=new PGlite();const asset=randomUUID(),lead=randomUUID();const token='private-token';let type='dealer',readable=true,shareAvailable=true;
 await db.exec(`CREATE TABLE "user"(id text,email text,"emailVerified" boolean); INSERT INTO "user" VALUES('dealer','office@example.com',true);
 CREATE TABLE account_profiles(user_id text,account_status text,business_name text,display_name text);INSERT INTO account_profiles VALUES('owner','active','Client A','Owner');
 CREATE TABLE asset_register_items(id uuid,user_id text,lifecycle_state text);
 CREATE TABLE asset_leads(id uuid,asset_register_item_id uuid,owner_user_id text,partner_user_id text,status text,asset_snapshot_json jsonb,included_sections_json jsonb,owner_contact_name text,owner_contact_email text,owner_contact_phone text,created_at timestamptz);
 CREATE TABLE asset_share_links(token text,user_id text,lead_details jsonb,revoked_at timestamptz,history_deleted_at timestamptz,created_at timestamptz);`);
 await db.query('INSERT INTO asset_register_items VALUES($1,\'owner\',\'active\')',[asset]);
 await db.query(`INSERT INTO asset_leads VALUES($1,$2,'owner','dealer','sent',$3,$4,'Contact','SECRET_EMAIL','SECRET_PHONE',now())`,[lead,asset,JSON.stringify({title:'Tractor',serialNumber:'S',selectedValueExVat:987654,note:'PRIVATE'}),JSON.stringify({assetDetails:true,valuationSummary:false})]);
 await db.query(`INSERT INTO asset_share_links VALUES($1,'owner',$2,NULL,NULL,now())`,[token,JSON.stringify({recipientEmail:'office@example.com',replyName:'Contact',replyEmail:'SECRET_EMAIL'})]);
 const module=load('lib/team-client-work.ts',{'node:crypto':require('node:crypto'),'./db':{getDb:()=>({query:(...args)=>db.query(...args)})},'./partner-access':{ensurePartnerAccessTables:async()=>{}},'./guest-lead-schema':{ensureGuestLeadSchema:async()=>{}},'./asset-share-links':{readPublicAssetShare:async()=>shareAvailable?{senderName:'Client A',assets:[{title:'Shared tractor',serialNumber:'S',yearModel:2024,condition:'good',usage:'123 h',valueExVat:null,replacementPriceExVat:null,photoUrls:['SECRET_URL'],publicUrl:token}]}:null},'./business-accounts':{canBusinessRead:async()=>readable},'./account-profile':{getAccountProfile:async()=>({accountType:type,accountStatus:'active'})},'./team-account-policy':account,'./team-client-policy':clients,'./team-access-policy':policy});
 const shareId='share:'+createHash('sha256').update(token).digest('hex');
 const grant={ownerId:'dealer',clientWorkIds:['lead:'+lead,shareId],permissions:{...policy.EMPTY_TEAM_PERMISSIONS,viewClientWork:true}};
 return {db,asset,lead,token,shareId,grant,list:()=>module.listTeamClientWork('dealer',grant),directory:()=>module.listTeamClientWork('dealer'),setType:t=>type=t,setReadable:v=>readable=v,setShareAvailable:v=>shareAvailable=v};
}
test('Real SQL restricts received enquiries and addressed shares; raw data and contact details stay hidden',async()=>{
 const f=await fixture();try{
 const rows=await f.list();assert.equal(rows.length,2);
 for(const secret of ['SECRET','PRIVATE',f.token,'987654'])assert.ok(!JSON.stringify(rows).includes(secret),secret);
 f.grant.permissions.viewClientValues=true;assert.equal((await f.list())[0].assets[0].values.current,null,'client did not share values');
 f.grant.permissions.viewClientContacts=true;assert.ok(JSON.stringify(await f.list()).includes('SECRET_EMAIL'));
 f.grant.clientWorkIds=[];assert.deepEqual(await f.list(),[]);
 }finally{await f.db.close();}
});
test('Revoked shares, changed recipients, transfers and closed enquiries disappear on the next request',async()=>{
 const f=await fixture();try{
 await f.db.query('UPDATE asset_register_items SET user_id=\'new-owner\' WHERE id=$1',[f.asset]);assert.equal((await f.list()).length,1);
 await f.db.query('UPDATE asset_share_links SET revoked_at=now()');assert.deepEqual(await f.list(),[]);
 await f.db.query('UPDATE asset_share_links SET revoked_at=NULL,lead_details=$1',[JSON.stringify({recipientUserId:'someone-else',recipientEmail:'office@example.com'})]);assert.deepEqual(await f.list(),[]);
 await f.db.query('UPDATE asset_register_items SET user_id=\'owner\' WHERE id=$1',[f.asset]);await f.db.query("UPDATE asset_leads SET status='closed'");assert.deepEqual(await f.list(),[]);
 }finally{await f.db.close();}
});
test('Business delegation never bypasses original business eligibility or a vanished live share',async()=>{
 const f=await fixture();try{f.setType('business');f.setReadable(false);assert.deepEqual(await f.list(),[]);f.setReadable(true);f.setShareAvailable(false);assert.equal((await f.list()).length,1);f.setType('owner');assert.deepEqual(await f.directory(),[]);}finally{await f.db.close();}
});
test('Actual client route locks current grants, rejects forged targets, and audits the staff actor',async()=>{
 const f=await fixture();try{
 const membership=randomUUID(),actor={id:'staff',email:'staff@example.com',emailVerified:true};
 const grant={...f.grant,id:membership,status:'active',memberUserId:'staff',email:actor.email,version:1,expiresAt:null};grant.permissions.manageClientEnquiries=true;
 await f.db.exec('CREATE TABLE team_access(id uuid,status text,version integer,client_work_ids jsonb,permissions jsonb); ALTER TABLE asset_leads ADD COLUMN viewed_at timestamptz; ALTER TABLE asset_leads ADD COLUMN accepted_at timestamptz; ALTER TABLE asset_leads ADD COLUMN quoted_at timestamptz; ALTER TABLE asset_leads ADD COLUMN declined_at timestamptz; ALTER TABLE asset_leads ADD COLUMN updated_at timestamptz;');
 await f.db.query('INSERT INTO team_access VALUES($1,\'active\',1,$2,$3)',[membership,JSON.stringify(grant.clientWorkIds),JSON.stringify(grant.permissions)]);
 const client={query:(...args)=>f.db.query(...args),release(){}};let audits=[],origin=true,issuer=true;
 const route=load('app/api/team-workspaces/[membershipId]/client-work/route.ts',{
  'next/server':{},'../../../../../lib/db':{getDb:()=>({connect:async()=>client})},
  '../../../../../lib/team-access':{loadTeamScope:async()=>({actor,grant}),mapTeamGrant:row=>({...grant,status:row.status,version:row.version,clientWorkIds:row.client_work_ids,permissions:row.permissions}),auditTeam:async(_db,who,_grant,action,assetId,details)=>audits.push({who,action,assetId,details}),teamIssuerAvailable:async()=>issuer},
  '../../../../../lib/account-profile':{getAccountProfile:async()=>({})},
  '../../../../../lib/team-client-work':{listTeamClientWork:async()=>[{id:'lead:'+f.lead,canRespond:true}]},
  '../../../../../lib/team-client-policy':clients,'../../../../../lib/team-access-policy':policy,
  '../../../../../lib/business-network-api':{requireBusinessOrigin:()=>{if(!origin)throw new policy.TeamAccessError('Origin rejected');},businessBody:async request=>request.body},
  '../../../../../lib/business-network':{limitBusinessAction:async()=>{}},
  '../../../../../lib/team-access-http':{teamJson:body=>({status:200,body}),teamError:error=>({status:error.status||500,body:{error:error.message}})},
 });
 const request=(id,status='accepted')=>route.PATCH({body:{id,status,ownerId:'forged',actorId:'owner'}},{params:{membershipId:membership}});
 assert.equal((await request('lead:'+randomUUID())).status,404);
 assert.equal((await request('lead:'+f.lead,'closed')).status,400);
 origin=false;assert.equal((await request('lead:'+f.lead)).status,403);origin=true;
 await f.db.query("UPDATE team_access SET status='revoked'");assert.equal((await request('lead:'+f.lead)).status,409);
 await f.db.query("UPDATE team_access SET status='active',version=2");assert.equal((await request('lead:'+f.lead)).status,409);
 await f.db.query("UPDATE team_access SET version=1,client_work_ids='[]'");assert.equal((await request('lead:'+f.lead)).status,409);
 await f.db.query('UPDATE team_access SET client_work_ids=$1',[JSON.stringify(grant.clientWorkIds)]);
 issuer=false;assert.equal((await request('lead:'+f.lead)).status,403);issuer=true;
 assert.equal((await request('lead:'+f.lead)).status,200);assert.equal(audits.length,1);assert.equal(audits[0].who.id,'staff');assert.equal(audits[0].details.status,'accepted');
 assert.equal((await f.db.query('SELECT status FROM asset_leads WHERE id=$1',[f.lead])).rows[0].status,'accepted');
 await f.db.query("UPDATE asset_register_items SET user_id='someone-else'");assert.equal((await request('lead:'+f.lead,'quoted')).status,404);assert.equal(audits.length,1);
 }finally{await f.db.close();}
});
