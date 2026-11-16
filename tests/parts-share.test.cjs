const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),exports);return exports;}
class PartsError extends Error{constructor(message,status=400){super(message);this.status=status;}}
test('managed shares enforce passwords, permissions, directory identity, private fields and revocation using real SQL',async()=>{
 const db=new PGlite();
 await db.exec(load('lib/parts-network-schema.ts').PARTS_NETWORK_SCHEMA);
 await db.exec(`CREATE TABLE "user"(id text,email text); CREATE TABLE account_profiles(user_id text,business_name text,account_status text,account_type text,account_subtype text); CREATE TABLE account_directory_listings(user_id text,business_id text); CREATE TABLE business_network(id text,status text,accepted_at timestamptz);`);
 const client={query:(sql,args)=>sql.includes('CREATE TABLE')?db.exec(sql):db.query(sql,args),release(){}};
 const api=load('lib/parts-share.ts',{'./db':{getDb:()=>({...client,connect:async()=>client})},'./parts-network':{PartsError,ensurePartsNetwork:async()=>{}},'./business-network':{ensureBusinessNetwork:async()=>{},limitBusinessAction:async()=>{}},'./email':{getSiteOrigin:()=> 'https://example.test'}});
 const network='11111111-1111-4111-8111-111111111111';
 const owner={id:'owner',email:'owner@example.test',staff:false,canContribute:true};
 await db.query("INSERT INTO parts_networks(id,name,created_by,list_mode) VALUES($1,'Parts list','owner',true)",[network]);
 await db.query(`INSERT INTO parts_network_members(network_id,dealer_id,role,status,business_name,extra_fields) VALUES($1,'owner','admin','active','Owner business',$2)`,[network,JSON.stringify([{id:'notes',label:'Notes',private:false},{id:'bin',label:'Bin',private:true}])]);
 await db.query(`INSERT INTO parts_network_rows(network_id,dealer_id,part_number,part_key,quantity,price,details) VALUES($1,'owner','001','001',2,0,'{"notes":"Public","bin":"Secret"}')`,[network]);
 const create=(input={})=>api.managePartsShare(owner,network,{action:'create-share',channel:'link',accepted:true,...input});
 await assert.rejects(()=>create({accepted:false}),/Accept/);
 await assert.rejects(()=>create({password:'short'}),/8–128/);
 await assert.rejects(()=>api.managePartsShare({...owner,id:'other'},network,{action:'share-history'}),/Only/);
 await assert.rejects(()=>api.managePartsShare({...owner,staff:true},network,{action:'share-history'}),/Only/);
 const {url}=await create({password:'first-password',allowDownload:true,allowEnquiry:true});const token=url.split('/').at(-1);
 const landing=await api.openPartsShare(token,null,'',{action:'landing'});
 assert.deepEqual(Object.keys(landing).sort(),['name','owner','total']);
 assert.equal(landing.total,1);
 await assert.rejects(()=>api.openPartsShare(token,null,'',{}),e=>e.status===423);
 await assert.rejects(()=>api.openPartsShare(token,null,'',{action:'unlock',password:'wrong'}),/incorrect/);
 const {proof}=await api.openPartsShare(token,null,'',{action:'unlock',password:'first-password'});
 const data=await api.openPartsShare(token,null,proof,{});
 assert.equal(data.total,1);assert.deepEqual(data.rows[0].details,{Notes:'Public'});assert.equal(Number(data.rows[0].price),0);
 await assert.rejects(()=>api.openPartsShare(token,null,proof,{action:'download'}),e=>e.status===401);
 await assert.rejects(()=>api.openPartsShare(token,null,proof,{action:'enquire',message:'Hi'}),e=>e.status===401);
 const viewer={id:'viewer',email:'viewer@example.test'};
 assert.equal((await api.openPartsShare(token,viewer,proof,{action:'download'})).rows.length,1);
 await api.openPartsShare(token,viewer,proof,{action:'enquire',message:'Need two of part 001'});
 assert.equal((await db.query('SELECT * FROM parts_enquiries')).rows[0].recipient_id,'owner');
 const link=(await api.managePartsShare(owner,network,{action:'share-history'})).links[0];
 assert.equal(link.protected,true);assert.ok(!('password_hash' in link));
 await api.managePartsShare(owner,network,{action:'update-share',id:link.id,password:'new-password',allowDownload:false,allowEnquiry:false});
 await assert.rejects(()=>api.openPartsShare(token,viewer,proof,{}),e=>e.status===423);
 await assert.rejects(()=>api.openPartsShare(token,null,'',{action:'unlock',password:'first-password'}),/incorrect/);

 // Exercise the HTTP unlock response and cookie using the real SQL/password implementation.
 const route=load('app/api/parts-share/[token]/route.ts',{
  '../../../../lib/parts-network':{PartsError},'../../../../lib/parts-share':api,
  '../../../../lib/auth-session':{getServerSession:async()=>null},
  '../../../../lib/account-profile':{getAccountProfile:async()=>({})},
  '../../../../lib/trusted-request-origin':{isTrustedRequestOrigin:()=>true}
 });
 const {NextRequest}=require('next/server');
 const post=async(input,cookie='')=>route.POST(new NextRequest('https://example.test/api/parts-share/'+token,{method:'POST',headers:{origin:'https://example.test','Content-Type':'application/json',cookie},body:JSON.stringify(input)}),{params:{token}});
 assert.equal((await post({action:'unlock',password:'first-password'})).status,403);
 const unlocked=await post({action:'unlock',password:'new-password'});
 assert.equal(unlocked.status,200);
 const unlockedData=await unlocked.json();assert.equal(unlockedData.rows[0].part_number,'001');assert.ok(!('proof' in unlockedData));assert.ok(!('ownerId' in unlockedData));
 const cookie=unlocked.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/SameSite=lax/i);
 const cookiePair=cookie.split(';')[0];
 assert.equal((await post({action:'view'},cookiePair)).status,200);
 await db.query('UPDATE parts_share_sessions SET expires_at=now()-interval \'1 second\' WHERE link_id=$1',[link.id]);
 assert.equal((await post({action:'view'},cookiePair)).status,423);
 // Exact mixed-case, Unicode, punctuation and spaces round-trip without mutation.
 for(const value of ['MiXeD-123!','Pässword 🔑',' padded-password ']){
  await api.managePartsShare(owner,network,{action:'update-share',id:link.id,password:value});
  const result=await post({action:'unlock',password:value});assert.equal(result.status,200);
  assert.equal((await result.json()).rows[0].part_number,'001');
 }
 await api.managePartsShare(owner,network,{action:'update-share',id:link.id,password:'new-password'});
 const next=await api.openPartsShare(token,null,'',{action:'unlock',password:'new-password'});
 await assert.rejects(()=>api.openPartsShare(token,viewer,next.proof,{action:'download'}),e=>e.status===403);
 await api.managePartsShare(owner,network,{action:'update-share',id:link.id,password:'',allowDownload:false,allowEnquiry:false});
 assert.equal((await api.openPartsShare(token,null,'',{})).total,1);
 await api.managePartsShare(owner,network,{action:'revoke-share',id:link.id});
 await assert.rejects(()=>api.openPartsShare(token,owner,'',{}),e=>e.status===404);
 await api.managePartsShare(owner,network,{action:'delete-share',id:link.id});
 assert.equal((await api.managePartsShare(owner,network,{action:'share-history'})).links.length,0);
 await db.exec(`INSERT INTO "user" VALUES('buyer','buyer@example.test'); INSERT INTO account_profiles VALUES('buyer','Buyer','active','business','');`);
 await assert.rejects(()=>create({channel:'direct',email:'buyer@example.test'}),/approved/);
 await db.exec(`INSERT INTO account_directory_listings VALUES('buyer','business'); INSERT INTO business_network VALUES('business','invited',now());`);
 await assert.rejects(()=>create({channel:'direct',email:'buyer@example.test'}),/approved/);
 await db.exec(`UPDATE business_network SET status='active',accepted_at=null;`);
 await assert.rejects(()=>create({channel:'direct',email:'buyer@example.test'}),/approved/);
 await db.exec(`UPDATE business_network SET accepted_at=now();`);
 const direct=(await create({channel:'direct',email:'buyer@example.test'})).url.split('/').at(-1);
 await assert.rejects(()=>api.openPartsShare(direct,null,'',{}),e=>e.status===401);
 await assert.rejects(()=>api.openPartsShare(direct,viewer,'',{}),e=>e.status===401);
 assert.equal((await api.openPartsShare(direct,{id:'buyer',email:'buyer@example.test'},'',{})).total,1);
 await db.query('UPDATE parts_networks SET archived=true WHERE id=$1',[network]);
 await assert.rejects(()=>api.openPartsShare(direct,owner,'',{}),e=>e.status===404);
 await db.close();
});
test('public share API only passes verified, non-suspended identities and rejects foreign origins',async()=>{
 let user=null,accountStatus='active',seen;
 const route=load('app/api/parts-share/[token]/route.ts',{
  '../../../../lib/parts-network':{PartsError},
  '../../../../lib/parts-share':{openPartsShare:async(token,viewer,session,input)=>{seen={token,viewer,session,input};return {ok:true};}},
  '../../../../lib/auth-session':{getServerSession:async()=>user?{user}:null},
  '../../../../lib/account-profile':{getAccountProfile:async()=>({accountStatus})},
  '../../../../lib/trusted-request-origin':{isTrustedRequestOrigin:(origin,expected)=>origin===expected}
 });
 const {NextRequest}=require('next/server');
 const token='a'.repeat(64);
 const request=(origin='https://example.test')=>new NextRequest('https://example.test/api/parts-share/'+token,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({action:'view'})});
 assert.equal((await route.POST(request('https://other.test'),{params:{token}})).status,403);
 let response=await route.POST(request(),{params:{token}});assert.equal(response.status,200);assert.equal(seen.viewer,null);assert.equal(response.headers.get('cache-control'),'private, no-store');
 user={id:'viewer',email:'viewer@example.test',emailVerified:false};
 response=await route.POST(request(),{params:{token}});assert.equal(seen.viewer,null);assert.equal((await response.json()).access,'verify-email');
 user.emailVerified=true;await route.POST(request(),{params:{token}});assert.equal(seen.viewer.id,'viewer');
 accountStatus='suspended';await route.POST(request(),{params:{token}});assert.equal(seen.viewer,null);
});
