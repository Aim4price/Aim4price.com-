const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const {randomUUID}=require('node:crypto');
function load(file,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),exports);return exports;}
const A='10000000-0000-4000-8000-000000000001',L='20000000-0000-4000-8000-000000000001';
async function setup(){
 const pg=new PGlite();
 await pg.exec(`CREATE TABLE "user"(id text PRIMARY KEY);INSERT INTO "user" VALUES('owner'),('recipient');CREATE TABLE account_profiles(user_id text,business_name text,display_name text);CREATE TABLE valuation_runs(id uuid);CREATE TABLE equipment_models(id uuid);CREATE TABLE equipment_families(id uuid,family_label text);CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text,photos jsonb);INSERT INTO asset_register_items VALUES('${A}','owner','["existing.jpg"]');CREATE TABLE asset_leads(id uuid,owner_user_id text,partner_user_id text,asset_register_item_id uuid,asset_snapshot_json jsonb,updated_at timestamptz);INSERT INTO asset_leads VALUES('${L}','owner','recipient','${A}','{}',now());CREATE TABLE dealer_maintenance_access(id uuid,owner_user_id text,dealer_user_id text,asset_register_item_id uuid,is_active boolean,can_add_photos boolean,can_add_costs boolean);INSERT INTO dealer_maintenance_access VALUES(gen_random_uuid(),'owner','recipient','${A}',true,true,true);`);
 const query=(sql,args)=>/create extension/i.test(sql)?Promise.resolve({rows:[]}):args?pg.query(sql,args):pg.exec(sql).then(r=>r.at(-1));
 const db={query,connect:async()=>({query,release(){}})};
 const state={active:true,allow:true,user:{id:'recipient',email:'recipient@example.test',name:'Workshop'},uploads:0};
 class AccessError extends Error {constructor(message,status){super(message);this.status=status;}}
 const assetDb={getAssetRegisterItemById:async(userId,id)=>{const row=(await pg.query('SELECT * FROM asset_register_items WHERE id=$1 AND user_id=$2',[id,userId])).rows[0];return row?{id,userId,title:'Tractor',photos:row.photos}:null;},listAssetRegisterItems:async()=>[]};
 // Exercise the real append helper with the minimal known schema implementation.
 const assetSource=fs.readFileSync('lib/asset-register-db.ts','utf8');
 const appendSource=assetSource.slice(assetSource.indexOf('export async function appendSharedAssetPhotos'));
 const appendix={};new Function('getAssetRegisterSchema','buildSelectList','mapAssetRegisterRow','pushPhotoField','pushField','buildUpdateSetClause','exports',ts.transpileModule(appendSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(async()=>({}),()=>'*',r=>({id:r.id,photos:r.photos}),(fields,schema,photos)=>fields.push(photos),()=>{},fields=>({clause:'photos=$3::jsonb',values:[JSON.stringify(fields[0])]}),appendix);
 assetDb.appendSharedAssetPhotos=appendix.appendSharedAssetPhotos;
 const upload={ALLOWED_ASSET_REGISTER_IMAGE_TYPES:new Set(['image/jpeg','image/png','image/webp']),MAX_ASSET_REGISTER_UPLOAD_BYTES:5242880,buildAssetRegisterUploadUrl:id=>`/uploads/${id}`,normalizeUploadId:v=>v,createAssetRegisterUpload:async({file})=>{state.uploads++;return{id:randomUUID(),url:`photo-${state.uploads}.jpg`,fileName:file.name,contentType:file.type,byteSize:file.size};}};
 const foundation=load('lib/sharing-foundation.ts',{'./db':{getDb:()=>db}});
 const invoices=load('lib/my-invoices.ts',{'./db':{getDb:()=>db},'./asset-register-db':assetDb,'./asset-registers':{listAssetRegisters:async()=>[]},'./asset-register-uploads':upload});
 const service=load('lib/shared-asset-contributions.ts',{'./db':{getDb:()=>db},'./auth-session':{getServerSession:async()=>({user:state.user})},'./account-profile':{getAccountProfile:async()=>({accountType:'business',accountStatus:'active'})},'./dealer-maintenance-tracker':{ensureDealerMaintenanceTrackerTables:async()=>{}},'./live-shared-asset-access':{requireLiveSharedAsset:async(token,assetId)=>{if(!state.allow&&state.user.id!=='owner')throw new AccessError('not allowed',403);return{lead:{ownerId:'owner'},assetId,user:state.user};},lockLiveSharedAsset:async()=>{if(!state.active)throw new AccessError('revoked',403);}},'./external-lead-access':{ExternalLeadAccessError:AccessError},'./partner-access':{ensurePartnerAccessTables:async()=>{},getAssetLeadForPartner:async()=>({ownerUserId:'owner',assetRegisterItemId:A})},'./asset-register-db':assetDb,'./asset-register-uploads':upload,'./my-invoices':invoices,'./sharing-foundation':foundation});
 return {pg,service,state,foundation};
}
const photo=()=>new File([Buffer.from('test image')],'asset.jpg',{type:'image/jpeg'});
const cost=()=>({captureRequestId:randomUUID(),invoiceDate:'2026-10-02',subtotalExVat:100,vatAmount:15,notes:'Oil change',maintenanceWorkDone:'Oil change'});
test('photos append, preserve existing photos, record bytes and actor once on retry',async()=>{const x=await setup();try{
 const key=randomUUID();await x.service.addSharedPhotos({token:'link',assetId:A},[photo()],key);await x.service.addSharedPhotos({token:'link',assetId:A},[photo()],key);
 assert.deepEqual((await x.pg.query('SELECT photos FROM asset_register_items')).rows[0].photos,['existing.jpg','photo-1.jpg']);assert.equal(x.state.uploads,1);
 const usage=await x.foundation.sharingUsageSummary('recipient');assert.equal(usage.upload.count,1);assert.equal(usage.contribution.count,1);assert.equal(usage.upload.bytes,10);
 assert.equal((await x.pg.query('SELECT actor_id FROM sharing_usage_events LIMIT 1')).rows[0].actor_id,'recipient');
 x.state.active=false;await assert.rejects(x.service.addSharedPhotos({token:'link',assetId:A},[photo()],randomUUID()),/revoked/);assert.equal(x.state.uploads,1);
}finally{await x.pg.close();}});
test('cost and document use canonical ledger, immediate owner visibility and idempotent usage',async()=>{const x=await setup();try{
 const draft=cost();await x.service.addSharedCost({token:'link',assetId:A},draft,photo());await x.service.addSharedCost({token:'link',assetId:A},draft,photo());
 const rows=(await x.pg.query('SELECT * FROM asset_invoices')).rows;assert.equal(rows.length,1);assert.equal(rows[0].owner_storage_status,'approved');assert.equal(rows[0].total_inc_vat,'115.00');assert.equal(rows[0].created_by_dealer_user_id,'recipient');assert(rows[0].invoice_document_id);
 assert.equal((await x.pg.query('SELECT * FROM asset_invoice_documents')).rows.length,1);assert.equal(x.state.uploads,1);
 const usage=await x.foundation.sharingUsageSummary('recipient');assert.equal(usage.contribution.count,1);assert.equal(usage.upload.count,1);
 x.state.active=false;await assert.rejects(x.service.addSharedCost({token:'link',assetId:A},cost(),photo()),/revoked/);assert.equal(x.state.uploads,1);
}finally{await x.pg.close();}});
test('lead permissions are checked for each action and rechecked on save',async()=>{const x=await setup();try{
 await x.pg.exec('UPDATE dealer_maintenance_access SET can_add_photos=false');await assert.rejects(x.service.addSharedPhotos({leadId:L},[photo()],randomUUID()),/not enabled/);
 await x.service.addSharedCost({leadId:L},cost());
 await x.pg.exec('UPDATE dealer_maintenance_access SET is_active=false');await assert.rejects(x.service.addSharedCost({leadId:L},cost()),/not enabled/);
 assert.equal((await x.pg.query('SELECT * FROM asset_invoices')).rows.length,1);
}finally{await x.pg.close();}});
test('validation and photo capacity reject writes without usage or file storage',async()=>{const x=await setup();try{
 await assert.rejects(x.service.addSharedPhotos({token:'link',assetId:A},[new File(['x'],'bad.html',{type:'text/html'})],randomUUID()));
 await assert.rejects(x.service.addSharedCost({token:'link',assetId:A},{...cost(),subtotalExVat:-1}));
 await x.pg.query('UPDATE asset_register_items SET photos=$1::jsonb',[JSON.stringify(Array.from({length:12},(_,i)=>`saved-${i}`))]);
 await assert.rejects(x.service.addSharedPhotos({token:'link',assetId:A},[photo()],randomUUID()),/12 photos/);assert.equal(x.state.uploads,0);
 assert.equal((await x.pg.query('SELECT * FROM sharing_usage_events')).rows.length,0);
}finally{await x.pg.close();}});
