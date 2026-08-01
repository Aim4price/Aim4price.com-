import { NextRequest, NextResponse } from 'next/server';
import { deleteFuelStorage, listFuelLedger, updateFuelStorage } from '../../../../../lib/fuel-ledger';
import { filterFuelLedgerForWorkspace, resolveOwnerWorkspaceContext } from '../../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    storageId: string;
  };
};

type FuelStorageUpdateRequest = {
  name?: unknown;
  fuelType?: unknown;
  capacityLitres?: unknown;
  currentLitres?: unknown;
  reorderLevelLitres?: unknown;
  locationLabel?: unknown;
  notes?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;

  let body: FuelStorageUpdateRequest;
  try {
    body = (await request.json()) as FuelStorageUpdateRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter valid fuel storage details.' }, { status: 400 });
  }

  try {
    const storage = await updateFuelStorage(resolved.context.ownerUserId, context.params.storageId, body);
    const ledger = await filterFuelLedgerForWorkspace(
      resolved.context,
      await listFuelLedger(resolved.context.ownerUserId),
    );
    return NextResponse.json({ ok: true, storage, ...ledger });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to update fuel storage.') },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;

  try {
    await deleteFuelStorage(resolved.context.ownerUserId, context.params.storageId);
    const ledger = await filterFuelLedgerForWorkspace(
      resolved.context,
      await listFuelLedger(resolved.context.ownerUserId),
    );
    return NextResponse.json({ ok: true, ...ledger });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to delete fuel storage.') },
      { status: 400 },
    );
  }
}
