export type AppRealm = 'dealer' | 'middleman' | 'owner' | 'field';

export function appRealmForPath(path: string): AppRealm | null {
  const roots = { dealer: '/dealer', middleman: '/middleman', owner: '/owner-app', field: '/field-manager' } as const;
  for (const realm of Object.keys(roots) as AppRealm[]) {
    if (path === roots[realm] || path.startsWith(`${roots[realm]}/`)) return realm;
  }
  return null;
}

export function requestAppRealm(url: URL, referer: string | null, clientRealm?: string | null): AppRealm | null {
  const authApi = url.pathname.match(/^\/api\/(dealer|middleman|owner-app|field-manager)\/(login|logout|session|ad-studio\/brand-kits)$/);
  if (authApi) return appRealmForPath(`/${authApi[1]}`);
  const direct = appRealmForPath(url.pathname);
  if (direct) return direct;
  if (url.pathname.startsWith('/api/') && clientRealm) {
    // This selects a credential; it never grants permission without that app's signed cookie.
    return ['dealer', 'middleman', 'owner', 'field'].includes(clientRealm) ? clientRealm as AppRealm : null;
  }
  if (!url.pathname.startsWith('/api/') || !referer) return null;
  try {
    const source = new URL(referer);
    return source.origin === url.origin ? appRealmForPath(source.pathname) : null;
  } catch { return null; }
}
