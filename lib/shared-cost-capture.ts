import type { NextRequest } from 'next/server';
import { getAssetRegisterItemById } from './asset-register-db';
import { createAssetRegisterUpload, deleteUnreferencedAssetRegisterUploads } from './asset-register-uploads';
import { createCaptureRequest, addCaptureRequestFile, getCaptureRequestDetail, type CaptureEventActor } from './capture-requests';
import { toCaptureRequestStatusView } from './capture-request-view';
import { validatePublicInvoiceFiles } from './public-invoice-drop-security';
import { CAPTURE_LIMIT_CODE, getCaptureAllowance, recordCaptureAssistance } from './capture-allowance';
import { contributionScope, type ContributionTarget } from './shared-asset-contributions';
import { ensureSharingFoundation, recordSharingUsage } from './sharing-foundation';
import { ExternalLeadAccessError } from './external-lead-access';
import { businessJson, businessError, requireBusinessOrigin, businessBody } from './business-network-api';
import { limitBusinessAction } from './business-network';
class ExistingCapture extends Error { constructor(readonly id:string){super('Capture already received');} }
function responseError(error:unknown) {
  if(error instanceof Error && error.message===CAPTURE_LIMIT_CODE)return businessJson({error:'Today’s capture allowance has been used.',code:CAPTURE_LIMIT_CODE},429);
  return error instanceof ExternalLeadAccessError?businessJson({error:error.message},error.status):businessError(error);
}
export async function sharedCaptureAllowance(request:NextRequest,target:ContributionTarget) {
  try {
    if(request.method==='POST')requireBusinessOrigin(request);
    const scope=await contributionScope(target,'addCosts');
    const allowance=await getCaptureAllowance(scope.ownerId,'invoice');
    if(request.method==='POST') {
      const body=await businessBody(request);
      if(!['shown','request'].includes(String(body.action)))throw new Error('Choose a valid assistance action.');
      if(!allowance.blocked)return businessJson({error:'The daily allowance is available.'},409);
      await recordCaptureAssistance(scope.ownerId,scope.user.id,'invoice',body.action==='request',String(body.note||'').slice(0,1000));
    }
    return businessJson({ok:true,...allowance});
  }catch(error){return responseError(error);}
}
export async function submitSharedCostCapture(request:NextRequest,target:ContributionTarget) {
  let upload:Awaited<ReturnType<typeof createAssetRegisterUpload>>|undefined;
  let ownerId='';
  try {
    requireBusinessOrigin(request);
    const scope=await contributionScope(target,'addCosts');ownerId=scope.ownerId;
    await limitBusinessAction(`shared-capture:${scope.user.id}`,20);
    if(Number(request.headers.get('content-length')||0)>13*1024*1024)throw new Error('This invoice upload is too large.');
    const form=await request.formData(), file=form.get('file'),requestId=String(form.get('requestId')||'');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))throw new Error('This request needs a valid save identifier.');
    if(!file||typeof file==='string')throw new Error('Choose an invoice photo or PDF.');
    const [validated]=await validatePublicInvoiceFiles([file]);
    const asset=await getAssetRegisterItemById(scope.ownerId,scope.assetId);
    if(!asset)throw new ExternalLeadAccessError('This asset is no longer available.',404);
    await ensureSharingFoundation();
    const actor:CaptureEventActor={actorType:scope.user.id===scope.ownerId?'owner':'dealer',userId:scope.user.id,displayName:scope.user.name||scope.user.email};
    try {
      const capture=await createCaptureRequest({requestType:'invoice',submissionChannel:actor.actorType==='owner'?'owner_upload':'dealer_upload',ownerUserId:scope.ownerId,assetId:scope.assetId,
        sender:{type:actor.actorType==='owner'?'owner':'dealer',name:scope.user.name||scope.user.email,email:scope.user.email},assetReference:asset.serialNumber,requesterNote:String(form.get('note')||'').slice(0,1000),candidatePayload:{targetLabel:asset.title,sharedSaveId:requestId}},actor,{
        before:async client=>{
          await scope.lock(client);
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${scope.user.id}:${requestId}`]);
          const existing=await client.query(`SELECT id FROM document_capture_requests WHERE submitted_by_user_id=$1 AND owner_user_id=$2 AND asset_register_item_id=$3::uuid AND candidate_payload->>'sharedSaveId'=$4`,[scope.user.id,scope.ownerId,scope.assetId,requestId]);
          if(existing.rows[0])throw new ExistingCapture(existing.rows[0].id);
        },
        after:async(client,capture)=>{
          upload=await createAssetRegisterUpload({userId:scope.ownerId,file,category:'shared-assisted-invoice-capture'});
          await addCaptureRequestFile(capture.id,{storageKey:`v1/capture-quarantine/${validated.sha256.slice(0,2)}/shared-upload-${upload.id}`,originalFileName:validated.fileName,contentType:validated.contentType,byteSize:validated.byteSize,sha256:validated.sha256,promotedUploadId:upload.id},actor,client);
          const base={accountId:scope.user.id,actorId:scope.user.id,assetId:scope.assetId,token:scope.token};
          await recordSharingUsage({...base,metric:'upload',eventKey:`capture-file:${upload.id}`,bytes:upload.byteSize},client);
          await recordSharingUsage({...base,metric:'contribution',eventKey:`capture:${capture.id}`},client);
        },
      });
      return businessJson({ok:true,request:toCaptureRequestStatusView(capture)},202);
    }catch(error){
      if(error instanceof ExistingCapture){const existing=await getCaptureRequestDetail(error.id);if(existing)return businessJson({ok:true,request:toCaptureRequestStatusView(existing)},202);}
      throw error;
    }
  }catch(error){
    if(upload)await deleteUnreferencedAssetRegisterUploads({userId:ownerId,uploadIds:[upload.id]}).catch(()=>{});
    return responseError(error);
  }
}
