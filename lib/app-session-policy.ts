// Browsers cap persistent cookies; renew this retention window whenever the app opens.
export const APP_SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

// Only newly signed persistent sessions have no application-imposed timeout.
// Legacy tokens retain their original expiry and must never be resurrected.
export function isAppSessionCurrent(expiresAtMs: number, persistent: unknown): boolean {
  return Number.isFinite(expiresAtMs)
    && (persistent === true || expiresAtMs > Date.now());
}
