import { NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { listAccountantRegisters } from '../../../../lib/accountant-workspace';
import { getServerSession } from '../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'finance' || profile.accountSubtype !== 'accountant') {
    return NextResponse.json({ ok: false, error: 'This workspace is only available to accountant accounts.' }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, registers: await listAccountantRegisters(session.user.id) });
  } catch (error) {
    console.error('accountant registers GET failed', error);
    return NextResponse.json({ ok: false, error: 'Shared Asset Registers could not be loaded.' }, { status: 500 });
  }
}
