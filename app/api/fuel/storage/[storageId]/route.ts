import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import { archiveFuelStorage, listFuelLedger, updateFuelStorage } from '../../../../../lib/fuel-ledger';

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
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  let body: FuelStorageUpdateRequest;
  try {
    body = (await request.json()) as FuelStorageUpdateRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter valid fuel storage details.' }, { status: 400 });
  }

  try {
    const storage = await updateFuelStorage(session.user.id, context.params.storageId, body);
    const ledger = await listFuelLedger(session.user.id);
    return NextResponse.json({ ok: true, storage, ...ledger });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to update fuel storage.') },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    await archiveFuelStorage(session.user.id, context.params.storageId);
    const ledger = await listFuelLedger(session.user.id);
    return NextResponse.json({ ok: true, ...ledger });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to archive fuel storage.') },
      { status: 400 },
    );
  }
}
