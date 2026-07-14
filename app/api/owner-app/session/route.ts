import { NextResponse } from 'next/server';
import { getOwnerAppAccess } from '../../../../lib/owner-app-access';

export async function GET() {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'You must sign in.' }, { status: 401 });
  return NextResponse.json({ ok: true, session: access });
}
