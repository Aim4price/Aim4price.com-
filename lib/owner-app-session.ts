import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getAccountProfile } from './account-profile';
import { getOwnerAppUserById } from './owner-app';
import { currentAppRealm } from './app-realm-server';

export const OWNER_APP_COOKIE = 'aim4price_owner_app';
export const OWNER_APP_MAX_AGE = 60 * 60 * 12;

type OwnerAppTokenPayload = {
  ownerAppUserId: string;
  parentOwnerUserId: string;
  version: number;
  exp: number;
};

export type OwnerAppSession = {
  kind: 'owner-app-user';
  ownerAppUserId: string;
  parentOwnerUserId: string;
  displayName: string;
  username: string;
  version: number;
};

function sessionSecret(): string {
  const configured = process.env.BETTER_AUTH_SECRET || process.env.OWNER_APP_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') throw new Error('Owner App session secret is not configured.');
  return 'aim4price-development-secret-change-me';
}

function sign(raw: string): string {
  return createHmac('sha256', sessionSecret()).update(raw).digest('base64url');
}

export function createOwnerAppToken(payload: Omit<OwnerAppTokenPayload, 'exp'>): string {
  const raw = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + OWNER_APP_MAX_AGE,
  })).toString('base64url');
  return `${raw}.${sign(raw)}`;
}

function parseOwnerAppToken(token: string): OwnerAppTokenPayload | null {
  const [raw, signature] = token.split('.');
  if (!raw || !signature) return null;
  const actual = Buffer.from(signature);
  const expected = Buffer.from(sign(raw));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString()) as OwnerAppTokenPayload;
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
}

export async function getOwnerAppSession(): Promise<OwnerAppSession | null> {
  if (await currentAppRealm() !== 'owner') return null;
  const token = (await cookies()).get(OWNER_APP_COOKIE)?.value;
  const payload = token ? parseOwnerAppToken(token) : null;
  if (!payload) return null;

  const row = await getOwnerAppUserById(payload.ownerAppUserId);
  if (
    !row
    || !row.is_active
    || row.parent_owner_user_id !== payload.parentOwnerUserId
    || Number(row.session_version) !== payload.version
  ) {
    return null;
  }

  const profile = await getAccountProfile({ id: payload.parentOwnerUserId, name: null, email: null });
  if (profile.accountType !== 'owner' || profile.accountStatus !== 'active') return null;

  return {
    kind: 'owner-app-user',
    ownerAppUserId: row.id,
    parentOwnerUserId: row.parent_owner_user_id,
    displayName: row.display_name,
    username: row.username,
    version: payload.version,
  };
}
