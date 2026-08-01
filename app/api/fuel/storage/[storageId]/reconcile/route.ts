import { NextRequest, NextResponse } from 'next/server';
import { listFuelLedger, reconcileFuelStorageBalance } from '../../../../../../lib/fuel-ledger';
import { filterFuelLedgerForWorkspace, resolveOwnerWorkspaceContext } from '../../../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { storageId: string } };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;

  let payload: Record<string, unknown>;
  try {
    const body = await request.json();
    payload = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter valid reconciliation details.' }, { status: 400 });
  }

  try {
    const result = await reconcileFuelStorageBalance({
      ...payload,
      userId: workspace.ownerUserId,
      storageId: context.params.storageId,
      addedByName: workspace.actorName,
      addedByEmail: workspace.actorEmail,
    });
    const ledger = await filterFuelLedgerForWorkspace(
      workspace,
      await listFuelLedger(workspace.ownerUserId),
    );
    return NextResponse.json({ ok: true, ...result, ...ledger, message: 'Tank balance reconciled.' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error, 'Failed to reconcile the tank balance.') }, { status: 400 });
  }
}
