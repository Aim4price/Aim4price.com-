import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../../lib/account-profile';
import { getServerSession } from '../../../../../../lib/auth-session';
import { listFuelLedger, reconcileFuelStorageBalance } from '../../../../../../lib/fuel-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { storageId: string } };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

async function requireOwnerSession() {
  const session = await getServerSession({ requireActive: true });
  if (!session?.user?.id) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 }) };
  }
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (String(profile.accountType).toLowerCase() !== 'owner') {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Fuel balance reconciliation is only available to owner accounts.' }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireOwnerSession();
  if (!access.ok) return access.response;

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
      userId: access.session.user.id,
      storageId: context.params.storageId,
      addedByName: access.session.user.name,
      addedByEmail: access.session.user.email,
    });
    const ledger = await listFuelLedger(access.session.user.id);
    return NextResponse.json({ ok: true, ...result, ...ledger, message: 'Tank balance reconciled.' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error, 'Failed to reconcile the tank balance.') }, { status: 400 });
  }
}
