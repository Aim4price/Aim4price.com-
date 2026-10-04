import { NextRequest, NextResponse } from 'next/server';
import { contributionScope, type ContributionTarget } from './shared-asset-contributions';
import { createAccountDocument, listAccountDocuments, getAccountDocumentUploadReference, removeUnusedAccountDocumentUpload } from './account-documents';
import { createAssetRegisterUpload, isAllowedAssetRegisterDocument, MAX_DOCUMENT_VAULT_UPLOAD_BYTES, resolveAssetRegisterUploadBytes } from './asset-register-uploads';
import { getAccountDocumentTypeCategory, isAccountDocumentType } from './account-document-taxonomy';
import { ensureSharingFoundation, recordSharingUsage } from './sharing-foundation';
import { ensureSharedAssetActivity, recordSharedAssetActivity } from './shared-asset-activity';
import { businessJson, businessError, requireBusinessOrigin } from './business-network-api';
import { ExternalLeadAccessError } from './external-lead-access';
import { limitBusinessAction } from './business-network';

// Documents belong to the live owner's asset. Invoice submission and costs remain separate.
export async function sharedAssetDocuments(request:NextRequest,target:ContributionTarget) {
 let uploadId='',uploadOwner='';
 try {
  if(request.method!=='GET')requireBusinessOrigin(request);
  const scope=await contributionScope(target,'updateDetails');
  if(request.method==='GET') {
   const documents=(await listAccountDocuments(scope.ownerId,{assetId:scope.assetId})).filter(d=>d.documentType!=='invoice-proof-of-purchase');
   const id=request.nextUrl.searchParams.get('id');
   if(!id)return businessJson({documents:documents.map(d=>({...d,assetLinks:d.assetLinks.filter(a=>a.id===scope.assetId)}))});
   if(!documents.some(d=>d.id===id))throw new ExternalLeadAccessError('Document unavailable.',404);
   const reference=await getAccountDocumentUploadReference(scope.ownerId,id);
   if(!reference)throw new ExternalLeadAccessError('Document unavailable.',404);
   const resolved=await resolveAssetRegisterUploadBytes(reference.uploadId);
   if(resolved.status!=='ready')throw new ExternalLeadAccessError('Document unavailable.',503);
   return new NextResponse(resolved.upload.data,{headers:{'Content-Type':resolved.upload.mimeType||'application/octet-stream','Content-Disposition':`attachment; filename="${encodeURIComponent(reference.fileName.replace(/[\r\n"\\/]/g,'-'))}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  await limitBusinessAction(`shared-documents:${scope.user.id}`,30);
  if(Number(request.headers.get('content-length')||0)>MAX_DOCUMENT_VAULT_UPLOAD_BYTES+1024*1024)throw new Error('Document is too large.');
  const form=await request.formData(),file=form.get('file'),type=form.get('documentType'),key=String(form.get('requestId')||'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))throw new Error('Reopen the upload and try again.');
  if(!isAccountDocumentType(type)||type==='invoice-proof-of-purchase')throw new Error('Asset documents only — no invoices. Use Add cost for invoices.');
  if(!file||typeof file==='string'||!file.size||file.size>MAX_DOCUMENT_VAULT_UPLOAD_BYTES||!isAllowedAssetRegisterDocument(file))throw new Error('Choose a supported document up to 25 MB.');
  if(type==='other'&&!String(form.get('notes')||'').trim())throw new Error('Describe this document in Notes.');
  await ensureSharingFoundation();await ensureSharedAssetActivity();
  const upload=await createAssetRegisterUpload({userId:scope.ownerId,file,category:'account-document'});uploadId=upload.id;uploadOwner=scope.ownerId;
  let reused=false;
  const document=await createAccountDocument(scope.ownerId,{title:form.get('title'),category:getAccountDocumentTypeCategory(type),documentType:type,notes:form.get('notes'),expiryDate:form.get('expiryDate'),assetIds:[scope.assetId],uploadId:upload.id,fileName:upload.fileName,contentType:upload.contentType,byteSize:upload.byteSize},{
   before:async client=>{
    await scope.lock(client);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[key]);
    const prior=(await client.query('SELECT owner_id,asset_id,actor_id,action,after_data FROM shared_asset_activity WHERE id=$1::uuid',[key])).rows[0];
    if(prior) {
     if(prior.owner_id!==scope.ownerId||prior.asset_id!==scope.assetId||prior.actor_id!==scope.user.id||prior.action!=='Document uploaded')throw new Error('Invalid upload identifier.');
     reused=true;return String(prior.after_data.documentId);
    }
   },
   after:async(client,documentId)=>{
    await recordSharedAssetActivity(client,{id:key,ownerId:scope.ownerId,assetId:scope.assetId,actorId:scope.user.id,actorName:scope.user.name||scope.user.email,action:'Document uploaded',after:{documentId,title:String(form.get('title')||file.name),documentType:type}});
    const base={accountId:scope.user.id,actorId:scope.user.id,assetId:scope.assetId,token:scope.token};
    await recordSharingUsage({...base,metric:'upload',eventKey:upload.id,bytes:upload.byteSize},client);
    await recordSharingUsage({...base,metric:'contribution',eventKey:`document:${key}`},client);
   }
  });
  if(reused)await removeUnusedAccountDocumentUpload(scope.ownerId,uploadId);
  uploadId='';
  return businessJson({ok:true,document:{...document,assetLinks:document.assetLinks.filter(a=>a.id===scope.assetId)}});
 }catch(error){
  if(uploadId)await removeUnusedAccountDocumentUpload(uploadOwner,uploadId).catch(()=>{});
  return error instanceof ExternalLeadAccessError?businessJson({error:error.message},error.status):businessError(error);
 }
}
