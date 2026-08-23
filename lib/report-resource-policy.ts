const BUILT_IN_RESOURCE_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const BUILT_IN_RESOURCE_SUFFIXES = ['.amazonaws.com', '.cloudfront.net'];

function normaliseHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/g, '');
}

function ipv4Octets(value: string): number[] | null {
  const parts = value.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((part) => part >= 0 && part <= 255) ? octets : null;
}

function mappedIpv4Octets(value: string): number[] | null {
  const mapped = value.match(/^(?:::ffff:|0:0:0:0:0:ffff:)(.+)$/i)?.[1];
  if (!mapped) return null;
  const dotted = ipv4Octets(mapped);
  if (dotted) return dotted;

  const groups = mapped.split(':');
  if (groups.length !== 2 || groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return null;
  const high = Number.parseInt(groups[0], 16);
  const low = Number.parseInt(groups[1], 16);
  return [high >>> 8, high & 0xff, low >>> 8, low & 0xff];
}

function isNonPublicIpv4(octets: number[]): boolean {
  const [first, second, third] = octets;
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 0 && third === 0)
    || (first === 192 && second === 0 && third === 2)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
    || (first === 198 && second === 51 && third === 100)
    || (first === 203 && second === 0 && third === 113)
    || first >= 224;
}

export function isPrivateReportResourceHostname(hostname: string): boolean {
  const value = normaliseHostname(hostname);
  if (
    value === 'localhost'
    || value === '0.0.0.0'
    || value === '::1'
    || value.endsWith('.local')
    || value.endsWith('.internal')
  ) return true;

  const ipv4 = ipv4Octets(value) ?? mappedIpv4Octets(value);
  if (ipv4) return isNonPublicIpv4(ipv4);

  return value === '::'
    || /^(?:fc|fd|fe8|fe9|fea|feb|fec|fed|fee|fef|ff)/i.test(value)
    || /^2001:db8(?::|$)/i.test(value);
}

function configuredResourceHosts(): Set<string> {
  return new Set(
    String(process.env.REPORT_PDF_RESOURCE_HOSTS ?? '')
      .split(',')
      .map((host) => normaliseHostname(host.trim().replace(/^\.+/, '')))
      .filter((host) => /^[a-z0-9.-]+$/.test(host) && !isPrivateReportResourceHostname(host)),
  );
}

export function normaliseReportBaseUrl(value: string | undefined): string {
  if (!value) return '';

  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || isPrivateReportResourceHostname(url.hostname)) return '';
    url.username = '';
    url.password = '';
    if (url.hostname.endsWith('.')) url.hostname = normaliseHostname(url.hostname);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * One lightweight policy shared by the HTML logo resolver and Chromium.
 * It keeps previews and attached PDFs aligned without allowing arbitrary
 * server-side network requests from report markup.
 */
export function isAllowedReportResourceUrl(value: string, baseUrl?: string): boolean {
  try {
    const safeBaseUrl = normaliseReportBaseUrl(baseUrl);
    const url = new URL(value, safeBaseUrl || undefined);
    if (url.protocol === 'data:' || url.protocol === 'blob:') return true;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    if (url.username || url.password || isPrivateReportResourceHostname(url.hostname)) return false;

    const baseOrigin = safeBaseUrl ? new URL(safeBaseUrl).origin : '';
    const sameOrigin = Boolean(baseOrigin) && url.origin === baseOrigin;
    const hostname = normaliseHostname(url.hostname);
    const explicitlyConfigured = configuredResourceHosts().has(hostname);
    const trustedStorage = BUILT_IN_RESOURCE_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
    const trustedFont = BUILT_IN_RESOURCE_HOSTS.has(hostname);
    return sameOrigin || explicitlyConfigured || trustedStorage || trustedFont;
  } catch {
    return false;
  }
}
