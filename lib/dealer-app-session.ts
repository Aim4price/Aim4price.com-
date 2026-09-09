import { currentAppRealm } from './app-realm-server';
import { isMiddlemanAccountSubtype } from './middleman-account';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getAccountProfile } from './account-profile';
import {
  getDealerStaffById,
  normalizeDealerStaffRole,
  type DealerStaffRole,
} from './dealer-app';

export const MIDDLEMAN_APP_COOKIE = 'aim4price_middleman_app_v1';
export const DEALER_APP_COOKIE = 'aim4price_dealer_app_v2';
export const DEALER_APP_LEGACY_COOKIE = 'aim4price_dealer_app';
export const DEALER_APP_MAX_AGE = 60 * 60 * 24 * 30;

const DEALER_STAFF_ROLES = new Set<DealerStaffRole>([
  'owner',
  'sales',
  'parts',
  'technician',
]);

type Payload = {
  staffId: string;
  dealerUserId: string;
  displayName: string;
  username: string;
  role?: DealerStaffRole;
  version: number;
  exp: number;
  realm?: 'dealer' | 'middleman';
};

type NewPayload = Omit<Payload, 'exp' | 'role'> & { role: DealerStaffRole };

type DealerAppCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
  domain?: string;
};

function secret(): string {
  const configuredSecret = process.env.BETTER_AUTH_SECRET || process.env.DEALER_APP_SECRET;
  if (configuredSecret) return configuredSecret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Dealer App session secret is not configured.');
  }
  return 'aim4price-development-secret-change-me';
}

function sign(raw: string): string {
  return createHmac('sha256', secret()).update(raw).digest('base64url');
}

function sharedCookieDomain(requestUrl: string): string | undefined {
  try {
    const hostname = new URL(requestUrl).hostname.toLowerCase();
    return hostname === 'aim4price.com' || hostname === 'www.aim4price.com'
      ? '.aim4price.com'
      : undefined;
  } catch {
    return undefined;
  }
}

export function dealerAppCookieOptions(
  requestUrl: string,
  maxAge = DEALER_APP_MAX_AGE,
): DealerAppCookieOptions {
  const domain = sharedCookieDomain(requestUrl);
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
    ...(domain ? { domain } : {}),
  };
}

export function dealerAppLegacyCookieOptions(maxAge = 0): DealerAppCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

export function createDealerAppToken(payload: NewPayload): string {
  const raw = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + DEALER_APP_MAX_AGE,
  })).toString('base64url');
  return `${raw}.${sign(raw)}`;
}

function parse(token: string): Payload | null {
  const [raw, signature] = token.split('.');
  if (!raw || !signature) return null;

  const actual = Buffer.from(signature);
  const expected = Buffer.from(sign(raw));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString()) as Partial<Payload>;
    if (
      typeof payload.staffId !== 'string'
      || typeof payload.dealerUserId !== 'string'
      || typeof payload.displayName !== 'string'
      || typeof payload.username !== 'string'
      || typeof payload.version !== 'number'
      || !Number.isInteger(payload.version)
      || payload.version < 1
      || typeof payload.exp !== 'number'
      || payload.exp <= Date.now() / 1000
      || (payload.role !== undefined && !DEALER_STAFF_ROLES.has(payload.role))
    ) {
      return null;
    }
    return payload as Payload;
  } catch {
    return null;
  }
}

export type DealerAppSession = {
  kind: 'dealer-staff';
  staffId: string;
  dealerUserId: string;
  displayName: string;
  username: string;
  role: DealerStaffRole;
  version: number;
};

export async function getDealerAppSession(): Promise<DealerAppSession | null> {
  const cookieStore = await cookies();
  const realm = await currentAppRealm() ?? 'dealer';
  const token = realm === 'middleman' ? cookieStore.get(MIDDLEMAN_APP_COOKIE)?.value
    : cookieStore.get(DEALER_APP_COOKIE)?.value || cookieStore.get(DEALER_APP_LEGACY_COOKIE)?.value;
  const payload = token ? parse(token) : null;
  if (!payload || (payload.realm ?? 'dealer') !== realm) return null;

  const row = await getDealerStaffById(payload.staffId);
  if (
    !row
    || !row.is_active
    || row.dealer_user_id !== payload.dealerUserId
    || Number(row.session_version) !== payload.version
  ) {
    return null;
  }

  const role = normalizeDealerStaffRole(row.staff_role);
  if (payload.role && payload.role !== role) return null;

  const profile = await getAccountProfile({
    id: payload.dealerUserId,
    name: null,
    email: null,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') return null;
  if (isMiddlemanAccountSubtype(profile.accountSubtype) !== (realm === 'middleman')) return null;

  return {
    kind: 'dealer-staff',
    staffId: payload.staffId,
    dealerUserId: payload.dealerUserId,
    displayName: row.display_name,
    username: row.username,
    role,
    version: payload.version,
  };
}

