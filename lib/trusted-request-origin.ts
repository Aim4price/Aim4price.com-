function normalizeConfiguredOrigin(value: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}

/** Validate browser mutations against public origins, never proxy-supplied host headers. */
export function isTrustedRequestOrigin(origin: string | null, requestOrigin: string): boolean {
  if (!origin || origin === 'null') return false;
  const normalized = normalizeConfiguredOrigin(origin);
  // Origin must be a complete HTTP(S) origin, without paths or credentials.
  if (!normalized || normalized !== origin) return false;
  const trusted = [
    'https://aim4price.com',
    'https://www.aim4price.com',
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.BETTER_AUTH_URL,
    process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    process.env.RAILWAY_PUBLIC_DOMAIN,
  ].filter((value): value is string => Boolean(value))
    .flatMap(value => value.split(','))
    .map(value => normalizeConfiguredOrigin(value.trim()));
  if (process.env.NODE_ENV !== 'production') trusted.push(normalizeConfiguredOrigin(requestOrigin));
  return trusted.includes(normalized);
}
