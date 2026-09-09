import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, isDealerAppSession, isOwnerAppSession } from '../../../../lib/auth-session';
import { getAccountProfile } from '../../../../lib/account-profile';
import { confirmAppLoginNamespace, getAppLoginNamespace } from '../../../../lib/app-login-namespace';
import { suggestAppAccountName } from '../../../../lib/app-login-name';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function access() {
  const session = await getServerSession();
  if (!session?.user?.id || isDealerAppSession(session) || isOwnerAppSession(session)) return null;
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (!['owner', 'dealer'].includes(profile.accountType) || profile.accountStatus !== 'active') return null;
  return { userId: session.user.id, name: profile.businessName || profile.displayName || profile.name || 'account' };
}

export async function GET() {
  const owner = await access();
  if (!owner) return NextResponse.json({ ok: false, error: 'Account owner login required.' }, { status: 403 });
  return NextResponse.json({ ok: true, accountName: await getAppLoginNamespace(owner.userId), suggestedName: suggestAppAccountName(owner.name) });
}

export async function POST(request: NextRequest) {
  const owner = await access();
  if (!owner) return NextResponse.json({ ok: false, error: 'Account owner login required.' }, { status: 403 });
  try {
    const body = await request.json();
    return NextResponse.json({ ok: true, accountName: await confirmAppLoginNamespace(owner.userId, body.accountName) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not confirm the business login name.' }, { status: 400 });
  }
}
