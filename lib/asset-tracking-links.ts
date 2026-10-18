export const TRACKER_INSTALL_URL = 'https://www.aim4price.com/downloads/aim4price-tracker-0.4.apk';
export function normalizeTrackerCode(value: string): string | null {
  const code = value.trim().replace(/-/g, '').toUpperCase();
  return /^[A-F0-9]{16}$/.test(code) ? code : null;
}
/** The fragment keeps this short-lived credential out of HTTP requests and referrers. */
export function trackerPairingUrl(code: string): string | null {
  const valid = normalizeTrackerCode(code);
  return valid ? `https://www.aim4price.com/tracker/pair#${valid}` : null;
}
export function trackerPairingIntent(code: string): string | null {
  const valid = normalizeTrackerCode(code);
  return valid ? `intent://pair?code=${valid}#Intent;scheme=aim4price-tracker;package=com.aim4price.tracker.pilot;end` : null;
}
