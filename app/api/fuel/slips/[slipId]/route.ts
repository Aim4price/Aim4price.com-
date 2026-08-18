import { NextResponse } from 'next/server';
import { getFuelSlipTransactionById, listFuelLedger, saveFuelSlipTransaction, voidFuelSlipTransaction } from '../../../../../lib/fuel-ledger';
import {
  assertWorkspaceAssetAccess,
  filterFuelLedgerForWorkspace,
  resolveOwnerWorkspaceContext,
} from '../../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    slipId: string;
  };
};

export async function PATCH(request: Request, context: RouteContext) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;

  const slipId = context.params.slipId;
  if (!slipId) {
    return NextResponse.json({ ok: false, error: 'Fuel slip ID is required.' }, { status: 400 });
  }

  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid fuel slip update request.' }, { status: 400 });
  }

  try {
    const existing = await getFuelSlipTransactionById(workspace.ownerUserId, slipId);
    if (existing?.assetId) await assertWorkspaceAssetAccess(workspace, existing.assetId);
    if (String(payload.targetType ?? '').trim() === 'asset') {
      await assertWorkspaceAssetAccess(workspace, payload.assetId ?? payload.targetId);
    }
    const result = await saveFuelSlipTransaction(workspace.ownerUserId, {
      ...payload,
      id: slipId,
      slipId,
      fuelSlipId: slipId,
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
    console.error('Aim4price fuel slip update failed.', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'The fuel slip could not be updated.' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;

  const slipId = context.params.slipId;
  if (!slipId) {
    return NextResponse.json({ ok: false, error: 'Fuel slip ID is required.' }, { status: 400 });
  }

  try {
    const existing = await getFuelSlipTransactionById(workspace.ownerUserId, slipId);
    if (existing?.assetId) await assertWorkspaceAssetAccess(workspace, existing.assetId);
    const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
    await voidFuelSlipTransaction(workspace.ownerUserId, slipId, {
      actor: {
        userId: workspace.actorUserId,
        name: workspace.actorName,
        email: workspace.actorEmail,
      },
      reason: payload.reason,
    });
    const ledger = await filterFuelLedgerForWorkspace(
      workspace,
      await listFuelLedger(workspace.ownerUserId),
    );

    return NextResponse.json({
      ok: true,
      message: 'Fuel slip voided. Its change history has been kept.',
      ...ledger,
    });
  } catch (error) {
    console.error('Aim4price fuel slip void failed.', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'The fuel slip could not be voided.' },
      { status: 400 },
    );
  }
}
