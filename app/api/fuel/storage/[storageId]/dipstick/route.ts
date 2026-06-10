import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../../lib/auth-session';
import { listFuelLedger, saveFuelStorageDipstickNote } from '../../../../../../lib/fuel-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { storageId: string } };

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getServerSession();
  if (!session?.user?.id) return unauthorized();

  try {
    const storage = await saveFuelStorageDipstickNote(session.user.id, context.params.storageId, { dipstickNote: '' });
    const ledger = await listFuelLedger(session.user.id);
    return NextResponse.json({ ok: true, storage, ...ledger });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error, 'Failed to clear dipstick note.') }, { status: 400 });
  }
}
