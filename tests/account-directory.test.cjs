const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{PGlite}=require('@electric-sql/pglite');
function load(path,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),exports);return exports;}
async function setup(){const pg=new PGlite();await pg.exec(`CREATE TABLE account_profiles(user_id text PRIMARY KEY);INSERT INTO account_profiles VALUES('b'),('d'),('other');`);const schema=fs.readFileSync('lib/business-network.ts','utf8').match(/export const BUSINESS_SCHEMA = `([\s\S]*?)`;/)[1];await pg.exec(schema);await pg.exec(fs.readFileSync("database/migrations/134-account-directory-listings.sql","utf8"));const db={query:(...a)=>pg.query(...a),connect:async()=>({query:(...a)=>pg.query(...a),release(){}})};const shared=load('lib/business-network-shared.ts');let role='business',active=true;const api=load('lib/account-directory.ts',{'./db':{getDb:()=>db},'./account-profile':{getAccountProfile:async()=>({accountType:role,accountStatus:active?'active':'suspended'})},'./business-network':{ensureBusinessNetwork:async()=>{}},'./business-network-shared':shared,'./showroom-logo-validation':load('lib/showroom-logo-validation.ts')});const admin=load('lib/admin-business-network.ts',{'./db':{getDb:()=>db},'./business-network':{ensureBusinessNetwork:async()=>{}},'./business-network-shared':shared});return {pg,api,admin,role:v=>role=v,active:v=>active=v};}
const user={id:'b',email:'business@example.com',emailVerified:true},input={name:'Workshop',phone:'0123456789',town:'George',serviceArea:'Garden Route',services:['Repairs'],accepted:true};
test('listing lifecycle: explicit consent, review, publish, edits re-reviewed, hide, ownership isolation',async()=>{const x=await setup();try{
 await assert.rejects(x.api.saveAccountListing(user,{...input,accepted:false}),/Confirm/);
 let row=await x.api.saveAccountListing(user,{...input,status:'active',userId:'other',logoData:''});assert.equal(row.status,'invited');assert.equal(row.details.latitude,null);assert.equal(row.email,user.email);assert.equal(await x.api.readAccountListing('other'),null);
 await x.admin.saveAdminBusiness('admin',{id:row.id,action:'publish'});assert.equal((await x.api.readAccountListing('b')).status,'active');
 row=await x.api.saveAccountListing(user,{...input,name:'Workshop Two'});assert.equal(row.status,'invited');assert.equal(row.name,'Workshop Two');
 await x.api.saveAccountListing(user,{action:'hide'});assert.equal((await x.api.readAccountListing('b')).status,'paused');
 await assert.rejects(x.api.saveAccountListing({...user,id:'other'},input),/already has/);
 assert.equal((await x.pg.query('SELECT count(*) FROM business_network')).rows[0].count,1);
 }finally{await x.pg.close();}});
test('verified active business/dealer accounts only; malformed logos cannot be persisted',async()=>{const x=await setup();try{
 await assert.rejects(x.api.saveAccountListing({...user,emailVerified:false},input),/verified email/);x.role('owner');await assert.rejects(x.api.saveAccountListing(user,input),/Business or Dealer/);x.role('dealer');x.active(false);await assert.rejects(x.api.saveAccountListing(user,input),/active/);x.active(true);
 await assert.rejects(x.api.saveAccountListing(user,{...input,logoData:'data:image/svg+xml;base64,AAAA'}),/valid PNG/);
 await assert.rejects(x.api.saveAccountListing(user,{...input,logoData:'data:image/png;base64,AAAA'}),/valid PNG/);
 assert.equal(await x.api.readAccountListing(user.id),null);
 const row=await x.api.saveAccountListing(user,input);assert.equal(row.status,'invited');
 }finally{await x.pg.close();}});

test('logo upload survives review and edits, and can be removed',async()=>{const x=await setup();try{
 const logo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGMUiXL7z8DAwMDEAAUAGTYBtxz8IUMAAAAASUVORK5CYII=';
 let row=await x.api.saveAccountListing(user,{...input,logoData:logo});assert.equal(row.logo_data,logo);
 await x.admin.saveAdminBusiness('admin',{id:row.id,action:'publish'});assert.equal((await x.api.readAccountListing(user.id)).logo_data,logo);
 row=await x.api.saveAccountListing(user,input);assert.equal(row.logo_data,logo);
 row=await x.api.saveAccountListing(user,{...input,logoData:''});assert.equal(row.logo_data,'');
 }finally{await x.pg.close();}});
