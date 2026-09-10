import { isTrustedNotificationRequest } from '../../../../lib/notification-request-origin';
import { cookies } from 'next/headers';
import { removePushDevice } from '../../../../lib/push-store';
import { currentAppRealm } from '../../../../lib/app-realm-server';
import { isMiddlemanAccountSubtype } from '../../../../lib/middleman-account';
import { MIDDLEMAN_APP_COOKIE } from '../../../../lib/dealer-app-session';
import { NextRequest, NextResponse } from 'next/server';
import {
  DEALER_APP_COOKIE,
  DEALER_APP_LEGACY_COOKIE,
  dealerAppCookieOptions,
  dealerAppLegacyCookieOptions,
} from '../../../../lib/dealer-app-session';

export async function POST(request: NextRequest) {
  const realm = await currentAppRealm() ?? 'dealer';
  if (!isTrustedNotificationRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  if (realm !== 'dealer' && realm !== 'middleman') return NextResponse.json({ ok: false }, { status: 403 });
  await removePushDevice(realm, cookies().get(`aim4price_push_${realm}`)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(realm === 'middleman' ? MIDDLEMAN_APP_COOKIE : DEALER_APP_COOKIE, '', dealerAppCookieOptions(request.url, 0));
  if (realm === 'dealer') response.cookies.set(
    DEALER_APP_LEGACY_COOKIE,
    '',
    dealerAppLegacyCookieOptions(),
  );
  response.cookies.set(`aim4price_push_${realm}`, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
