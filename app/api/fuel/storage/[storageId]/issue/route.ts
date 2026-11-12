import {NextResponse} from 'next/server';
import {resolveOwnerWorkspaceContext, filterFuelLedgerForWorkspace} from '../../../../../../lib/owner-workspace-access';
import {recordFuelAssetIssue, listFuelLedger} from '../../../../../../lib/fuel-ledger';
import {teamWriteGuard} from '../../../../../../lib/team-write-guard';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request:Request, {params}:{params:{storageId:string}}) {
  const resolved = await resolveOwnerWorkspaceContext(request);
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;
  try {
    const body = await request.json();
    const assetId = String(body.assetId || '');
    await recordFuelAssetIssue({
      userId:workspace.ownerUserId, storageId:params.storageId, assetId,
      updateAssetLocation:!workspace.team || workspace.team.grant.permissions.updateLocation,
      litres:body.litres, assetFuelPercentAfter:body.assetFuelPercentAfter,
      assetUsageReading:!workspace.team || workspace.team.grant.permissions.updateUsage ? body.assetUsageReading : undefined,
      operatorName:workspace.actorName, activityText:body.activityText,
      latitude:body.latitude, longitude:body.longitude, actorType:'owner_session',
      clientEventId:body.clientEventId,
    },teamWriteGuard(workspace,'recordFuelIssues',{assetId,storageId:params.storageId}));
    return NextResponse.json({ok:true,...await filterFuelLedgerForWorkspace(workspace,await listFuelLedger(workspace.ownerUserId))});
  } catch(error) {return NextResponse.json({ok:false,error:error instanceof Error ? error.message : 'Fuel entry could not be saved.'},{status:400});}
}
