import { NextRequest, NextResponse } from 'next/server';
import { requestAppRealm } from './lib/app-realm';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Always replace client-supplied realm hints. A realm selects a cookie; the
  // signed token and active account subtype still authorize every request.
  requestHeaders.delete('x-aim4price-app-realm');
  const realm = requestAppRealm(request.nextUrl, request.headers.get('referer'));
  if (realm) requestHeaders.set('x-aim4price-app-realm', realm);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
