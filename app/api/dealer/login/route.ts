import { currentAppRealm } from '../../../../lib/app-realm-server';
import { isMiddlemanAccountSubtype } from '../../../../lib/middleman-account';
import { MIDDLEMAN_APP_COOKIE } from '../../../../lib/dealer-app-session';
import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getAnyServerSession } from '../../../../lib/auth-session';
import {
  findDealerStaffForLogin,
  markDealerStaffLogin,
  normalizeDealerStaffRole,
  verifyDealerPassword,
} from '../../../../lib/dealer-app';
import {
  createDealerAppToken,
  DEALER_APP_COOKIE,
  DEALER_APP_LEGACY_COOKIE,
  dealerAppCookieOptions,
  dealerAppLegacyCookieOptions,
  getDealerAppSession,
} from '../../../../lib/dealer-app-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const attempts = new Map<string, { count: number; reset: number }>();

function key(request: NextRequest, username: string): string {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return `${address}:${username}`;
}

function genericError(status = 401) {
  return NextResponse.json(
    { ok: false, error: 'Incorrect username or password.' },
    { status },
  );
}

export async function POST(request: NextRequest) {
  const realm = await currentAppRealm();
  if (realm !== 'dealer' && realm !== 'middleman') return genericError();
  if (await getDealerAppSession()) {
    return NextResponse.json(
      { ok: false, error: 'Sign out of the current Dealer App user before switching staff logins.' },
      { status: 409 },
    );
  }
  if ((await getAnyServerSession())?.user?.id) {
    return NextResponse.json(
      { ok: false, error: 'Sign out of the current Aim4price account before using a staff login.' },
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
  const attemptKey = key(request, username);
  const now = Date.now();
  const state = attempts.get(attemptKey);
  if (state && state.reset > now && state.count >= 8) {
    return NextResponse.json(
      { ok: false, error: 'Too many attempts. Try again later.' },
      { status: 429 },
    );
  }
  if (!state || state.reset <= now) {
    attempts.set(attemptKey, { count: 1, reset: now + 15 * 60_000 });
  } else {
    state.count += 1;
  }

  const row = await findDealerStaffForLogin(username);
  const valid = Boolean(
    row
    && row.is_active
    && await verifyDealerPassword(password, row.password_hash),
  );
  if (!valid) return genericError();

  const profile = await getAccountProfile({ id: row!.dealer_user_id, name: null, email: null });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active'
    || isMiddlemanAccountSubtype(profile.accountSubtype) !== (realm === 'middleman')) return genericError();

  await markDealerStaffLogin(row!.id);
  attempts.delete(attemptKey);

  const token = createDealerAppToken({
    realm,
    staffId: row!.id,
    dealerUserId: row!.dealer_user_id,
    displayName: row!.display_name,
    username: row!.username,
    role: normalizeDealerStaffRole(row!.staff_role),
    version: Number(row!.session_version),
  });
  const response = NextResponse.json({
    ok: true,
    redirectTo: realm === 'middleman' ? '/middleman' : '/dealer',
    welcome: {
      displayName: row!.display_name || row!.username,
      companyName: profile.businessName || profile.displayName || profile.name || 'Aim4price',
      logoUrl: profile.logoUrl || '/icon.png',
    },
  });
  response.cookies.set(realm === 'middleman' ? MIDDLEMAN_APP_COOKIE : DEALER_APP_COOKIE, token, dealerAppCookieOptions(request.url));
  if (realm === 'dealer') response.cookies.set(
    DEALER_APP_LEGACY_COOKIE,
    '',
    dealerAppLegacyCookieOptions(),
  );
  return response;
}


