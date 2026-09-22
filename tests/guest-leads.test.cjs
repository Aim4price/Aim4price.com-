const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks={}){const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',code)(name=>name in mocks?mocks[name]:require(name),exports);return exports;}
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
const shared=load('lib/business-network-shared.ts');
const snapshot=load('lib/asset-share-snapshot.ts',{'./asset-usage':load('lib/asset-usage.ts'),'./tractor-logic':{conditionLabel:key=>key}});
const asset={id:A,userId:'owner',title:'Tractor',kind:'tractor',serialNumber:'1234',value:100000,photos:[],condition:'good',privateNote:'PRIVATE',documents:[{name:'PRIVATE'}]};
const details={recipientName:'Workshop',recipientEmail:'workshop@example.com',request:'Please quote to repair this tractor.',replyName:'Owner',replyEmail:'owner@example.com',replyPhone:'0821234567',allowReply:true};
async function setup(){
 const pg=new PGlite();await pg.exec('CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text NOT NULL)');await pg.query('INSERT INTO asset_register_items VALUES($1,$2),($3,$4)',[A,'owner',B,'other']);
 const query=(sql,params)=>params?pg.query(sql,params):pg.exec(sql).then(rows=>rows.at(-1));const client={query,release(){}},db={query,connect:async()=>client};
 const assetDb={getAssetRegisterItemsByRefs:async refs=>{const rows=(await pg.query('SELECT * FROM asset_register_items')).rows;return rows.filter(row=>refs.some(ref=>ref.assetId===row.id&&ref.userId===row.user_id)).map(row=>({...asset,id:row.id,userId:row.user_id}));}};
 const base=load('lib/asset-share-links.ts',{'./db':{getDb:()=>db},'./asset-register-db':assetDb,'./asset-share-snapshot':snapshot});
 const schema=load('lib/guest-lead-schema.ts',{'./db':{getDb:()=>db},'./asset-share-links':base,'./business-network':{ensureBusinessNetwork:async()=>{await pg.exec("CREATE TABLE IF NOT EXISTS business_network(id uuid PRIMARY KEY,email text UNIQUE,name text,status text)");}}});
 await schema.ensureGuestLeadSchema();return{pg,db,assetDb,base,schema};
}
test('acceptances are durable, do not publish and cannot overwrite an earlier acceptance',async()=>{
 const ctx=await setup(),{pg,db,schema}=ctx;
 const mod=load('lib/business-acceptances.ts',{'./db':{getDb:()=>db},'./guest-lead-schema':schema,'./business-network-shared':shared});
 try{const input={email:'workshop@example.com',businessName:'Workshop',contactName:'Manager',phone:'0821234567',accepted:true};
 await assert.rejects(mod.recordBusinessAcceptance({...input,accepted:false}),/Confirm/);
 await mod.recordBusinessAcceptance(input);await mod.recordBusinessAcceptance({...input,businessName:'Overwritten'});
 const rows=await mod.listBusinessAcceptances();assert.equal(rows.length,1);assert.equal(rows[0].business_name,'Workshop');assert.equal(rows[0].business_id,null);assert.equal((await pg.query('SELECT * FROM business_network')).rows.length,0);
 }finally{await pg.close();}
});
test('guest email codes are one-use and expire; sessions and manual activation cannot grant themselves paid access',async()=>{
 const{pg,db,schema}=await setup();let cookie='',sent=[];const limits=[];
 const oldKey=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='local-test';
 const mod=load('lib/guest-business-access.ts',{'next/headers':{cookies:()=>({get:()=>({value:cookie})})},'./db':{getDb:()=>db},'./guest-lead-schema':schema,'./business-network-shared':shared,'./business-network':{limitBusinessAction:async(key,limit)=>limits.push([key,limit])},'./email':{sendAim4priceEmail:async message=>sent.push(message)}});
 try{
 await mod.startGuestLogin({email:details.recipientEmail,businessName:'Workshop',contactName:'Manager'},'ip');
 const code=sent[0].text.match(/\b\d{6}\b/)[0];
 await assert.rejects(mod.verifyGuestLogin(details.recipientEmail,'000000','ip'),/invalid/);
 cookie=await mod.verifyGuestLogin(details.recipientEmail,code,'ip');
 assert.equal((await mod.getGuestViewer()).active,false);
 await assert.rejects(mod.verifyGuestLogin(details.recipientEmail,code,'ip'),/invalid/);
 await assert.rejects(mod.setGuestBusinessAccess('admin',{email:details.recipientEmail,action:'activate',accessUntil:'2020-01-01'}),/future/);
 await mod.setGuestBusinessAccess('admin',{email:details.recipientEmail,action:'activate',accessUntil:new Date(Date.now()+86400000).toISOString(),note:'Paid offline'});
 assert.equal((await mod.getGuestViewer()).active,true);
 await mod.setGuestBusinessAccess('admin',{email:details.recipientEmail,action:'suspend'});assert.equal((await mod.getGuestViewer()).active,false);
 await pg.query("UPDATE guest_businesses SET suspended=false,access_until=now()-interval '1 second'");assert.equal((await mod.getGuestViewer()).active,false);
 assert.equal((await pg.query('SELECT * FROM guest_access_actions')).rows.length,2);
 await mod.startGuestLogin({email:details.recipientEmail,businessName:'Workshop',contactName:'Manager'},'ip');const expiredCode=sent.at(-1).text.match(/\b\d{6}\b/)[0];await pg.query("UPDATE guest_login_codes SET expires_at=now()-interval '1 second'");await assert.rejects(mod.verifyGuestLogin(details.recipientEmail,expiredCode,'ip'),/expired/);
 await mod.endGuestSession();assert.equal(await mod.getGuestViewer(),null);assert.ok(limits.some(([key])=>key.startsWith('guest-verify-email:')));
 }finally{if(oldKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=oldKey;await pg.close();}
});
test('each lead and report is owner/recipient scoped; payment never bypasses owner selection or lifecycle',async()=>{
 const{pg,db,schema,base,assetDb}=await setup();let session=null,guest=null;
 const mod=load('lib/guest-leads.ts',{'./db':{getDb:()=>db},'./guest-lead-schema':schema,'./business-network-shared':shared,'./asset-register-db':assetDb,'./asset-share-snapshot':snapshot,'./asset-share-links':base,'./guest-business-access':{getGuestViewer:async()=>guest},'./auth-session':{getServerSession:async()=>session},'./asset-register-account-access':{getAssetRegisterAccountAccess:async()=>({accountType:'owner'})}});
 try{
 const pdf={label:'Valuation',fileName:'valuation.pdf',data:Buffer.from('%PDF-1.4\nprivate report')};
 await assert.rejects(mod.createGuestLead('owner',[B],false,details,[pdf]),/does not own/);
 await assert.rejects(mod.createGuestLead('owner',[A],false,details,[{...pdf,data:Buffer.from('<html>')}]),/PDF/);
 const one=await mod.createGuestLead('owner',[A],false,details,[pdf]);const two=await mod.createGuestLead('owner',[A],false,{...details,recipientEmail:'second@example.com'},[pdf]);
 assert.notEqual(one.token,two.token);
 assert.equal((await mod.listOwnerGuestLeads('other',[A])).length,0);
 const lead=await mod.readLeadPage(one.token),other=await mod.readLeadPage(two.token),reportId=lead.reports[0].id;
 assert.ok(!JSON.stringify(lead).includes('private report'));assert.ok(!JSON.stringify(lead).includes('PRIVATE'));
 assert.equal((await mod.loadProtectedLeadReport(one.token,reportId)).status,403);
 guest={email:details.recipientEmail,active:false};assert.equal(await mod.resolveLeadAccess('owner',details.recipientEmail),'payment-required');assert.equal((await mod.loadProtectedLeadReport(one.token,reportId)).status,403);
 guest={email:'second@example.com',active:true};assert.equal((await mod.loadProtectedLeadReport(one.token,reportId)).status,403);
 guest={email:details.recipientEmail,active:true};assert.equal((await mod.loadProtectedLeadReport(one.token,reportId)).status,200);assert.equal((await mod.loadProtectedLeadReport(one.token,other.reports[0].id)).status,404);assert.equal((await mod.loadProtectedLeadReport(two.token,other.reports[0].id)).status,403);
 guest=null;session={user:{id:'other',email:details.recipientEmail,emailVerified:false}};assert.equal((await mod.loadProtectedLeadReport(one.token,reportId)).status,403);session.user.emailVerified=true;assert.equal((await mod.loadProtectedLeadReport(one.token,reportId)).status,200);
 session={user:{id:'owner'}};assert.equal(await mod.resolveLeadAccess('owner',details.recipientEmail),'owner');session=null;
 await base.revokeAssetShareLink('other',one.token);assert.ok(await mod.readLeadPage(one.token));await base.revokeAssetShareLink('owner',one.token);assert.equal(await mod.readLeadPage(one.token),null);assert.equal((await mod.loadProtectedLeadReport(one.token,reportId)).status,404);
 guest={email:'second@example.com',active:true};await pg.query('UPDATE asset_register_items SET user_id=$1 WHERE id=$2',['other',A]);assert.equal((await mod.loadProtectedLeadReport(two.token,other.reports[0].id)).status,404);
 }finally{await pg.close();}
});
test('guest activation API rejects non-admins and foreign origins',async()=>{
 const{NextRequest}=require('next/server');let user=null,called=false;
 const route=load('app/api/admin/guest-businesses/route.ts',{'next/server':require('next/server'),'../../../../lib/auth-session':{getAnyServerSession:async()=>user?{user}:null},'../../../../lib/account-constants':{isAim4priceAdminEmail:email=>email==='admin@example.com'},'../../../../lib/guest-business-access':{setGuestBusinessAccess:async()=>{called=true;},listGuestBusinesses:async()=>[]},'../../../../lib/business-acceptances':{listBusinessAcceptances:async()=>[]},'../../../../lib/business-network-api':{businessJson:(data,status=200)=>Response.json(data,{status}),businessBody:request=>request.json(),businessError:()=>Response.json({}, {status:400})},'../../../../lib/trusted-request-origin':{isTrustedRequestOrigin:origin=>origin==='https://aim4price.com'}});
 const req=origin=>new NextRequest('https://aim4price.com/api/admin/guest-businesses',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{}'});
 assert.equal((await route.POST(req('https://aim4price.com'))).status,403);user={id:'user',email:details.recipientEmail};assert.equal((await route.POST(req('https://aim4price.com'))).status,403);user={id:'admin',email:'admin@example.com'};assert.equal((await route.POST(req('https://evil.example'))).status,403);assert.equal(called,false);assert.equal((await route.POST(req('https://aim4price.com'))).status,200);assert.equal(called,true);
});
