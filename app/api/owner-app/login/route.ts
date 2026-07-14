import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getAnyServerSession } from '../../../../lib/auth-session';
import { findOwnerAppUserForLogin, markOwnerAppUserLogin, verifyOwnerAppPassword } from '../../../../lib/owner-app';
import { createOwnerAppToken, OWNER_APP_COOKIE, OWNER_APP_MAX_AGE } from '../../../../lib/owner-app-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const attempts = new Map<string, { count: number; resetAt: number }>();

function attemptKey(request: NextRequest, username: string) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return `${address}:${username}`;
}

function genericError(status = 401) {
  return NextResponse.json({ ok: false, error: 'Incorrect username or password.' }, { status });
}

export async function POST(request: NextRequest) {
  if ((await getAnyServerSession())?.user?.id) {
    return NextResponse.json(
      { ok: false, error: 'Sign out of the current Aim4price account before using an Owner App username.' },
      { status: 409 },
    );
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json() as { username?: unknown; password?: unknown };
  } catch {
    return genericError(400);
  }

  const username = String(body.username ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const key = attemptKey(request, username);
  const now = Date.now();
  const current = attempts.get(key);
  if (current && current.resetAt > now && current.count >= 8) {
    return NextResponse.json({ ok: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
  }
  if (!current || current.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
  else current.count += 1;

  const row = await findOwnerAppUserForLogin(username);
  const credentialsValid = Boolean(row && row.is_active && await verifyOwnerAppPassword(password, row.password_hash));
  if (!credentialsValid) return genericError();

  const profile = await getAccountProfile({ id: row!.parent_owner_user_id, name: null, email: null });
  if (profile.accountType !== 'owner' || profile.accountStatus !== 'active') return genericError();

  await markOwnerAppUserLogin(row!.id);
  attempts.delete(key);
  const token = createOwnerAppToken({
    ownerAppUserId: row!.id,
    parentOwnerUserId: row!.parent_owner_user_id,
    version: Number(row!.session_version),
  });
  const response = NextResponse.json({ ok: true, redirectTo: '/owner-app' });
  response.cookies.set(OWNER_APP_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: OWNER_APP_MAX_AGE,
  });
  return response;
}
