const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');const {randomUUID}=require('node:crypto');
function load(file,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),exports);return exports;}
test('shared replies preserve live access, canonical owner notes and retry-safe usage',async()=>{
 const pg=new PGlite(),assetId=randomUUID(),token='a'.repeat(43);
 try{
 await pg.exec(`CREATE TABLE "user"(id text PRIMARY KEY);INSERT INTO "user" VALUES('owner'),('recipient');CREATE TABLE asset_register_items(id uuid,user_id text);CREATE TABLE asset_share_links(token text,user_id text,revoked_at timestamptz,umbrella_id uuid,asset_ids uuid[],lead_details jsonb);CREATE TABLE asset_groups(id uuid,user_id text);CREATE TABLE asset_group_members(group_id uuid,asset_id uuid);CREATE TABLE asset_partner_notes(id uuid,owner_user_id text,partner_user_id text,asset_register_item_id uuid,note_text text,status text,attachment_file_name text,attachment_content_type text,attachment_byte_size int,attachment_data bytea);`);
 await pg.query('INSERT INTO asset_register_items VALUES($1,$2)',[assetId,'owner']);
 await pg.query('INSERT INTO asset_share_links VALUES($1,$2,null,null,$3,$4)',[token,'owner',[assetId],{allowReply:true,accessMode:'signed-in',permissions:{}}]);
 const query=(s,a)=>/create extension/i.test(s)?Promise.resolve({rows:[]}):a?pg.query(s,a):pg.exec(s).then(r=>r.at(-1));const db={getDb:()=>({query,connect:async()=>({query,release(){}})})};
 const state={access:'active',allowReply:true};class AccessError extends Error{constructor(m,status){super(m);this.status=status;}}
 const live=load('lib/live-shared-asset-access.ts',{'./external-lead-access':{externalLeadAccess:async()=>({access:state.access,user:{id:'recipient',email:'test@example.test'}}),leadAllows:()=>false,ExternalLeadAccessError:AccessError},'./guest-leads':{readLeadPage:async()=>({ownerId:'owner',share:{assets:[{assetId}]},details:{allowReply:state.allowReply}})}});
 const foundation=load('lib/sharing-foundation.ts',{'./db':db});
 const service=load('lib/shared-asset-notes.ts',{'./db':db,'./live-shared-asset-access':live,'./partner-access':{ensurePartnerAccessTables:async()=>{}},'./sharing-foundation':foundation,'./public-invoice-drop-security':{validatePublicInvoiceFiles:async([f])=>[{fileName:f.name,contentType:f.type,data:Buffer.from(await f.arrayBuffer())}]}});
 function form(quote=false,id=randomUUID()){const f=new FormData();f.set('note','Please see quote');f.set('requestId',id);if(quote)f.set('attachment',new File(['%PDF-test'],'quote.pdf',{type:'application/pdf'}));return f;}
 const id=randomUUID();await service.sendSharedAssetNote(token,assetId,form(true,id));await service.sendSharedAssetNote(token,assetId,form(true,id));
 const rows=(await pg.query('SELECT * FROM asset_partner_notes')).rows;assert.equal(rows.length,1);assert.equal(rows[0].owner_user_id,'owner');assert.equal(rows[0].partner_user_id,'recipient');assert.equal(rows[0].asset_register_item_id,assetId);assert.equal(rows[0].attachment_file_name,'quote.pdf');
 assert.equal((await foundation.sharingUsageSummary('recipient')).contribution.count,1);assert.equal((await foundation.sharingUsageSummary('recipient')).upload.count,1);
 state.access='sign-in';await assert.rejects(service.sendSharedAssetNote(token,assetId,form()),/authorised/);state.access='active';
 state.allowReply=false;await assert.rejects(service.sendSharedAssetNote(token,assetId,form()),/not shared/);state.allowReply=true;
 await assert.rejects(service.sendSharedAssetNote(token,randomUUID(),form()),/no longer available/);
 await pg.exec('UPDATE asset_share_links SET revoked_at=now()');await assert.rejects(service.sendSharedAssetNote(token,assetId,form()),/no longer available/);
 assert.equal((await pg.query('SELECT * FROM asset_partner_notes')).rows.length,1);
 }finally{await pg.close();}
});
