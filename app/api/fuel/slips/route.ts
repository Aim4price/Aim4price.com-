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
    if (String(payload.targetType ?? '').trim() === 'asset') {
      await assertWorkspaceAssetAccess(workspace, payload.assetId ?? payload.targetId);
    }
    const result = await saveFuelSlipTransaction(workspace.ownerUserId, {
      ...payload,
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
      fuelSlip: result.fuelSlip,
      storage: result.storage,
      event: result.event,
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
