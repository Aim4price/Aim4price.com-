import { buildAssetQrLabelHtml } from '../../../../../../lib/asset-qr-label-print';
import { getAccountProfile } from '../../../../../../lib/account-profile';
import { getFallbackReportLogoUrl, resolveReportLogoUrlForHtml } from '../../../../../../lib/report-logo';
import { renderQrImage } from '../../../../../../lib/qr-image';
import { NextRequest, NextResponse } from 'next/server';
import { getFuelStorageById } from '../../../../../../lib/fuel-ledger';
import { resolveOwnerWorkspaceContext } from '../../../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    storageId: string;
  };
};

type QrFormat = 'svg' | 'png' | 'print';

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeFormat(value: string | null): QrFormat {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'print') return 'print';
  if (normalized === 'png' || normalized === 'image' || normalized === 'jpg' || normalized === 'jpeg') return 'png';

  return 'svg';
}

function slugifyFileSegment(value: string): string {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'fuel-storage';
}

function normalizeOriginCandidate(value?: string | null): string | null {
  const text = asText(value);

  if (!text) {
    return null;
  }

  try {
    const url = text.includes('://') ? new URL(text) : new URL(`https://${text}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function isInternalRuntimeHost(value?: string | null): boolean {
  const text = asText(value).toLowerCase();

  return (
    text === '0.0.0.0:8080' ||
    text === '0.0.0.0' ||
    text === '127.0.0.1:8080' ||
    text === '127.0.0.1' ||
    text === 'localhost:8080'
  );
}

function isLocalHost(value?: string | null): boolean {
  const text = asText(value).toLowerCase();
  return text.startsWith('localhost') || text.startsWith('127.0.0.1') || text.startsWith('0.0.0.0');
}

function resolvePublicOrigin(request: NextRequest): string {
  const forwardedHost = asText(request.headers.get('x-forwarded-host')).split(',')[0]?.trim() ?? '';
  const forwardedProto = asText(request.headers.get('x-forwarded-proto')).split(',')[0]?.trim() ?? '';

  if (forwardedHost && !isInternalRuntimeHost(forwardedHost)) {
    const forwardedOrigin = normalizeOriginCandidate(`${forwardedProto || 'https'}://${forwardedHost}`);

    if (forwardedOrigin) {
      return forwardedOrigin;
    }
  }

  const envOrigin =
    normalizeOriginCandidate(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeOriginCandidate(process.env.APP_URL) ||
    normalizeOriginCandidate(process.env.BETTER_AUTH_URL) ||
    normalizeOriginCandidate(
      process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '',
    );

  if (envOrigin) {
    return envOrigin;
  }

  const host = asText(request.headers.get('host')).split(',')[0]?.trim() ?? '';

  if (host && !isInternalRuntimeHost(host)) {
    const scheme = forwardedProto || (isLocalHost(host) ? 'http' : 'https');
    const hostOrigin = normalizeOriginCandidate(`${scheme}://${host}`);

    if (hostOrigin) {
      return hostOrigin;
    }
  }

  const requestOrigin = normalizeOriginCandidate(request.nextUrl.origin);

  if (requestOrigin) {
    try {
      const requestHost = new URL(requestOrigin).host;

      if (!isInternalRuntimeHost(requestHost)) {
        return requestOrigin;
      }
    } catch {
      // ignore and fall through to the hard fallback
    }
  }

  return 'https://aim4pricecom-production.up.railway.app';
}

function buildFuelScanUrl(origin: string, publicFuelStorageCode: string): string {
  return new URL(`/fuel-scan/${encodeURIComponent(publicFuelStorageCode)}`, origin).toString();
}

function buildQrFileName(storageName: string, publicFuelStorageCode: string, extension: 'svg' | 'png'): string {
  return `${slugifyFileSegment(storageName)}-${slugifyFileSegment(publicFuelStorageCode)}-fuel-qr.${extension}`;
}

function formatLitres(value: number | null): string {
  if (value === null) return 'Not set';
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} L`;
}

function formatFuelTypeForLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'adblue') return 'AdBlue';
  if (!normalized) return 'Fuel';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildFuelLabelCode(publicFuelStorageCode: string): string {
  const normalized = publicFuelStorageCode.trim().toUpperCase().replace(/^FUEL-/, '');
  const shortCode = normalized.slice(0, 6) || 'STOCK';
  return `FUEL-${shortCode}`;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;

  const storage = await getFuelStorageById(resolved.context.ownerUserId, context.params.storageId);

  if (!storage) {
    return NextResponse.json({ ok: false, error: 'Fuel storage not found.' }, { status: 404 });
  }

  const format = normalizeFormat(request.nextUrl.searchParams.get('format'));
  const shouldDownload = request.nextUrl.searchParams.get('download') === '1';
  const scanOrigin = resolvePublicOrigin(request);
  const scanUrl = buildFuelScanUrl(scanOrigin, storage.publicFuelStorageCode);

  if (format === 'print') {
    try {
      const qrBuffer = Buffer.from(await renderQrImage(scanUrl, 'png', 640));
      const embeddedQrImageUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;

      const ownerProfile = await getAccountProfile({ id: resolved.context.ownerUserId }).catch(() => null);
      const [logoUrl, fallbackLogoUrl] = await Promise.all([
        resolveReportLogoUrlForHtml(ownerProfile?.logoUrl, request.url),
        getFallbackReportLogoUrl(request.url),
      ]);
      return new NextResponse(
        buildAssetQrLabelHtml({
          labelKind: 'fuel',
          assetTitle: storage.name,
          accountName: asText(ownerProfile?.businessName) || asText(ownerProfile?.displayName) || asText(ownerProfile?.name),
          logoUrl,
          fallbackLogoUrl,
          fuelDetails: { fuelType: formatFuelTypeForLabel(storage.fuelType), capacity: formatLitres(storage.capacityLitres), tankCode: buildFuelLabelCode(storage.publicFuelStorageCode) },
          qrImageUrl: embeddedQrImageUrl,
        }),
        {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
          },
        },
      );
    } catch (error) {
      console.error('fuel QR print render failed', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to render the fuel QR label right now.' },
        { status: 502 },
      );
    }
  }

  try {
    const body = await renderQrImage(scanUrl, format, format === 'png' ? 1200 : 840);
    const fileName = buildQrFileName(storage.name, storage.publicFuelStorageCode, format);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': format === 'png' ? 'image/png' : 'image/svg+xml; charset=utf-8',
        'cache-control': 'no-store',
        'content-disposition': `${shouldDownload ? 'attachment' : 'inline'}; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('fuel QR render failed', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to render the fuel QR code right now.' },
      { status: 502 },
    );
  }
}
