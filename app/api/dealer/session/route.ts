import { currentAppRealm } from '../../../../lib/app-realm-server';
import { isMiddlemanAccountSubtype } from '../../../../lib/middleman-account';
import { MIDDLEMAN_APP_COOKIE } from '../../../../lib/dealer-app-session';
import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import {
  createDealerAppToken,
  DEALER_APP_COOKIE,
  DEALER_APP_LEGACY_COOKIE,
  dealerAppCookieOptions,
  dealerAppLegacyCookieOptions,
  getDealerAppSession,
  type DealerAppSession,
} from '../../../../lib/dealer-app-session';

function staffSessionPayload(session: DealerAppSession) {
  return {
    kind: 'staff',
    displayName: session.displayName,
    dealerUserId: session.dealerUserId,
    role: session.role,
  };
}

export async function GET() {
  const dealerAppSession = await getDealerAppSession();
  if (dealerAppSession) {
    return NextResponse.json({
      ok: true,
      session: staffSessionPayload(dealerAppSession),
    });
  }

  const session = await getServerSession();
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
  return NextResponse.json({
    ok: true,
    session: {
      kind: 'account',
      displayName: profile.businessName || profile.displayName || profile.name,
      dealerUserId: session.user.id,
      role: 'owner',
    },
  });
}

export async function POST(request: NextRequest) {
  const realm = await currentAppRealm();
  if (realm !== 'dealer' && realm !== 'middleman') return NextResponse.json({ ok: false, error: 'You must sign in.' }, { status: 401 });
  const session = await getDealerAppSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'You must sign in.' }, { status: 401 });
  }

  const token = createDealerAppToken({
    realm,
    staffId: session.staffId,
    dealerUserId: session.dealerUserId,
    displayName: session.displayName,
    username: session.username,
    role: session.role,
    version: session.version,
  });
  const response = NextResponse.json({
    ok: true,
    session: staffSessionPayload(session),
  });
  response.cookies.set(realm === 'middleman' ? MIDDLEMAN_APP_COOKIE : DEALER_APP_COOKIE, token, dealerAppCookieOptions(request.url));
  if (realm === 'dealer') response.cookies.set(
    DEALER_APP_LEGACY_COOKIE,
    '',
    dealerAppLegacyCookieOptions(),
  );
  return response;
}


