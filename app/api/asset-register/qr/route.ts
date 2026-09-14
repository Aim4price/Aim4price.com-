import { renderQrImage } from '../../../../lib/qr-image';
import { buildAssetQrLabelHtml } from '../../../../lib/asset-qr-label-print';
import { getFallbackReportLogoUrl, resolveReportLogoUrlForHtml } from '../../../../lib/report-logo';
import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterItemById } from '../../../../lib/asset-register-db';
import { getAssetLeadForPartner } from '../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type QrFormat = 'svg' | 'png' | 'print';

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
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

  return normalized || 'asset';
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

function buildScanUrl(origin: string, publicAssetCode: string): string {
  return new URL(`/scan/${encodeURIComponent(publicAssetCode)}`, origin).toString();
}

function buildQrFileName(assetTitle: string, plateLabel: string, extension: 'svg' | 'png'): string {
  return `${slugifyFileSegment(assetTitle)}-${slugifyFileSegment(plateLabel)}-qr.${extension}`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const assetId = asText(request.nextUrl.searchParams.get('assetId'));
  const leadId = asText(request.nextUrl.searchParams.get('leadId'));
  const format = normalizeFormat(request.nextUrl.searchParams.get('format'));
  const shouldDownload = request.nextUrl.searchParams.get('download') === '1';

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  let assetOwnerUserId = session.user.id;

  if (!leadId && !await getAssetRegisterAccountAccess(session)) {
    return NextResponse.json({ ok: false, error: 'You do not have permission to use this Asset Register.' }, { status: 403 });
  }

  if (leadId) {
    const profile = await getAccountProfile({ id: session.user.id });
    if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
      return NextResponse.json({ ok: false, error: 'Dealer access is not available.' }, { status: 403 });
    }

    const lead = await getAssetLeadForPartner({
      dealerUserId: session.user.id,
      leadId,
    });

    if (!lead || lead.assetRegisterItemId !== assetId) {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    assetOwnerUserId = lead.ownerUserId;
  }

  const asset = await getAssetRegisterItemById(assetOwnerUserId, assetId);

  if (!asset) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }

  const publicAssetCode = asText(asset.publicAssetCode);
  const plateLabel = asText(asset.plateLabel) || publicAssetCode;

  if (!publicAssetCode) {
    return NextResponse.json({ ok: false, error: 'This asset does not have a QR code yet.' }, { status: 409 });
  }

  const scanOrigin = resolvePublicOrigin(request);
  const scanUrl = buildScanUrl(scanOrigin, publicAssetCode);

  if (format === 'print') {
    try {
      const qrBuffer = Buffer.from(await renderQrImage(scanUrl, 'png', 640));
      const embeddedQrImageUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;

      // Brand the asset owner's label, including when a dealer opens a shared lead.
      const ownerProfile = await getAccountProfile({ id: assetOwnerUserId }).catch(() => null);
      const [logoUrl, fallbackLogoUrl] = await Promise.all([
        resolveReportLogoUrlForHtml(ownerProfile?.logoUrl, request.url),
        getFallbackReportLogoUrl(request.url),
      ]);

      return new NextResponse(
        buildAssetQrLabelHtml({
          assetTitle: asset.title,
          serialNumber: asText(asset.serialNumber),
          yearModel: asset.yearModel,
          modelName: asText(asset.modelName) || asText(asset.typedModelName),
          logoUrl,
          fallbackLogoUrl,
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
      console.error('asset QR print render failed', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to render the asset QR label right now.' },
        { status: 502 },
      );
    }
  }

  try {
    const body = await renderQrImage(scanUrl, format, format === 'png' ? 1200 : 840);
    const fileName = buildQrFileName(asset.title, plateLabel, format);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': format === 'png' ? 'image/png' : 'image/svg+xml; charset=utf-8',
        'cache-control': 'no-store',
        'content-disposition': `${shouldDownload ? 'attachment' : 'inline'}; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('asset QR render failed', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to render the asset QR code right now.' },
      { status: 502 },
    );
  }
}
