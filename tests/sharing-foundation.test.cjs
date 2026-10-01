const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>mocks[name]||require(name),exports);return exports;}
async function setup(){const pg=new PGlite();await pg.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text,"emailVerified" boolean);CREATE TABLE "session"(id text PRIMARY KEY,"userId" text);CREATE TABLE account_profiles(user_id text PRIMARY KEY,account_type text,account_subtype text,account_status text,updated_at timestamptz);INSERT INTO "user" VALUES('dealer','dealer@example.test',true);INSERT INTO account_profiles VALUES('dealer','dealer','machinery-dealer','pending_payment',now());`);const query=(s,p)=>p?pg.query(s,p):pg.exec(s).then(r=>r.at(-1));const db={query,connect:async()=>({query,release(){}})};return{pg,lib:load('lib/sharing-foundation.ts',{'./db':{getDb:()=>db}})};}
test('account ledger deduplicates retries, survives upgrade and records uploads by successful event',async()=>{const x=await setup();try{
 await x.lib.registerFreeSharingAccount('dealer');assert.equal(await x.lib.sharingPlan('dealer'),'free');
 const input={accountId:'dealer',actorId:'dealer',sessionId:'session-one',metric:'upload',eventKey:'upload-one',bytes:123};
 await Promise.all([x.lib.recordSharingUsage(input),x.lib.recordSharingUsage(input)]);
 await x.lib.recordSharingUsage({...input,sessionId:'session-two'});
 assert.deepEqual((await x.lib.sharingUsageSummary('dealer')).upload,{count:1,bytes:123});
 await x.lib.activateSharingDesktop('admin','dealer');assert.equal(await x.lib.sharingPlan('dealer'),'desktop');
 assert.equal((await x.pg.query('SELECT account_status FROM account_profiles')).rows[0].account_status,'active');
 assert.deepEqual((await x.lib.sharingUsageSummary('dealer')).upload,{count:1,bytes:123});
 await x.lib.registerFreeSharingAccount('dealer');assert.equal(await x.lib.sharingPlan('dealer'),'desktop','Registration cannot downgrade an existing account');
 await x.pg.query("UPDATE account_profiles SET account_status='suspended'");await assert.rejects(x.lib.activateSharingDesktop('admin','dealer'),/non-suspended/);
}finally{await x.pg.close();}});
test('draft limits are validated and cannot switch enforcement on',async()=>{const x=await setup();try{
 await x.lib.saveSharingAllowances('admin',{assets:0,uploads:10,interactions:null,emails:0,enforcing:true});
 assert.deepEqual(await x.lib.sharingAllowances(),{assets:0,uploads:10,interactions:null,emails:0,enforcing:false});
 await assert.rejects(x.lib.saveSharingAllowances('admin',{assets:-1,uploads:null,interactions:null,emails:null}),/whole number/);
 assert.equal((await x.lib.sharingAllowances()).uploads,10);
}finally{await x.pg.close();}});
test('free sessions expire on idle or absolute timeout while usage persists',async()=>{const x=await setup();try{
 await x.lib.registerFreeSharingAccount('dealer');const session={user:{id:'dealer'},session:{id:'first',createdAt:new Date()}};
 await x.pg.query('INSERT INTO "session" VALUES($1,$2)',['first','dealer']);assert.equal(await x.lib.sharingSessionIsActive(session),true);
 await x.pg.query("UPDATE sharing_session_activity SET last_seen_at=now()-interval '31 minutes'");
 assert.equal(await x.lib.sharingSessionIsActive(session),false);assert.equal((await x.pg.query('SELECT * FROM "session"')).rows.length,0);
 const expired={user:{id:'dealer'},session:{id:'old',createdAt:new Date(Date.now()-13*60*60*1000)}};
 assert.equal(await x.lib.sharingSessionIsActive(expired),false);
 const fresh={user:{id:'dealer'},session:{id:'new',createdAt:new Date()}};assert.equal(await x.lib.sharingSessionIsActive(fresh),true);
}finally{await x.pg.close();}});

test('usage endpoint ignores supplied identity, rejects unauthorised reads and never meters owner previews',async()=>{
 const {NextRequest}=require('next/server');const events=[];let access='sign-in';let available=true;
 const token='a'.repeat(43),assetId='10000000-0000-4000-8000-000000000001';
 const route=load('app/api/asset-share-links/[token]/activity/route.ts',{
  'next/server':require('next/server'),
  '../../../../../lib/guest-leads':{readLeadPage:async()=>available?{share:{assets:[{assetId}]}}:null},
  '../../../../../lib/external-lead-access':{externalLeadAccess:async()=>({access,user:access==='sign-in'?null:{id:'real-user'}})},
  '../../../../../lib/auth-session':{getServerSession:async()=>({user:{id:'real-user'},session:{id:'real-session'}})},
  '../../../../../lib/sharing-foundation':{recordSharingUsage:async event=>events.push(event)},
  '../../../../../lib/trusted-request-origin':{isTrustedRequestOrigin:(origin)=>origin==='https://aim4price.test'},
 });
 const request=(origin='https://aim4price.test')=>new NextRequest('https://aim4price.test/api/asset-share-links/'+token+'/activity',{method:'POST',headers:{origin},body:JSON.stringify({accountId:'forged',sessionId:'forged'})});
 const call=origin=>route.POST(request(origin),{params:{token}});
 assert.equal((await call()).status,403);access='active';assert.equal((await call('https://evil.test')).status,403);assert.equal(events.length,0);
 assert.equal((await call()).status,200);assert.equal(events.length,2);assert.ok(events.every(e=>e.accountId==='real-user'&&e.sessionId==='real-session'));assert.equal(events[1].eventKey,assetId);
 access='owner';await call();assert.equal(events.length,2);
 available=false;assert.equal((await call()).status,404);assert.equal(events.length,2);
});

test('allowances and activation are admin-only and require same-origin explicit subscription confirmation',async()=>{
 const {NextRequest}=require('next/server');let session=null;const changes=[];
 const route=load('app/api/admin/sharing/route.ts',{
 '../../../../lib/sharing-admin':{signOutSharingAccount:async(...args)=>changes.push(args)},
 'next/server':require('next/server'), '../../../../lib/auth-session':{getAnyServerSession:async()=>session},
 '../../../../lib/account-constants':{isAim4priceAdminEmail:email=>email==='admin@example.test'},
 '../../../../lib/trusted-request-origin':{isTrustedRequestOrigin:origin=>origin==='https://aim4price.test'},
 '../../../../lib/sharing-foundation':{activateSharingDesktop:async(...args)=>changes.push(args),saveSharingAllowances:async(...args)=>changes.push(args)},
 });
 const call=(input,origin='https://aim4price.test')=>route.PATCH(new NextRequest('https://aim4price.test/api/admin/sharing',{method:'PATCH',headers:{origin},body:JSON.stringify(input)}));
 const input={action:'activate-desktop',userId:'free-user',subscriptionConfirmed:true};
 assert.equal((await call(input)).status,403);session={user:{id:'ordinary',email:'user@example.test'}};assert.equal((await call(input)).status,403);
 session={user:{id:'admin',email:'admin@example.test'}};assert.equal((await call(input,'https://evil.test')).status,403);
 assert.equal((await call({...input,subscriptionConfirmed:false})).status,400);assert.equal(changes.length,0);
 assert.equal((await call(input)).status,200);assert.deepEqual(changes,[['admin','free-user']]);
 assert.equal((await call({action:'sign-out',userId:'free-user'},'https://evil.test')).status,403);
 assert.equal((await call({action:'sign-out',userId:'free-user'})).status,200);assert.deepEqual(changes[1],['admin','free-user']);
 session={user:{id:'ordinary',email:'user@example.test'}};assert.equal((await call({action:'sign-out',userId:'free-user'})).status,403);
});

test('free Dealer signup bypasses invoices but cannot request a free Owner account',async()=>{
 let context,authCalls=0,billingCalls=0;
 const route=load('app/api/auth/[...all]/route.ts',{
 '../../../../lib/retired-workspaces':load('lib/retired-workspaces.ts',{}),
 '../../../../lib/billing':{BillingError:class extends Error{},validateSignupBilling:async()=>{billingCalls++;return{};}},
 '../../../../lib/auth':{auth:{}},'better-auth/next-js':{toNextJsHandler:()=>({POST:async()=>{authCalls++;return Response.json({ok:true});}})},
 '../../../../lib/signup-workspace-context':{withSignupWorkspaceInput:async(input,fn)=>{context=input;return fn();}},
 });
 const call=accountType=>route.POST(new Request('https://aim4price.test/api/auth/sign-up/email',{method:'POST',body:JSON.stringify({accountType,accountAccess:'free',acceptedTerms:true})}));
 assert.equal((await call('dealer')).status,200);assert.equal(billingCalls,0);assert.equal(context.accountAccess,'free');
 assert.equal((await call('owner')).status,400);assert.equal(authCalls,1);
});

test('email costs distinguish provider acceptance from failure and use a distinct attempt id',async()=>{
 const savedFetch=global.fetch,savedKey=process.env.RESEND_API_KEY;const events=[];let ok=true;
 process.env.RESEND_API_KEY='test-only';global.fetch=async()=>new Response(ok?'{}':'rejected',{status:ok?200:503});
 try{
 const mail=load('lib/email.ts',{'./sharing-foundation':{recordSharingUsage:async e=>events.push(e)},'./external-share-permissions':load('lib/external-share-permissions.ts',{}),'./email-brand':load('lib/email-brand.ts',{})});
 const input={to:'test@example.test',subject:'test',text:'test',html:'test',usage:{accountId:'owner',actorId:'owner',eventKey:'reminder-one'}};
 await mail.sendAim4priceEmail(input);ok=false;await assert.rejects(mail.sendAim4priceEmail(input),/503/);
 assert.deepEqual(events.map(e=>e.metric),['email_attempt','email_accepted','email_attempt','email_failed']);
 assert.equal(events[0].eventKey,events[1].eventKey);assert.notEqual(events[0].eventKey,events[2].eventKey);
 }finally{global.fetch=savedFetch;if(savedKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=savedKey;}
});

test('migration can be repeated without changing existing account usage',async()=>{
 const x=await setup();try{
 await x.lib.registerFreeSharingAccount('dealer');
 await x.lib.recordSharingUsage({accountId:'dealer',actorId:'dealer',metric:'enquiry_opened',eventKey:'existing'});
 await x.pg.exec('CREATE TABLE asset_share_links(token text);CREATE TABLE business_network_requests(id text)');
 const sql=fs.readFileSync('database/migrations/123-live-sharing-foundation.sql','utf8');await x.pg.exec(sql);await x.pg.exec(sql);
 assert.equal(await x.lib.sharingPlan('dealer'),'free');assert.equal((await x.lib.sharingUsageSummary('dealer')).enquiry_opened.count,1);
 }finally{await x.pg.close();}
});

test('History deletion is owner-only, requires revocation and keeps the revoked link record',async()=>{
 const {NextRequest}=require('next/server');const pg=new PGlite();
 const active='a'.repeat(43),revoked='r'.repeat(43),foreign='f'.repeat(43),assetId='10000000-0000-4000-8000-000000000001';
 let session={user:{id:'owner'}};let allowed=true;
 try {
  await pg.exec('CREATE TABLE asset_share_links(token text PRIMARY KEY,user_id text,revoked_at timestamptz,created_at timestamptz DEFAULT now(),asset_ids uuid[],umbrella_id uuid,umbrella_name text,lead_details jsonb);');
  const migration=fs.readFileSync('database/migrations/124-share-history-removal.sql','utf8');await pg.exec(migration);await pg.exec(migration);
  for(const [token,owner,isRevoked] of [[active,'owner',false],[revoked,'owner',true],[foreign,'other',true]])await pg.query('INSERT INTO asset_share_links(token,user_id,revoked_at,asset_ids) VALUES($1,$2,$3,$4)',[token,owner,isRevoked?new Date():null,[assetId]]);
  const route=load('app/api/asset-share-links/history/route.ts',{
   '../../../../lib/auth-session':{getServerSession:async()=>session},
   '../../../../lib/asset-register-account-access':{getAssetRegisterAccountAccess:async()=>allowed},
   '../../../../lib/guest-lead-schema':{ensureGuestLeadSchema:async()=>{}},
   '../../../../lib/db':{getDb:()=>pg},
   '../../../../lib/asset-share-snapshot':{parseShareAssetIds:ids=>ids},
   '../../../../lib/business-network-api':{requireBusinessOrigin:r=>{if(r.headers.get('origin')!=='https://aim4price.com')throw Error('Origin');},businessBody:r=>r.json()},
  });
  const remove=(token,origin='https://aim4price.com')=>route.DELETE(new NextRequest('https://aim4price.com/api/asset-share-links/history',{method:'DELETE',headers:{origin,'content-type':'application/json'},body:JSON.stringify({token})}));
  session=null;assert.equal((await remove(revoked)).status,403);session={user:{id:'owner'}};
  allowed=false;assert.equal((await remove(revoked)).status,403);allowed=true;
  assert.equal((await remove(revoked,'https://other.test')).status,400);
  assert.equal((await remove(active)).status,409);assert.equal((await remove(foreign)).status,409);
  assert.equal((await remove('bad')).status,400);
  assert.equal((await remove(revoked)).status,200);assert.equal((await remove(revoked)).status,200);
  const rows=(await pg.query('SELECT * FROM asset_share_links ORDER BY token')).rows;
  assert.equal(rows.length,3);assert.ok(rows.find(r=>r.token===revoked).revoked_at);assert.ok(rows.find(r=>r.token===revoked).history_deleted_at);
  assert.equal(rows.find(r=>r.token===foreign).history_deleted_at,null);
  const history=await route.GET(new NextRequest('https://aim4price.com/api/asset-share-links/history?assetId='+assetId));
  assert.deepEqual((await history.json()).shares.map(r=>r.token),[active]);
 } finally {await pg.close();}
});
