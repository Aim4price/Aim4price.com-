import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getDealerAppSession } from '../../../../lib/dealer-app-session';
import { getAccountProfile } from '../../../../lib/account-profile';

export async function GET() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'You must sign in.' }, { status: 401 });
  }
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    return NextResponse.json({
      ok: false,
      error: 'Dealer App is available to active dealer accounts only.',
    }, { status: 403 });
  }
  const dealerAppSession = await getDealerAppSession();
  return NextResponse.json({
    ok: true,
    session: {
      kind: dealerAppSession ? 'staff' : 'account',
      displayName: dealerAppSession?.displayName || profile.businessName || profile.displayName || profile.name,
      dealerUserId: session.user.id,
      role: dealerAppSession?.role ?? 'owner',
    },
  });
}
