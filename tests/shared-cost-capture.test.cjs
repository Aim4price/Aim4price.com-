const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const {randomUUID}=require('node:crypto');
function load(file,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),exports);return exports;}
const assetId='10000000-0000-4000-8000-000000000001';
test('shared capture is scoped, retry safe and atomic with file, allowance and usage',async()=>{
 const pg=new PGlite();
 try{
 await pg.exec(`CREATE TABLE "user"(id text PRIMARY KEY);INSERT INTO "user" VALUES('owner'),('recipient');CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text);INSERT INTO asset_register_items VALUES('${assetId}','owner');CREATE TABLE fuel_storage_units(id uuid PRIMARY KEY,user_id text);CREATE TABLE asset_invoices(id uuid PRIMARY KEY);CREATE TABLE asset_invoice_documents(id uuid PRIMARY KEY);CREATE TABLE fuel_slips(id uuid PRIMARY KEY);`);
 await pg.exec(fs.readFileSync('database/migrations/83-assisted-document-capture.sql','utf8').replace('create extension if not exists pgcrypto;',''));
 const query=(sql,args)=>/create extension/i.test(sql)?Promise.resolve({rows:[]}):args?pg.query(sql,args):pg.exec(sql).then(r=>r.at(-1));
 const db={getDb:()=>({query,connect:async()=>({query,release(){}})})};
 const allowance=load('lib/capture-allowance.ts',{'./db':db});
 const capture=load('lib/capture-requests.ts',{'./db':db,'./capture-allowance':allowance,'./asset-usage':{}});
 const foundation=load('lib/sharing-foundation.ts',{'./db':db});
 const state={active:true,fail:false,uploads:0,cleanups:0,user:'recipient',failUsage:false};
 class AccessError extends Error{constructor(message,status){super(message);this.status=status;}}
 const service=load('lib/shared-cost-capture.ts',{
 './asset-register-db':{getAssetRegisterItemById:async()=>({id:assetId,title:'Tractor',serialNumber:'ABC'})},
 './asset-register-uploads':{createAssetRegisterUpload:async({file})=>{if(state.fail)throw Error('storage unavailable');state.uploads++;return{id:randomUUID(),byteSize:file.size};},deleteUnreferencedAssetRegisterUploads:async()=>{state.cleanups++;}},
 './capture-requests':capture,'./capture-request-view':load('lib/capture-request-view.ts'),
 './public-invoice-drop-security':{validatePublicInvoiceFiles:async([f])=>[{sha256:'a'.repeat(64),fileName:f.name,contentType:f.type,byteSize:f.size}]},
 './capture-allowance':allowance,
 './shared-asset-contributions':{contributionScope:async()=>({ownerId:'owner',assetId,token:'link',user:{id:state.user,name:'Business',email:'test@example.test'},lock:async()=>{if(!state.active)throw new AccessError('revoked',403);}})},
 './sharing-foundation':{...foundation,recordSharingUsage:async(...args)=>{if(state.failUsage)throw Error('usage unavailable');return foundation.recordSharingUsage(...args);}},
 './external-lead-access':{ExternalLeadAccessError:AccessError},
 './business-network-api':{businessJson:(data,status=200)=>({data,status}),businessError:e=>({status:400,error:e.message}),requireBusinessOrigin:()=>{}},
 './business-network':{limitBusinessAction:async()=>{}},
 });
 function request(id=randomUUID()){const f=new FormData();f.set('requestId',id);f.set('file',new File(['%PDF-test'],'invoice.pdf',{type:'application/pdf'}));return new Request('https://example.test/capture',{method:'POST',body:f});}
 const target={token:'link',assetId},id=randomUUID();
 const first=await service.submitSharedCostCapture(request(id),target);assert.equal(first.status,202,JSON.stringify(first));
 const retry=await service.submitSharedCostCapture(request(id),target);assert.equal(retry.status,202,JSON.stringify(retry));assert.equal(retry.data.request.id,first.data.request.id);assert.equal(state.uploads,1);
 async function counts(){return Promise.all(['document_capture_requests','document_capture_files','capture_daily_usage','sharing_usage_events'].map(async t=>(await pg.query(`select count(*)::int as n from ${t}`)).rows[0].n));}
 assert.deepEqual(await counts(),[1,1,1,2]);
 state.active=false;assert.equal((await service.submitSharedCostCapture(request(),target)).status,403);state.active=true;
 state.fail=true;assert.equal((await service.submitSharedCostCapture(request(),target)).status,400);state.fail=false;
 assert.deepEqual(await counts(),[1,1,1,2]);
 state.failUsage=true;assert.equal((await service.submitSharedCostCapture(request(),target)).status,400);state.failUsage=false;assert.equal(state.cleanups,1);assert.deepEqual(await counts(),[1,1,1,2]);
 state.user='owner';const own=await service.submitSharedCostCapture(request(),target);assert.equal(own.status,202,JSON.stringify(own));
 assert.equal((await pg.query('select submission_channel from document_capture_requests where id=$1',[own.data.request.id])).rows[0].submission_channel,'owner_upload');
 }finally{await pg.close();}
});
