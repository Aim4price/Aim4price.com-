import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../../lib/auth-session';
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
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  let body: FuelStockRequest;
  try {
    body = (await request.json()) as FuelStockRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter valid fuel stock details.' }, { status: 400 });
  }

  try {
    const result = await recordFuelStorageStock(session.user.id, context.params.storageId, body);
    const ledger = await listFuelLedger(session.user.id);
    return NextResponse.json({ ok: true, ...result, ...ledger });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to save fuel stock entry.') },
      { status: 400 },
    );
  }
}
