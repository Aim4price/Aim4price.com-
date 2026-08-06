import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Dealer App sessions are role-bound and use a rolling 30-day cookie', () => {
  const session = read('lib/dealer-app-session.ts');
  const login = read('app/api/dealer/login/route.ts');

  assert.match(session, /DEALER_APP_COOKIE = 'aim4price_dealer_app_v2'/);
  assert.match(session, /DEALER_APP_MAX_AGE = 60 \* 60 \* 24 \* 30/);
  assert.match(session, /role\?: DealerStaffRole/);
  assert.match(session, /payload\.role && payload\.role !== role/);
  assert.match(session, /Dealer App session secret is not configured/);
  assert.match(login, /role: normalizeDealerStaffRole\(row!\.staff_role\)/);
  assert.match(login, /if \(await getDealerAppSession\(\)\)/);
});

test('Dealer App sessions are shared safely across the Aim4price hostnames', () => {
  const session = read('lib/dealer-app-session.ts');
  const logout = read('app/api/dealer/logout/route.ts');

  assert.match(session, /hostname === 'aim4price\.com'/);
  assert.match(session, /hostname === 'www\.aim4price\.com'/);
  assert.match(session, /\? '\.aim4price\.com'/);
  assert.match(session, /DEALER_APP_LEGACY_COOKIE/);
  assert.match(logout, /dealerAppCookieOptions\(request\.url, 0\)/);
  assert.match(logout, /DEALER_APP_LEGACY_COOKIE/);
});

test('Active Dealer App sessions renew without redirecting on temporary failures', () => {
  const route = read('app/api/dealer/session/route.ts');
  const keeper = read('app/dealer/dealer-session-keeper.tsx');
  const layout = read('app/dealer/layout.tsx');

  assert.match(route, /export async function POST\(request: NextRequest\)/);
  assert.match(route, /createDealerAppToken\(/);
  assert.match(route, /dealerAppCookieOptions\(request\.url\)/);
  assert.match(keeper, /REFRESH_INTERVAL_MS = 6 \* 60 \* 60 \* 1000/);
  assert.match(keeper, /method: 'POST'/);
  assert.match(keeper, /temporary network failure must never sign the user out/);
  assert.doesNotMatch(keeper, /location\.(assign|replace)|router\.push/);
  assert.match(layout, /<DealerSessionKeeper \/>/);
});
