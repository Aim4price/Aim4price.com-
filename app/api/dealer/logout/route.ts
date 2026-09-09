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
  const response = NextResponse.json({ ok: true });
  response.cookies.set(realm === 'middleman' ? MIDDLEMAN_APP_COOKIE : DEALER_APP_COOKIE, '', dealerAppCookieOptions(request.url, 0));
  if (realm === 'dealer') response.cookies.set(
    DEALER_APP_LEGACY_COOKIE,
    '',
    dealerAppLegacyCookieOptions(),
  );
  return response;
}

