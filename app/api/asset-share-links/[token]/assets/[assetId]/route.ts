import { limitBusinessAction } from '../../../../../../lib/business-network';
import { NextRequest } from 'next/server';
import { businessJson, businessError, businessBody, requireBusinessOrigin } from '../../../../../../lib/business-network-api';
import { getLiveSharedTrackedAsset, createDealerMaintenanceSchedule, type DealerMaintenanceScheduleProposalInput } from '../../../../../../lib/dealer-maintenance-tracker';
import { requireLiveSharedAsset } from '../../../../../../lib/live-shared-asset-access';
import { readLeadPage } from '../../../../../../lib/guest-leads';
import type { ExternalSharePermission } from '../../../../../../lib/external-share-permissions';
import { ExternalLeadAccessError } from '../../../../../../lib/external-lead-access';
export const dynamic='force-dynamic';
type Context={params:{token:string;assetId:string}};
export async function GET(_request:NextRequest,{params}:Context){
 try{
  const lead=await readLeadPage(params.token);
  const permission=(['loggedProblems','maintenanceReports','costOfOwnership','maintenanceSchedules'] as ExternalSharePermission[]).find(key=>lead?.details?.permissions?.[key]) || 'maintenanceSchedules';
  const asset=await getLiveSharedTrackedAsset(params.token,params.assetId,permission);
  return businessJson({ok:true,asset,assets:[asset]});
 }catch(e){return e instanceof ExternalLeadAccessError ? businessJson({error:e.message},e.status) : businessError(e);}
}
export async function POST(request:NextRequest,{params}:Context){
 try{
  requireBusinessOrigin(request);const body=await businessBody(request);
  const scope=await requireLiveSharedAsset(params.token,params.assetId,'maintenanceSchedules',true);
  await limitBusinessAction(`external-schedule:${scope.user.id}`,30);
  await createDealerMaintenanceSchedule({dealerUserId:scope.user.id,sharedLink:params,draft:{...body,accessId:params.assetId,leadId:null} as DealerMaintenanceScheduleProposalInput});
  return businessJson({ok:true,asset:await getLiveSharedTrackedAsset(params.token,params.assetId,'maintenanceSchedules')});
 }catch(e){return e instanceof ExternalLeadAccessError ? businessJson({error:e.message},e.status) : businessError(e);}
}
