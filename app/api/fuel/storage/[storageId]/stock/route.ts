import { resolveOwnerWorkspaceContext, filterFuelLedgerForWorkspace } from '../../../../../../lib/owner-workspace-access';
import { teamWriteGuard } from '../../../../../../lib/team-write-guard';
import { NextRequest, NextResponse } from 'next/server';
import { listFuelLedger, recordFuelStorageStock } from '../../../../../../lib/fuel-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    storageId: string;
  };
};

type FuelStockRequest = {
  mode?: unknown;
  litres?: unknown;
  currentLitres?: unknown;
  operatorName?: unknown;
  note?: unknown;
  clientEventId?: unknown;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const resolved = await resolveOwnerWorkspaceContext(request);
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;

  let body: FuelStockRequest;
  try {
    body = (await request.json()) as FuelStockRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter valid fuel stock details.' }, { status: 400 });
  }

  try {
    const result = await recordFuelStorageStock(workspace.ownerUserId, context.params.storageId, workspace.team ? {mode:body.mode,litres:body.litres,currentLitres:body.currentLitres,note:body.note,clientEventId:body.clientEventId,operatorName:workspace.actorName} : body, teamWriteGuard(workspace,'refillFuel',{storageId:context.params.storageId}));
    const ledger = await filterFuelLedgerForWorkspace(workspace,await listFuelLedger(workspace.ownerUserId));
    return NextResponse.json({ ok: true, ...(workspace.team ? {} : result), ...ledger });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to save fuel stock entry.') },
      { status: 400 },
    );
  }
}
