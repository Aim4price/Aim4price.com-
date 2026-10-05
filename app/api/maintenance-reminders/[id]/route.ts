import {ensureSharingFoundation,recordSharingUsage} from '../../../../lib/sharing-foundation';
import type {NextRequest} from 'next/server';
import {getServerSession,isOwnerAppSession,isDealerAppSession} from '../../../../lib/auth-session';
import {getAssetRegisterAccountAccess} from '../../../../lib/asset-register-account-access';
import {getOwnerAppAccess,ownerAppCan,ownerAppCanAccessAsset} from '../../../../lib/owner-app-access';
import {businessJson,businessBody,requireBusinessOrigin} from '../../../../lib/business-network-api';
import {reminderRecord,maintenanceSource,schedulerPermission} from '../../../../lib/maintenance-reminders';
import {completeAssetMaintenanceRecord} from '../../../../lib/asset-maintenance';
import {listAssetChecklistItems} from '../../../../lib/asset-checklist-db';
import {getDb} from '../../../../lib/db';
import {setAssetHistoryActor} from '../../../../lib/asset-history-schema';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function handle(request:NextRequest,{params}:{params:{id:string}}){try{
 if(request.method!=='GET')requireBusinessOrigin(request);
 const session=await getServerSession({requireActive:false,allowBusiness:true,allowOwnerApp:true,allowDealerApp:true});
 if(!session?.user)return businessJson({error:'Please sign in to open maintenance.'},401);
 const record=await reminderRecord(params.id);if(!record)return businessJson({error:'Maintenance is no longer available.'},404);
 const source=await maintenanceSource(record.id);const owner=session.user.id===record.userId;
 if(owner){if(!await getAssetRegisterAccountAccess(session))return businessJson({error:'Asset access is required.'},403);if(isOwnerAppSession(session)){const a=await getOwnerAppAccess();if(!a||!ownerAppCan(a,'manage_assets')||!ownerAppCanAccessAsset(a,record.assetId))return businessJson({error:'Asset access is required.'},403);}}
 else if(isOwnerAppSession(session)||isDealerAppSession(session)||!source||!await schedulerPermission(source,session.user))return businessJson({error:'This maintenance is no longer shared with you.'},403);
 const canComplete=owner||!!source&&await schedulerPermission(source,session.user,true);
 if(request.method==='GET'){
  if(request.nextUrl.searchParams.get('checklist')==='1'){if(!canComplete)return businessJson({error:'Completion permission is required.'},403);return businessJson({items:await listAssetChecklistItems(record.userId,record.assetId)});}
  const scheduler=(await getDb().query('SELECT name,email FROM "user" WHERE id=$1',[source?.scheduler_id||record.userId])).rows[0];
  // Only maintenance fields required by the shared completion UI leave this endpoint.
  const {assetValue, ...visible}=record;
  return businessJson({record:visible,canComplete,scheduledBy:scheduler?.name||scheduler?.email||'The owner'});
 }
 if(!canComplete)return businessJson({error:'The owner has not enabled recording completed maintenance.'},403);
 if(record.status!=='upcoming')return businessJson({error:record.status==='done'?'Already completed.':'This maintenance was cancelled.'},409);
 const body=await businessBody(request);
 if(!owner)await ensureSharingFoundation();
 const result=await completeAssetMaintenanceRecord(record.userId,record.id,{completedAt:body.completedAt,completedUsage:body.completedUsage,completedNotes:body.completedNotes,completedBy:body.completedBy,maintenanceWork:body.maintenanceWork,continueSchedule:body.continueSchedule},{assetId:record.assetId,before:async client=>{
  if(!owner&&(!source||!await schedulerPermission(source,session.user,true,client)))throw Error('Maintenance access has changed.');
  await setAssetHistoryActor(client,session.user.id,session.user.name||session.user.email,'Maintenance reminder');
 },after:async(client,completed)=>{if(!owner)await recordSharingUsage({accountId:session.user.id,actorId:session.user.id,assetId:record.assetId,token:source?.share_token||undefined,metric:'contribution',eventKey:`maintenance-reminder:${completed.id}`},client);}});
 return businessJson({ok:true,status:result.completed.status});
 }catch(e){console.error('Maintenance reminder action failed',e);return businessJson({error:'Unable to complete maintenance. Check the required service details and refresh to see its latest status.'},400);}}
export const GET=handle;export const POST=handle;
