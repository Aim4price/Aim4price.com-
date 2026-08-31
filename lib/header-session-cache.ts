export type HeaderAccountType = 'owner' | 'dealer' | 'finance' | 'insurance' | 'licensing';

export type HeaderSessionUser = {
  id: string;
  name: string;
  email: string;
  accountType: HeaderAccountType;
  accountSubtype: string | null;
  logo?: string | null;
  logoUrl?: string | null;
  accountLogo?: string | null;
  accountLogoUrl?: string | null;
  companyLogo?: string | null;
  companyLogoUrl?: string | null;
  businessLogo?: string | null;
  businessLogoUrl?: string | null;
  profileLogo?: string | null;
  profileLogoUrl?: string | null;
  imageUrl?: string | null;
  avatarUrl?: string | null;
};

type HeaderSessionResponse = {
  ok?: boolean;
  signedIn?: boolean;
  user?: unknown;
};

type HeaderSessionCacheEntry = {
  savedAt: number;
  user: HeaderSessionUser | null;
};

const HEADER_SESSION_CACHE_KEY = 'aim4price-header-session-v2';
const HEADER_SESSION_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const ACCOUNT_TYPES = new Set<HeaderAccountType>(['owner', 'dealer', 'finance', 'insurance', 'licensing']);

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeHeaderSessionUser(value: unknown): HeaderSessionUser | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const source = value as Record<string, unknown>;
  const id = normalizeText(source.id);
  const accountType = normalizeText(source.accountType) as HeaderAccountType;

  if (!id || !ACCOUNT_TYPES.has(accountType)) return null;

  return {
    id,
    name: normalizeText(source.name),
    email: normalizeText(source.email),
    accountType,
    accountSubtype: normalizeOptionalText(source.accountSubtype),
    logo: normalizeOptionalText(source.logo),
    logoUrl: normalizeOptionalText(source.logoUrl),
    accountLogo: normalizeOptionalText(source.accountLogo),
    accountLogoUrl: normalizeOptionalText(source.accountLogoUrl),
    companyLogo: normalizeOptionalText(source.companyLogo),
    companyLogoUrl: normalizeOptionalText(source.companyLogoUrl),
    businessLogo: normalizeOptionalText(source.businessLogo),
    businessLogoUrl: normalizeOptionalText(source.businessLogoUrl),
    profileLogo: normalizeOptionalText(source.profileLogo),
    profileLogoUrl: normalizeOptionalText(source.profileLogoUrl),
    imageUrl: normalizeOptionalText(source.imageUrl),
    avatarUrl: normalizeOptionalText(source.avatarUrl),
  };
}

export function readCachedHeaderSession(): HeaderSessionUser | null | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const rawValue = window.sessionStorage.getItem(HEADER_SESSION_CACHE_KEY);
    if (!rawValue) return undefined;

    const entry = JSON.parse(rawValue) as Partial<HeaderSessionCacheEntry>;
    const savedAt = Number(entry.savedAt);

    if (!Number.isFinite(savedAt) || Date.now() - savedAt > HEADER_SESSION_CACHE_MAX_AGE_MS) {
      window.sessionStorage.removeItem(HEADER_SESSION_CACHE_KEY);
      return undefined;
    }

    if (entry.user === null) return null;

    const user = normalizeHeaderSessionUser(entry.user);
    if (!user) {
      window.sessionStorage.removeItem(HEADER_SESSION_CACHE_KEY);
      return undefined;
    }

    return user;
  } catch {
    return undefined;
  }
}

export function writeCachedHeaderSession(user: HeaderSessionUser | null): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      HEADER_SESSION_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        user,
      } satisfies HeaderSessionCacheEntry),
    );
  } catch {
    // The live session request remains the source of truth when storage is unavailable.
  }
}

export function clearCachedHeaderSession(): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(HEADER_SESSION_CACHE_KEY);
  } catch {
    // Ignore browsers that do not expose session storage.
  }
}

export async function refreshCachedHeaderSession(): Promise<HeaderSessionUser | null> {
  const response = await fetch('/api/me?scope=website', {
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to refresh the account header.');
  }

  const payload = (await response.json()) as HeaderSessionResponse;
  const user = payload?.signedIn ? normalizeHeaderSessionUser(payload.user) : null;

  writeCachedHeaderSession(user);
  return user;
}
