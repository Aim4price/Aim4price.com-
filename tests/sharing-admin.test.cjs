const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>mocks[name]||require(name),exports);return exports;}
async function setup(){const pg=new PGlite();await pg.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text,name text);CREATE TABLE "session"(id text PRIMARY KEY,"userId" text,"createdAt" timestamptz DEFAULT now(),"expiresAt" timestamptz DEFAULT now()+interval '1 day');CREATE TABLE account_profiles(user_id text PRIMARY KEY,business_name text,account_type text,account_status text);INSERT INTO "user" VALUES('free','free@example.test','Free'),('other','other@example.test','Other'),('admin','admin@example.test','Admin');INSERT INTO account_profiles VALUES('free','Workshop','business','active'),('other','Other','owner','active');`);const query=(sql,args)=>args?pg.query(sql,args):pg.exec(sql).then(r=>r.at(-1));const db={query,connect:async()=>({query,release(){}})};const foundation=load('lib/sharing-foundation.ts',{'./db':{getDb:()=>db}});await foundation.registerFreeSharingAccount('free');const admin=load('lib/sharing-admin.ts',{'./db':{getDb:()=>db},'./sharing-foundation':foundation,'./account-constants':{isAim4priceAdminEmail:email=>email==='admin@example.test'}});return{pg,foundation,admin};}
test('sign out revokes every website session, rejects cached sessions, preserves usage and allows fresh login',async()=>{const x=await setup();try{
 await x.pg.exec(`INSERT INTO "session"(id,"userId") VALUES('one','free'),('two','free'),('untouched','other')`);
 const stale={user:{id:'free'},session:{id:'one',createdAt:new Date()}};assert.equal(await x.foundation.sharingSessionIsActive(stale),true);
 await x.foundation.recordSharingUsage({accountId:'free',actorId:'free',metric:'upload',eventKey:'file',bytes:512});
 assert.equal(await x.admin.signOutSharingAccount('admin','free'),2);
 assert.equal(await x.foundation.sharingSessionIsActive(stale),false);
 assert.equal((await x.pg.query('SELECT id FROM "session"')).rows[0].id,'untouched');
 assert.equal((await x.foundation.sharingUsageSummary('free')).upload.bytes,512);
 assert.equal((await x.pg.query("SELECT action FROM sharing_admin_events")).rows[0].action,'sessions_revoked');
 await x.pg.exec(`INSERT INTO "session"(id,"userId") VALUES('fresh','free')`);
 assert.equal(await x.foundation.sharingSessionIsActive({...stale,session:{id:'fresh',createdAt:new Date()}}),true);
 await assert.rejects(x.admin.signOutSharingAccount('admin','admin'));
 await assert.rejects(x.admin.signOutSharingAccount('other','admin'));
 await assert.rejects(x.admin.signOutSharingAccount('admin','missing'));
}finally{await x.pg.close();}});
test('usage summaries separate month and lifetime totals without session multiplication',async()=>{const x=await setup();try{
 await x.pg.exec(`INSERT INTO "session"(id,"userId") VALUES('one','free'),('two','free')`);
 for(const [metric,eventKey,bytes] of [['upload','old',1024],['upload','new',2048],['email_attempt','mail',0],['email_accepted','mail',0],['email_failed','failed',0],['contribution','change',0]])await x.foundation.recordSharingUsage({accountId:'free',actorId:'free',metric,eventKey,bytes});
 await x.pg.exec("UPDATE sharing_usage_events SET created_at=(date_trunc('month',now() AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg')-interval '1 second' WHERE event_key='old'");
 const month=(await x.admin.sharingAdminAccounts('month')).find(a=>a.user_id==='free');
 assert.equal(month.uploads,1);assert.equal(month.bytes,'2048');assert.equal(month.emails,1);assert.equal(month.failed,1);assert.equal(month.contributions,1);assert.equal(month.sessions,2);
 const all=(await x.admin.sharingAdminAccounts('all')).find(a=>a.user_id==='free');assert.equal(all.uploads,2);assert.equal(all.bytes,'3072');
 await x.admin.signOutSharingAccount('admin','free');assert.equal((await x.admin.sharingAdminAccounts('all')).find(a=>a.user_id==='free').sessions,0);
}finally{await x.pg.close();}});
