const GUEST_VALUATION_COUNT_KEY = 'aim4price-guest-valuation-count';
const GUEST_MARKETPLACE_UPLOAD_COUNT_KEY = 'aim4price-guest-marketplace-upload-count';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getStoredCount(key: string): number {
  if (!canUseStorage()) return 0;

  const raw = Number(window.localStorage.getItem(key) ?? '0');
  if (!Number.isFinite(raw) || raw < 0) return 0;

  return Math.floor(raw);
}

function incrementStoredCount(key: string): number {
  const next = getStoredCount(key) + 1;

  if (canUseStorage()) {
    window.localStorage.setItem(key, String(next));
  }

  return next;
}

function clearStoredCount(key: string): void {
  if (canUseStorage()) {
    window.localStorage.removeItem(key);
  }
}

export function getGuestValuationCount(): number {
  return getStoredCount(GUEST_VALUATION_COUNT_KEY);
}

export function incrementGuestValuationCount(): number {
  return incrementStoredCount(GUEST_VALUATION_COUNT_KEY);
}

export function clearGuestValuationCount(): void {
  clearStoredCount(GUEST_VALUATION_COUNT_KEY);
}

export function getGuestMarketplaceUploadCount(): number {
  return getStoredCount(GUEST_MARKETPLACE_UPLOAD_COUNT_KEY);
}

export function incrementGuestMarketplaceUploadCount(): number {
  return incrementStoredCount(GUEST_MARKETPLACE_UPLOAD_COUNT_KEY);
}

export function clearGuestMarketplaceUploadCount(): void {
  clearStoredCount(GUEST_MARKETPLACE_UPLOAD_COUNT_KEY);
}
