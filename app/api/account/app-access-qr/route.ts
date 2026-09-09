import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AppQrKind = 'middleman' | 'dealer' | 'owner' | 'field';

const APP_INSTALL_PATHS: Record<AppQrKind, string> = {
  dealer: '/dealer/login?source=qr&install=1',
  middleman: '/middleman/login?source=qr&install=1',
  owner: '/owner-app/login?source=qr&install=1',
  field: '/field-manager/login?source=qr&install=1',
};

const QR_PROVIDER_ORIGIN = 'https://api.qrserver.com';
const MAX_QR_BYTES = 750_000;

function isAppQrKind(value: string): value is AppQrKind {
  return value === 'middleman' || value === 'dealer' || value === 'owner' || value === 'field';
}

function normalizeOriginCandidate(value?: string | null): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  try {
    const url = text.includes('://') ? new URL(text) : new URL(`https://${text}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isAim4priceHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'aim4price.com' || host.endsWith('.aim4price.com');
}

function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
}

function resolvePublicOrigin(request: NextRequest): string {
  const configuredOrigin =
    normalizeOriginCandidate(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeOriginCandidate(process.env.APP_URL) ||
    normalizeOriginCandidate(process.env.BETTER_AUTH_URL) ||
    normalizeOriginCandidate(
      process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '',
    );

  if (configuredOrigin) return configuredOrigin;

  if (isAim4priceHost(request.nextUrl.hostname) || isLocalHost(request.nextUrl.hostname)) {
    return request.nextUrl.origin;
  }

  return 'https://www.aim4price.com';
}

function buildQrProviderUrl(target: string): string {
  const url = new URL('/v1/create-qr-code/', QR_PROVIDER_ORIGIN);
  url.searchParams.set('data', target);
  url.searchParams.set('size', '520x520');
  url.searchParams.set('format', 'png');
  url.searchParams.set('margin', '22');
  url.searchParams.set('ecc', 'M');
  return url.toString();
}

export async function GET(request: NextRequest) {
  const app = String(request.nextUrl.searchParams.get('app') ?? '').trim().toLowerCase();

  if (!isAppQrKind(app)) {
    return NextResponse.json(
      { ok: false, error: 'A valid app is required.' },
      { status: 400 },
    );
  }

  const target = new URL(APP_INSTALL_PATHS[app], resolvePublicOrigin(request)).toString();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 8_000);

  try {
    const response = await fetch(buildQrProviderUrl(target), {
      cache: 'no-store',
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`QR render service returned ${response.status}.`);
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (contentType !== 'image/png' || declaredLength > MAX_QR_BYTES) {
      throw new Error('QR render service returned an invalid image.');
    }

    const image = await response.arrayBuffer();
    if (!image.byteLength || image.byteLength > MAX_QR_BYTES) {
      throw new Error('QR render service returned an invalid image size.');
    }

    return new NextResponse(image, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'Content-Disposition': `inline; filename="aim4price-${app}-app-qr.png"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('app access QR render failed', error);
    return NextResponse.json(
      { ok: false, error: 'The app QR code is temporarily unavailable. Use the login link instead.' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}


