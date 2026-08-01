import { NextRequest, NextResponse } from 'next/server';
import { saveFuelStoragePin } from '../../../../../../lib/fuel-ledger';
import { resolveOwnerWorkspaceContext } from '../../../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    storageId: string;
  };
};

type FuelPinRequest = {
  pin?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;

  let body: FuelPinRequest;
  try {
    body = (await request.json()) as FuelPinRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter a valid fuel PIN.' }, { status: 400 });
  }

  try {
    const storage = await saveFuelStoragePin(resolved.context.ownerUserId, context.params.storageId, body.pin);
    return NextResponse.json({ ok: true, storage });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to save the fuel PIN.') },
      { status: 400 },
    );
  }
}
