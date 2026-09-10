import { isTrustedNotificationRequest } from '../../../../lib/notification-request-origin';
import { cookies } from 'next/headers';
import { removePushDevice } from '../../../../lib/push-store';
import { NextResponse } from 'next/server';
import { OWNER_APP_COOKIE } from '../../../../lib/owner-app-session';

export async function POST(request: Request) {
  if (!isTrustedNotificationRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  await removePushDevice('owner', cookies().get('aim4price_push_owner')?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(OWNER_APP_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  response.cookies.set('aim4price_push_owner', '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
