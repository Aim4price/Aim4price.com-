import { NextRequest, NextResponse } from 'next/server';
import {
  DEALER_APP_COOKIE,
  DEALER_APP_LEGACY_COOKIE,
  dealerAppCookieOptions,
  dealerAppLegacyCookieOptions,
} from '../../../../lib/dealer-app-session';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEALER_APP_COOKIE, '', dealerAppCookieOptions(request.url, 0));
  response.cookies.set(
    DEALER_APP_LEGACY_COOKIE,
    '',
    dealerAppLegacyCookieOptions(),
  );
  return response;
}
