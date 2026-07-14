import { NextResponse } from 'next/server';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession, isDealerAppSession } from '../../../lib/auth-session';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });

  if (!session) {
    return NextResponse.json({ ok: true, signedIn: false, user: null });
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (isDealerAppSession(session)) {
    return NextResponse.json({
      ok: true,
      signedIn: true,
      user: {
        // Existing Dealer leads belong to the parent dealer account. Keep that
        // effective id while exposing the staff identity separately.
        id: session.dealerApp.parentDealerUserId,
        name: session.dealerApp.displayName,
        email: '',
        accountType: 'dealer',
        dealerAppStaff: true,
        dealerAppStaffId: session.dealerApp.staffId,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    signedIn: true,
    user: {
      id: session.user.id,
      name: profile.name || session.user.name,
      email: session.user.email,
      accountType: profile.accountType,
    },
  });
}
