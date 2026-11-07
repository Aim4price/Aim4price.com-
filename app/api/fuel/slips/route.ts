import { assertTeamFuelTarget } from '../../../../lib/owner-workspace-access';
import { NextResponse } from 'next/server';
import { listFuelLedger, saveFuelSlipTransaction } from '../../../../lib/fuel-ledger';
import {
  assertWorkspaceAssetAccess,
  filterFuelLedgerForWorkspace,
  resolveOwnerWorkspaceContext,
} from '../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;

  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid fuel slip save request.' }, { status: 400 });
  }

  try {
    if (workspace.team && ['id','slipId','fuelSlipId','captureRequestId','offlineEventId','uploadId','documentFileUrl'].some(key=>payload[key])) return NextResponse.json({ok:false,error:'Use a new manual fuel entry without an existing file or record reference.'},{status:403});
    await assertTeamFuelTarget(workspace, payload);
    if (String(payload.targetType ?? '').trim() === 'asset') {
      await assertWorkspaceAssetAccess(workspace, payload.assetId ?? payload.targetId);
    }
    const result = await saveFuelSlipTransaction(workspace.ownerUserId, {
      ...payload,
      ...(workspace.team ? {updateAssetUsage:workspace.team.grant.permissions.updateUsage && payload.updateAssetUsage !== false,latitude:workspace.team.grant.permissions.updateLocation ? payload.latitude : null,longitude:workspace.team.grant.permissions.updateLocation ? payload.longitude : null,locationText:workspace.team.grant.permissions.updateLocation ? payload.locationText : ''} : {}),
      auditActorUserId: workspace.actorUserId,
      auditActorName: workspace.actorName,
      auditActorEmail: workspace.actorEmail,
    });
    const ledger = await filterFuelLedgerForWorkspace(
      workspace,
      await listFuelLedger(workspace.ownerUserId),
    );

    return NextResponse.json({
      ok: true,
      fuelSlip: workspace.team ? ledger.recentFuelSlips.find(slip => slip.id === result.fuelSlip.id) : result.fuelSlip,
      storage: workspace.team ? null : result.storage,
      event: workspace.team ? null : result.event,
      pendingReview: result.pendingReview,
      message: result.message,
      ...ledger,
      assets: ledger.assets,
    });
  } catch (error) {
    console.error('Aim4price fuel slip save failed.', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'The fuel slip could not be saved.' },
      { status: 400 },
    );
  }
}
