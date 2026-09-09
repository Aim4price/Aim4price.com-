import { NextRequest, NextResponse } from 'next/server';
import { requestAppRealm, appRealmForPath } from './lib/app-realm';
import { isolateAppCookies, hasAppCookies } from './lib/app-cookie-isolation';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Always replace client-supplied realm hints. A realm selects a cookie; the
  // signed token and active account subtype still authorize every request.
  requestHeaders.delete('x-aim4price-app-realm');
  const realm = requestAppRealm(request.nextUrl, request.headers.get('referer'), request.headers.get('x-aim4price-client-realm'));
  const cookie = request.headers.get('cookie') ?? '';
  let websiteContext = request.headers.get('x-aim4price-client-realm') === 'website';
  if (!request.headers.has('x-aim4price-client-realm')) {
    try {
      const source = new URL(request.headers.get('referer') ?? '');
      websiteContext = source.origin === request.nextUrl.origin && !appRealmForPath(source.pathname);
    } catch { /* An absent or invalid referrer cannot select an account. */ }
  }
  const ambiguousApi = !realm && !websiteContext && request.nextUrl.pathname.startsWith('/api/') && hasAppCookies(cookie);
  requestHeaders.delete('x-aim4price-client-realm');
  if (realm) {
    requestHeaders.set('x-aim4price-app-realm', realm);
    requestHeaders.set('cookie', isolateAppCookies(cookie, realm));
  } else if (ambiguousApi) {
    // Older clients must sign in/reload rather than fall back to a different account.
    requestHeaders.set('cookie', isolateAppCookies(cookie, null));
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (realm || ambiguousApi) response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
