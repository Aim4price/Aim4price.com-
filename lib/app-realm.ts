export type AppRealm = 'dealer' | 'middleman';

export function appRealmForPath(path: string): AppRealm | null {
  for (const realm of ['dealer', 'middleman'] as const) {
    if (path === `/${realm}` || path.startsWith(`/${realm}/`)) return realm;
  }
  return null;
}

export function requestAppRealm(url: URL, referer: string | null): AppRealm | null {
  const authApi = url.pathname.match(/^\/api\/(dealer|middleman)\/(login|logout|session)$/);
  if (authApi) return authApi[1] as AppRealm;
  const direct = appRealmForPath(url.pathname);
  if (direct) return direct;
  if (!url.pathname.startsWith('/api/') || !referer) return null;
  try {
    const source = new URL(referer);
    return source.origin === url.origin ? appRealmForPath(source.pathname) : null;
  } catch { return null; }
}
