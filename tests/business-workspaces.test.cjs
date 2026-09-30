const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),exports);return exports;}
test('business identity is stable, claims only verified email and preserves guest suspension and usage',async()=>{
 const pg=new PGlite();
 const query=(s,p)=>p?pg.query(s,p):pg.exec(s).then(r=>r.at(-1));
 const db={query,connect:async()=>({query,release(){}})};
 try{
  await pg.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text,"emailVerified" boolean);CREATE TABLE account_profiles(user_id text PRIMARY KEY,account_type text);CREATE TABLE guest_businesses(email text PRIMARY KEY,suspended boolean);CREATE TABLE guest_enquiry_usage(email text,token text);INSERT INTO "user" VALUES('b','first@example.test',false),('o','owner@example.test',true);INSERT INTO account_profiles VALUES('b','business'),('o','owner');INSERT INTO guest_businesses VALUES('first@example.test',true);INSERT INTO guest_enquiry_usage VALUES('first@example.test','old-link');`);
  const m=load('lib/business-workspaces.ts',{'./db':{getDb:()=>db},'./guest-lead-schema':{ensureGuestLeadSchema:async()=>{}}});
  assert.equal(await m.ensureBusinessWorkspace('o'),null,'Owner asset identity is not converted');
  const first=await m.ensureBusinessWorkspace('b');
  assert.equal((await m.ensureBusinessWorkspace('b')).business_id,first.business_id);
  assert.equal((await m.businessWorkspaceSummary('b')).legacyOpened,0,'Unverified email cannot claim guest history');
  await pg.exec('UPDATE "user" SET "emailVerified"=true');
  let summary=await m.businessWorkspaceSummary('b');
  assert.equal(summary.legacyOpened,1);assert.equal(summary.suspended,true);
  await pg.exec(`UPDATE "user" SET email='second@example.test' WHERE id='b'`);
  summary=await m.businessWorkspaceSummary('b');
  assert.equal(summary.business_id,first.business_id);assert.equal(summary.legacyOpened,1);assert.equal(summary.suspended,true,'Email changes do not bypass the migrated suspension');
  await pg.exec(`INSERT INTO "user" VALUES('recycled','first@example.test',true);INSERT INTO account_profiles VALUES('recycled','business');`);
  assert.equal(await m.businessWorkspaceSummary('recycled'),null,'A different account cannot reuse an email already claimed by a business');
  await pg.exec(`DELETE FROM account_profiles WHERE user_id='recycled';DELETE FROM "user" WHERE id='recycled';`);
  await pg.exec(`UPDATE guest_businesses SET suspended=false`);
  assert.equal((await m.businessWorkspaceSummary('b')).suspended,false);
  assert.equal((await pg.query('SELECT count(*)::int n FROM business_workspace_members')).rows[0].n,1);
  await pg.exec(`UPDATE business_workspace_members SET status='revoked'`);
  assert.equal(await m.ensureBusinessWorkspace('b'),null,'Visiting the page cannot reactivate a revoked member');
  await pg.exec(fs.readFileSync('database/migrations/122-business-workspaces.sql','utf8'));
  assert.equal((await pg.query('SELECT count(*)::int n FROM business_workspaces')).rows[0].n,1,'Migration is repeatable');
 }finally{await pg.close();}
});
test('Desktop entitlement is distinct from business approval and active status',()=>{
 const {hasDesktopAccess}=load('lib/account-entitlements.ts');
 assert.equal(hasDesktopAccess({accountType:'business',accountStatus:'active'}),false);
 assert.equal(hasDesktopAccess({accountType:'owner',accountStatus:'active'}),true);
 assert.equal(hasDesktopAccess({accountType:'dealer',accountStatus:'active'}),true);
 assert.equal(hasDesktopAccess({accountType:'owner',accountStatus:'suspended'}),false);
});
test('reset links preserve only a valid enquiry through Better Auth callback nesting',()=>{
 const old=process.env.NEXT_PUBLIC_SITE_URL;process.env.NEXT_PUBLIC_SITE_URL='https://aim4price.com';
 try{
  const m=load('lib/email.ts',{'./email-brand':load('lib/email-brand.ts'),'./external-share-permissions':load('lib/external-share-permissions.ts')});
  const enquiry='/asset-share/'+'a'.repeat(43);
  const callback='https://aim4price.com/reset-password?returnTo='+encodeURIComponent(enquiry);
  const nested='https://aim4price.com/api/auth/reset-password/token?callbackURL='+encodeURIComponent(callback);
  const url=new URL(m.buildAim4priceResetPasswordUrl('secret',nested));
  assert.equal(url.pathname,'/reset-password');assert.equal(url.searchParams.get('token'),'secret');assert.equal(url.searchParams.get('returnTo'),enquiry);
  for(const bad of ['https://evil.test','//evil.test','/admin','/asset-share/short','/\\evil.test']){
   const result=new URL(m.buildAim4priceResetPasswordUrl('secret','https://aim4price.com/reset-password?returnTo='+encodeURIComponent(bad)));
   assert.equal(result.searchParams.get('returnTo'),null);
  }
 }finally{if(old===undefined)delete process.env.NEXT_PUBLIC_SITE_URL;else process.env.NEXT_PUBLIC_SITE_URL=old;}
});

test('account and sharing entry screens use native sizing, while Desktop retains its canvas',()=>{
 const {isNativeWorkspace}=load('lib/website-canvas.ts');
 for(const route of ['/business','/business/join','/auth','/reset-password','/asset-share/abc'])assert.equal(isNativeWorkspace(route),true);
 for(const route of ['/asset-register','/leads','/pricing','/business-network/example'])assert.equal(isNativeWorkspace(route),false);
});
