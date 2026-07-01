import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { listFuelLedger, saveFuelSlipTransaction } from '../../../../lib/fuel-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function currentUserId() {
  const session = await getServerSession({ requireActive: true });
  return session?.user?.id ?? '';
}

export async function POST(request: Request) {
  const userId = await currentUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to save fuel slips.' }, { status: 401 });
  }

  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid fuel slip save request.' }, { status: 400 });
  }

  try {
    const result = await saveFuelSlipTransaction(userId, payload);
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
    console.error('Aim4price fuel slip save failed.', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'The fuel slip could not be saved.' },
      { status: 400 },
    );
  }
}
