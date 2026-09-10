export const PUSH_APPS = {
  owner: { root: '/owner-app', name: 'Aim4price Owner', icon: '/owner-app-icon-192.png', worker: '/owner-app-sw.js' },
  dealer: { root: '/dealer', name: 'Aim4price Dealer', icon: '/dealer-icon-192-dark.png', worker: '/dealer-sw.js' },
  middleman: { root: '/middleman', name: 'Aim4price Middleman', icon: '/middleman-icon-192.png', worker: '/middleman-sw.js' },
} as const;
export type PushApp = keyof typeof PUSH_APPS;
export const PUSH_CATEGORIES = {
  maintenance: 'Maintenance', licensing: 'License renewals', enquiries: 'Enquiries & leads',
  approvals: 'Approvals needed', assignments: 'Assigned work', costs: 'Cost warnings', listings: 'Matching listings',
} as const;
export type PushCategory = keyof typeof PUSH_CATEGORIES;
export type PushPreferences = Record<PushCategory, boolean>;
export const DEFAULT_PUSH_PREFERENCES: PushPreferences = { maintenance: true, licensing: true, enquiries: true, approvals: true, assignments: true, costs: true, listings: true };
export function parsePushPreferences(value: unknown): PushPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Choose your notifications.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !(key in DEFAULT_PUSH_PREFERENCES))) throw new Error('Unknown notification setting.');
  const result = { ...DEFAULT_PUSH_PREFERENCES };
  for (const key of Object.keys(result) as PushCategory[]) {
    if (!(key in input) && (key === 'costs' || key === 'listings')) continue;
    if (typeof input[key] !== 'boolean') throw new Error('Choose your notifications.');
    result[key] = input[key] as boolean;
  }
  return result;
}
export type BrowserPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
export function validatePushSubscription(value: unknown): BrowserPushSubscription {
  const sub = value as BrowserPushSubscription | null;
  if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length > 2048) throw new Error('Invalid phone subscription.');
  const url = new URL(sub.endpoint);
  // Only browser push services. Never allow user-controlled arbitrary server fetches.
  const allowed = url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com'
    || url.hostname.endsWith('.push.apple.com') || url.hostname === 'web.push.apple.com'
    || url.hostname.endsWith('.notify.windows.com');
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || !allowed) throw new Error('Unsupported phone subscription.');
  const key = sub.keys?.p256dh, auth = sub.keys?.auth;
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(key)
    || typeof auth !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(auth)) throw new Error('Invalid phone keys.');
  return { endpoint: url.href, keys: { p256dh: key, auth } };
}
export function safePushHref(app: PushApp, href: string): string {
  const root = PUSH_APPS[app].root;
  try {
    const url = new URL(href, 'https://www.aim4price.com');
    if (url.origin === 'https://www.aim4price.com' && (url.pathname === root || url.pathname.startsWith(root + '/')))
      return url.pathname + url.search + url.hash;
  } catch { /* Fall back to this app's inbox. */ }
  return root + '/notifications';
}

export type AccountPushPreferences = { enabled: boolean; preferences: PushPreferences };
export function combinePushPreferences(member: PushPreferences, account: AccountPushPreferences): PushPreferences {
  const result = {...member};
  for (const key of Object.keys(result) as PushCategory[]) result[key] = account.enabled && account.preferences[key] && member[key];
  return result;
}

