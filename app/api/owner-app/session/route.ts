import { isTrustedNotificationRequest } from '../../../../lib/notification-request-origin';
import { getOwnerAppSession, createOwnerAppToken, OWNER_APP_COOKIE, OWNER_APP_MAX_AGE } from '../../../../lib/owner-app-session';
import { NextRequest, NextResponse } from 'next/server';
import { getOwnerAppAccess } from '../../../../lib/owner-app-access';

export async function GET() {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'You must sign in.' }, { status: 401 });
  return NextResponse.json({ ok: true, session: access });
}

export async function POST(request: NextRequest) {
  if (!isTrustedNotificationRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const session = await getOwnerAppSession();
  if (!session) return NextResponse.json({ ok: false, error: 'You must sign in.' }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(OWNER_APP_COOKIE, createOwnerAppToken({
    ownerAppUserId: session.ownerAppUserId,
    parentOwnerUserId: session.parentOwnerUserId,
    version: session.version,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: OWNER_APP_MAX_AGE,
  });
  return response;
}
