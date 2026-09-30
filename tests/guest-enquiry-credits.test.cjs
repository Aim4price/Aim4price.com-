const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),exports);return exports;}
test('guest credits require the recipient, count once per enquiry, and enforce lifecycle and suspension',async()=>{
 const pg=new PGlite(),old=process.env.AIM4PRICE_GUEST_ENQUIRY_CREDITS;let guest={email:'guest@example.test',suspended:false};
 const query=(s,p)=>pg.query(s,p),db={query,connect:async()=>({query,release(){}})};
 try{
  await pg.exec(`CREATE TABLE guest_businesses(email text PRIMARY KEY,suspended boolean);CREATE TABLE "user"(id text,email text);CREATE TABLE account_profiles(user_id text,account_status text);CREATE TABLE asset_register_items(id uuid,user_id text);CREATE TABLE asset_share_links(token text,revoked_at timestamptz,user_id text,asset_ids uuid[],lead_details jsonb);`);
  await pg.exec(fs.readFileSync('database/migrations/118-guest-enquiry-credits.sql','utf8'));
  await pg.exec(`INSERT INTO guest_businesses VALUES('guest@example.test',false);INSERT INTO asset_register_items VALUES('10000000-0000-4000-8000-000000000001','owner');`);
  for(const token of ['one','two','three'])await query(`INSERT INTO asset_share_links VALUES($1,NULL,'owner',ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'{"recipientEmail":"guest@example.test"}')`,[token]);
  const mod=load('lib/guest-enquiry-credits.ts',{'./db':{getDb:()=>db},'./guest-lead-schema':{ensureGuestLeadSchema:async()=>{}},'./guest-business-access':{getGuestViewer:async()=>guest}});
  process.env.AIM4PRICE_GUEST_ENQUIRY_CREDITS='2';
  assert.equal((await mod.guestEnquiryAccess('one','wrong@example.test')).access,'wrong-recipient');
  assert.equal((await mod.guestEnquiryAccess('one','guest@example.test','bound-user')).access,'wrong-recipient');
  assert.equal((await mod.guestEnquiryAccess('one','guest@example.test')).used,1);
  assert.equal((await mod.guestEnquiryAccess('one','guest@example.test')).used,1);
  assert.equal((await mod.guestEnquiryAccess('two','guest@example.test')).used,2);
  assert.equal((await mod.guestEnquiryAccess('three','guest@example.test')).access,'signup-required');
  assert.equal((await mod.guestEnquiryAccess('one','guest@example.test')).access,'guest');
  await query("UPDATE asset_share_links SET revoked_at=now() WHERE token='one'");
  assert.equal((await mod.guestEnquiryAccess('one','guest@example.test')).access,'wrong-recipient');
  await pg.exec(`INSERT INTO "user" VALUES('registered','guest@example.test');INSERT INTO account_profiles VALUES('registered','suspended');`);
  assert.equal((await mod.guestEnquiryAccess('two','guest@example.test')).access,'suspended');
  await pg.exec('DELETE FROM account_profiles;DELETE FROM asset_register_items;');
  assert.equal((await mod.guestEnquiryAccess('two','guest@example.test')).access,'wrong-recipient');
  guest=null;assert.equal((await mod.guestEnquiryAccess('two','guest@example.test')).access,'sign-in');
  delete process.env.AIM4PRICE_GUEST_ENQUIRY_CREDITS;assert.equal(mod.guestCreditLimit(),null);
  process.env.AIM4PRICE_GUEST_ENQUIRY_CREDITS='x';assert.throws(mod.guestCreditLimit,/Invalid/);
  assert.equal(Number((await query('SELECT count(*) AS n FROM guest_enquiry_usage')).rows[0].n),2);
 }finally{if(old===undefined)delete process.env.AIM4PRICE_GUEST_ENQUIRY_CREDITS;else process.env.AIM4PRICE_GUEST_ENQUIRY_CREDITS=old;await pg.close();}
});
test('legacy guest sessions no longer authorise enquiry access or contributions',async()=>{
 const lead={token:'test',details:{recipientEmail:'guest@example.test',permissions:{reports:true,documents:true,serialNumber:true}},reports:[]};
 const permissions=load('lib/external-share-permissions.ts',{});
 const mod=load('lib/external-lead-access.ts',{'./db':{},'./auth-session':{getServerSession:async()=>null},'./account-profile':{},'./business-accounts':{},'./asset-register-account-access':{},'./guest-leads':{readLeadPage:async()=>lead},'./external-share-permissions':permissions,'./guest-enquiry-credits':{guestEnquiryAccess:async()=>({access:'guest'})}});
 assert.equal((await mod.externalLeadAccess(lead)).access,'sign-in');
 await assert.rejects(mod.requireExternalLeadAction('test','documents'),e=>e.status===401);
 await assert.rejects(mod.requireExternalLeadAction('test','serialNumber'),e=>e.status===401);
});
test('guest and account verification emails share the brand and escape links',()=>{
 const brand=load('lib/email-brand.ts',{}),{buildAccessEmail}=load('lib/access-email.ts',{'./email-brand':brand});
 for(const input of [{code:'123456'},{url:'https://aim4price.test/verify?a=1&b="2"'}]){
  const email=buildAccessEmail({...input,origin:'https://aim4price.test'});
  assert.match(email.html,/Aim4price.com/);assert.match(email.html,/Asset Intelligence &amp; Management/);assert.match(email.html,/aim4price-mark-black.png/);
 }
 assert.match(buildAccessEmail({url:'https://example.test/?q="',origin:'https://aim4price.test'}).html,/q=&quot;/);
});
