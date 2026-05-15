import { NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { listSharedRegistersForPartner } from '../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const registers = await listSharedRegistersForPartner(session.user.id);
    return NextResponse.json({ ok: true, registers });
  } catch (error) {
    console.error('shared registers GET failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to load shared registers.' }, { status: 500 });
  }
}
