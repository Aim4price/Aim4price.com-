import { NextResponse } from 'next/server';
import { getDesktopScope } from './desktop-workspace';
import { resolveOwnerWorkspaceContext, getWorkspaceAssetIds, type OwnerWorkspaceContext } from './owner-workspace-access';
import { listAssetMaintenanceData, calculateAssetMaintenanceSummary, getAssetMaintenanceRecordById, completeAssetMaintenanceRecord, unknownMaintenanceCompletionNote, type AssetMaintenanceListResult } from './asset-maintenance';
import { lockTeamScope, auditTeam } from './team-access';
export async function filterTeamMaintenance(workspace: OwnerWorkspaceContext, data: AssetMaintenanceListResult): Promise<AssetMaintenanceListResult> {
  if (!workspace.team) return data;
  const ids = (await getWorkspaceAssetIds(workspace))!, permissions = workspace.team.grant.permissions;
  const records = data.records.filter(record => ids.has(record.assetId)).map(record => ({...record,
    assetValue:permissions.viewValues ? record.assetValue : 0,
    sourcePhotoUrls:permissions.viewPhotos ? record.sourcePhotoUrls : [],
    sourceLatitude:permissions.viewMap ? record.sourceLatitude : null,sourceLongitude:permissions.viewMap ? record.sourceLongitude : null,
    sourceLocationText:permissions.viewMap ? record.sourceLocationText : '',
  }));
  return {records,assets:data.assets.filter(asset=>ids.has(asset.id)).map(asset=>({...asset,value:permissions.viewValues ? asset.value : 0})),fieldManagers:[],summary:calculateAssetMaintenanceSummary(records)};
}
export async function teamMaintenanceResponse(request: Request, recordId?: string): Promise<NextResponse | null> {
  const scope = await getDesktopScope(new URL(request.url).searchParams.get('desktopMembershipId') || undefined);
  if (!scope) return null;
  const resolved = await resolveOwnerWorkspaceContext(request);
  if (!resolved.ok) return resolved.response;
  try {
    if (recordId) {
      const body = await request.json();
      if (body.status && body.status !== 'done') return NextResponse.json({ok:false,error:'Reopening work is not available.'},{status:403});
      const record = await getAssetMaintenanceRecordById(scope.grant.ownerId,recordId);
      if (!record || record.status !== 'upcoming') return NextResponse.json({ok:false,error:'Scheduled work unavailable.'},{status:404});
      if (body.quickComplete === true && body.confirmedComplete !== true) return NextResponse.json({ok:false,error:'Confirm that this work is complete.'},{status:400});
      if (body.linkToScheduledMaintenance === false) return NextResponse.json({ok:false,error:'Only scheduled work can be completed with this permission.'},{status:403});
      await completeAssetMaintenanceRecord(scope.grant.ownerId,recordId,{
        completedAt:body.completedAt,completedNotes:body.quickComplete === true ? unknownMaintenanceCompletionNote(record.maintenanceType) : body.completedNotes,maintenanceWork:body.maintenanceWork,
        completedUsage:scope.grant.permissions.updateUsage ? body.completedUsage : undefined,
        completedBy:scope.grant.displayName,
      },{assetId:record.assetId,allowUnknownDetails:body.quickComplete === true,before:async client=>{await lockTeamScope(client,scope,record.assetId,'completeMaintenance');},after:async(client,done)=>{await auditTeam(client,scope.actor,scope.grant,'Maintenance completed',record.assetId,{maintenanceId:done.id});}});
    }
    const params = new URL(request.url).searchParams;
    const data = await filterTeamMaintenance(resolved.context,await listAssetMaintenanceData(scope.grant.ownerId,{assetId:params.get('assetId') === 'all' ? null : params.get('assetId'),type:['service','checkup','repair'].includes(params.get('type') || '') ? params.get('type') as 'service'|'checkup'|'repair' : null,status:['upcoming','done'].includes(params.get('status') || '') ? params.get('status') as 'upcoming'|'done' : null,assignedTo:params.get('assignedTo') === 'all' ? null : params.get('assignedTo')}));
    return NextResponse.json({ok:true,...data},{headers:{'Cache-Control':'private, no-store'}});
  } catch {return NextResponse.json({ok:false,error:'The maintenance request could not be completed. Check your access and work details.'},{status:400});}
}
