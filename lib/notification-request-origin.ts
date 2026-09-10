/** Exact public origins, independent of the internal URL used by a reverse proxy. */
export function isTrustedNotificationRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  const trusted = new Set(['https://aim4price.com', 'https://www.aim4price.com']);
  for (const raw of [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_SITE_URL, process.env.RAILWAY_PUBLIC_DOMAIN, process.env.BETTER_AUTH_TRUSTED_ORIGINS]) {
    for (const entry of (raw || '').split(',')) {
      const value = entry.trim();
      if (!value || value.includes('*')) continue;
      try {
        const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        if (url.protocol === 'https:' && !url.username && !url.password) trusted.add(url.origin);
      } catch { /* Invalid configuration cannot grant access. */ }
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    const target = new URL(request.url);
    if (['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) trusted.add(target.origin);
  }
  // Never trust Origin, Host or forwarded headers as configuration.
  return trusted.has(origin);
}
