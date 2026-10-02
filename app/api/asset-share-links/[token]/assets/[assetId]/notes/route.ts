import type {NextRequest} from 'next/server';
import {businessJson,businessError,requireBusinessOrigin} from '../../../../../../../lib/business-network-api';
import {limitBusinessAction} from '../../../../../../../lib/business-network';
import {requireLiveSharedAsset} from '../../../../../../../lib/live-shared-asset-access';
import {ExternalLeadAccessError} from '../../../../../../../lib/external-lead-access';
import {readPublicInvoiceFormData} from '../../../../../../../lib/public-invoice-drop-security';
import {sendSharedAssetNote} from '../../../../../../../lib/shared-asset-notes';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest,{params}:{params:{token:string;assetId:string}}){
 try{
  requireBusinessOrigin(request);
  const {user}=await requireLiveSharedAsset(params.token,params.assetId,'reply',true);
  await limitBusinessAction(`shared-note:${user.id}`,30);
  const note=await sendSharedAssetNote(params.token,params.assetId,await readPublicInvoiceFormData(request));
  return businessJson({ok:true,note});
 }catch(e){return e instanceof ExternalLeadAccessError?businessJson({error:e.message},e.status):businessError(e);}
}
