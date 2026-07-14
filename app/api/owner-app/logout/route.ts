import { NextResponse } from 'next/server';
import { OWNER_APP_COOKIE } from '../../../../lib/owner-app-session';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(OWNER_APP_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
