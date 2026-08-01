import { NextRequest, NextResponse } from 'next/server';
import { createFuelStorage, listFuelLedger } from '../../../lib/fuel-ledger';
import { filterFuelLedgerForWorkspace, resolveOwnerWorkspaceContext } from '../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FuelStorageCreateRequest = {
  name?: unknown;
  fuelType?: unknown;
  capacityLitres?: unknown;
  currentLitres?: unknown;
  reorderLevelLitres?: unknown;
  locationLabel?: unknown;
  notes?: unknown;
  pin?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;

  try {
    const ledger = await filterFuelLedgerForWorkspace(
      resolved.context,
      await listFuelLedger(resolved.context.ownerUserId),
    );
    return NextResponse.json({ ok: true, ...ledger });
  } catch (error) {
    console.error('fuel ledger load failed', error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to load Fuel Ledger.') },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;

  let body: FuelStorageCreateRequest;
  try {
    body = (await request.json()) as FuelStorageCreateRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter valid fuel storage details.' }, { status: 400 });
  }

  try {
    const storage = await createFuelStorage(resolved.context.ownerUserId, body);
    const ledger = await filterFuelLedgerForWorkspace(
      resolved.context,
      await listFuelLedger(resolved.context.ownerUserId),
    );

    return NextResponse.json({ ok: true, storage, ...ledger });
  } catch (error) {
    const message = errorMessage(error, 'Failed to create fuel storage.');
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
