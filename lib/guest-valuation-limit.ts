const GUEST_VALUATION_COUNT_KEY = 'aim4price-guest-valuation-count';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getGuestValuationCount(): number {
  if (!canUseStorage()) return 0;

  const raw = Number(window.localStorage.getItem(GUEST_VALUATION_COUNT_KEY) ?? '0');
  if (!Number.isFinite(raw) || raw < 0) return 0;

  return Math.floor(raw);
}

export function incrementGuestValuationCount(): number {
  const next = getGuestValuationCount() + 1;

  if (canUseStorage()) {
    window.localStorage.setItem(GUEST_VALUATION_COUNT_KEY, String(next));
  }

  return next;
}

export function clearGuestValuationCount(): void {
  if (canUseStorage()) {
    window.localStorage.removeItem(GUEST_VALUATION_COUNT_KEY);
  }
}
