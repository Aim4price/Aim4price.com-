import type { AppRealm } from './app-realm';

const APP_COOKIES: Record<AppRealm, readonly string[]> = {
  dealer: ['aim4price_dealer_app_v2', 'aim4price_dealer_app'],
  middleman: ['aim4price_middleman_app_v1'],
  owner: ['aim4price_owner_app'],
  field: ['aim4price_field_manager', 'aim4price_field_manager_scan', 'aim4price_field_manager_fuel_scan'],
};
const ALL_APP_COOKIES = new Set(Object.values(APP_COOKIES).flat());

export function hasAppCookies(cookie: string): boolean {
  return cookie.split(';').some(part => ALL_APP_COOKIES.has(part.trim().split('=')[0]));
}

export function isolateAppCookies(cookie: string, realm: AppRealm | null): string {
  const allowed = new Set(realm ? APP_COOKIES[realm] : []);
  return cookie.split(';').map(part => part.trim()).filter(part => {
    const name = part.slice(0, part.indexOf('='));
    if (ALL_APP_COOKIES.has(name)) return allowed.has(name);
    if (name.includes('better-auth.') || name === 'aim4price_admin_support_user_id') return false;
    return Boolean(part);
  }).join('; ');
}
