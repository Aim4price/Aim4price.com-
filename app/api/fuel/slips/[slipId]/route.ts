import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import { deleteFuelSlipTransaction, listFuelLedger, saveFuelSlipTransaction } from '../../../../../lib/fuel-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    slipId: string;
  };
};

async function currentUserId() {
  const session = await getServerSession({ requireActive: true });
  return session?.user?.id ?? '';
}

export async function PATCH(request: Request, context: RouteContext) {
  const userId = await currentUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to update fuel slips.' }, { status: 401 });
  }

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
    const result = await saveFuelSlipTransaction(userId, { ...payload, id: slipId, slipId, fuelSlipId: slipId });
    const ledger = await listFuelLedger(userId);

    return NextResponse.json({
      ok: true,
      fuelSlip: result.fuelSlip,
      storage: result.storage,
      event: result.event,
      pendingReview: result.pendingReview,
      message: result.message,
      ...ledger,
      assets: result.assets,
    });
  } catch (error) {
    console.error('Aim4price fuel slip update failed.', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'The fuel slip could not be updated.' },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const userId = await currentUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to delete fuel slips.' }, { status: 401 });
  }

  const slipId = context.params.slipId;
  if (!slipId) {
    return NextResponse.json({ ok: false, error: 'Fuel slip ID is required.' }, { status: 400 });
  }

  try {
    await deleteFuelSlipTransaction(userId, slipId);
    const ledger = await listFuelLedger(userId);

    return NextResponse.json({
      ok: true,
      message: 'Fuel slip deleted.',
      ...ledger,
    });
  } catch (error) {
    console.error('Aim4price fuel slip delete failed.', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'The fuel slip could not be deleted.' },
      { status: 400 },
    );
  }
}
