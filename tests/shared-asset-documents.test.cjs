const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{randomUUID}=require('node:crypto');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(!(name in mocks))throw Error(name);return mocks[name]},exports);return exports;}
test('shared document uploads enforce access, exclude invoices, keep owner scope and count successful retries once',async()=>{
 let allowed=true,revoked=false,uploads=0,created=0,events=[],usage=[],cleanup=[],stored;
 class Denied extends Error{constructor(message,status=403){super(message);this.status=status;}}
 const taxonomy=load('lib/account-document-taxonomy.ts',{});
 const client={query:async(sql,args)=>({rows:sql.includes('FROM shared_asset_activity')?events.filter(e=>e.id===args[0]).map(e=>({owner_id:e.ownerId,asset_id:e.assetId,actor_id:e.actorId,action:e.action,after_data:e.after})):[]})};
 const api=load('lib/shared-asset-documents.ts',{
  'next/server':{NextResponse:class{}},
  './shared-asset-contributions':{contributionScope:async(target,permission)=>{assert.equal(permission,'updateDetails');if(!allowed)throw new Denied('not allowed');return{ownerId:'owner',assetId:'asset',user:{id:'recipient',name:'Business',email:'r@test'},token:'link',lock:async()=>{if(revoked)throw new Denied('revoked');}};}},
  './account-documents':{
   createAccountDocument:async(owner,input,hooks)=>{assert.equal(owner,'owner');assert.deepEqual(input.assetIds,['asset']);const prior=await hooks.before(client);if(prior)return stored;created++;stored={id:'doc',title:input.title,assetLinks:[{id:'asset'},{id:'other-private-asset'}]};await hooks.after(client,'doc');return stored;},
   listAccountDocuments:async(owner,options)=>{assert.equal(owner,'owner');assert.equal(options.assetId,'asset');return[{id:'doc',documentType:'insurance-policy',assetLinks:[{id:'asset'},{id:'other-private-asset'}]},{id:'invoice',documentType:'invoice-proof-of-purchase',assetLinks:[{id:'asset'}]}];},
   getAccountDocumentUploadReference:async()=>{throw Error('Unexpected download');},
   removeUnusedAccountDocumentUpload:async(owner,id)=>{assert.equal(owner,'owner');cleanup.push(id);}
  },
  './asset-register-uploads':{MAX_DOCUMENT_VAULT_UPLOAD_BYTES:25*1024*1024,isAllowedAssetRegisterDocument:()=>true,createAssetRegisterUpload:async({userId})=>{assert.equal(userId,'owner');return{id:'upload-'+ ++uploads,fileName:'policy.pdf',contentType:'application/pdf',byteSize:10};}},
  './account-document-taxonomy':taxonomy,
  './sharing-foundation':{ensureSharingFoundation:async()=>{},recordSharingUsage:async event=>usage.push(event)},
  './shared-asset-activity':{ensureSharedAssetActivity:async()=>{},recordSharedAssetActivity:async(_,event)=>events.push(event)},
  './business-network-api':{businessJson:(data,status=200)=>({data,status}),businessError:error=>({status:400,error:error.message}),requireBusinessOrigin:()=>{}},
  './external-lead-access':{ExternalLeadAccessError:Denied},'./business-network':{limitBusinessAction:async()=>{}}
 });
 const key=randomUUID();
 const post=(type='insurance-policy',id=key)=>api.sharedAssetDocuments({method:'POST',headers:new Headers(),formData:async()=>{const f=new FormData();f.set('file',new File(['policy'],'policy.pdf',{type:'application/pdf'}));f.set('requestId',id);f.set('documentType',type);f.set('title','Insurance policy');f.set('assetIds','["other-private-asset"]');return f;}},{token:'link',assetId:'asset'});
 allowed=false;assert.equal((await post()).status,403);assert.equal(uploads,0);allowed=true;
 assert.equal((await post('invoice-proof-of-purchase')).status,400);assert.equal(uploads,0);
 const first=await post();assert.equal(first.status,200);assert.deepEqual(first.data.document.assetLinks,[{id:'asset'}]);
 assert.equal((await post()).status,200);assert.equal(created,1);assert.equal(events.length,1);assert.equal(usage.length,2);assert.equal(cleanup.length,1);
 revoked=true;assert.equal((await post('insurance-policy',randomUUID())).status,403);assert.equal(created,1);assert.equal(usage.length,2);assert.equal(cleanup.length,2);
 const read=await api.sharedAssetDocuments({method:'GET',nextUrl:new URL('https://test/documents')},{token:'link',assetId:'asset'});
 assert.deepEqual(read.data.documents,[{id:'doc',documentType:'insurance-policy',assetLinks:[{id:'asset'}]}]);
 const hidden=await api.sharedAssetDocuments({method:'GET',nextUrl:new URL('https://test/documents?id=invoice')},{token:'link',assetId:'asset'});assert.equal(hidden.status,404);
});
