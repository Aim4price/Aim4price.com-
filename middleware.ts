import { NextRequest, NextResponse } from 'next/server';
import { isTrustedRequestOrigin } from './lib/trusted-request-origin';
import { requestAppRealm, appRealmForPath } from './lib/app-realm';
import { isolateAppCookies, hasAppCookies } from './lib/app-cookie-isolation';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/field-manager' || path.startsWith('/field-manager/') || path === '/account/field-manager') {
    return NextResponse.redirect(new URL(path.startsWith('/account/') ? '/account/owner-app' : '/owner-app/login', request.url), 307);
  }
  if (path === '/api/field-managers' || path.startsWith('/api/field-managers/') || path.startsWith('/api/field-manager/')) {
    return NextResponse.json({ ok: false, error: 'Field Manager has moved to Aim4price Manager. Sign in again.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
  }
  const isAdminApi = request.nextUrl.pathname === '/api/admin' || request.nextUrl.pathname.startsWith('/api/admin/');
  if (isAdminApi && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
    && !isTrustedRequestOrigin(request.headers.get('origin'), request.nextUrl.origin)) {
    return NextResponse.json({ ok: false, error: 'Invalid request origin.' }, { status: 403 });
  }
  const requestHeaders = new Headers(request.headers);
  // Always replace client-supplied realm hints. A realm selects a cookie; the
  // signed token and active account subtype still authorize every request.
  requestHeaders.delete('x-aim4price-app-realm');
  requestHeaders.set('x-aim4price-request-path', path);
  requestHeaders.set('x-aim4price-request-method', request.method);
  const realm = requestAppRealm(request.nextUrl, request.headers.get('referer'), request.headers.get('x-aim4price-client-realm'));
  if (realm === 'owner' && path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !isTrustedRequestOrigin(request.headers.get('origin'), request.nextUrl.origin)) {
    return NextResponse.json({ ok: false, error: 'Invalid request origin.' }, { status: 403 });
  }
  const cookie = request.headers.get('cookie') ?? '';
  // OAuth consent uses an ordinary HTML form; use its same-origin Origin header.
  // Preserve its real website session even when unrelated app cookies are present.
  const aiWebsiteAction = ['/api/ai/oauth/authorize', '/api/ai/connections'].includes(request.nextUrl.pathname)
    && request.headers.get('origin') === process.env.AIM4PRICE_AI_ORIGIN;
  let websiteContext = aiWebsiteAction || request.headers.get('x-aim4price-client-realm') === 'website';
  if (!aiWebsiteAction && !request.headers.has('x-aim4price-client-realm')) {
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
  if (['/account/ai-connect', '/admin/ai-connect'].includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/api/ai/') || request.nextUrl.pathname.startsWith('/.well-known/oauth-')) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    // A no-referrer document makes native form POSTs send Origin: null.
    // Keep the consent form same-origin while hiding referrers from other sites.
    response.headers.set('Referrer-Policy', ['/account/ai-connect', '/admin/ai-connect'].includes(request.nextUrl.pathname) ? 'same-origin' : 'no-referrer');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  if ((request.nextUrl.pathname === '/team' || request.nextUrl.pathname.startsWith('/team/')) || request.nextUrl.pathname === '/account/team-access' || request.nextUrl.pathname.startsWith('/api/team-')) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('Referrer-Policy', 'same-origin');
    response.headers.set('X-Frame-Options', 'DENY');
  }

  if (request.nextUrl.pathname === '/parts' || request.nextUrl.pathname.startsWith('/parts/') || request.nextUrl.pathname.startsWith('/dealer/parts') || request.nextUrl.pathname.startsWith('/api/parts-network')) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Frame-Options', 'DENY');
  }

  if (request.nextUrl.pathname === '/tutorials' || request.nextUrl.pathname.startsWith('/tutorials/')) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('X-Frame-Options', 'DENY');
  }

  if (request.nextUrl.pathname.startsWith('/asset-share/')) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('Referrer-Policy', 'no-referrer');
  }
  if (isAdminApi || realm || ambiguousApi) response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };

