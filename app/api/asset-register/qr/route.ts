import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterItemById } from '../../../../lib/asset-register-db';

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function buildExternalQrImageUrl(scanUrl: string, size: number, format: 'svg' | 'png'): string {
  const url = new URL('https://api.qrserver.com/v1/create-qr-code/');
  url.searchParams.set('data', scanUrl);
  url.searchParams.set('size', `${size}x${size}`);
  url.searchParams.set('format', format);
  url.searchParams.set('margin', '18');
  return url.toString();
}

function buildQrFileName(assetTitle: string, plateLabel: string, extension: 'svg' | 'png'): string {
  return `${slugifyFileSegment(assetTitle)}-${slugifyFileSegment(plateLabel)}-qr.${extension}`;
}

function buildPrintHtml(options: {
  assetTitle: string;
  plateLabel: string;
  publicAssetCode: string;
  qrImageUrl: string;
}): string {
  const assetTitle = escapeHtml(options.assetTitle);
  const plateLabel = escapeHtml(options.plateLabel);
  const publicAssetCode = escapeHtml(options.publicAssetCode);
  const qrImageUrl = escapeHtml(options.qrImageUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${assetTitle} QR label</title>
    <style>
      :root {
        color-scheme: light;
        --brand-dark: #10382f;
        --brand-mid: #165340;
        --brand-soft: #edf6f1;
        --line: #d9e3eb;
        --text: #102f27;
        --muted: #617286;
        --page: #eef3f5;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        padding: 24px;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(22, 83, 64, 0.08), transparent 32%),
          var(--page);
        color: var(--text);
      }

      .shell {
        width: min(100%, 880px);
        margin: 0 auto;
        display: grid;
        gap: 18px;
      }

      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }

      .titleBlock {
        display: grid;
        gap: 5px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        min-height: 28px;
        padding: 0 12px;
        border-radius: 999px;
        color: #405b4f;
        background: rgba(237, 246, 241, 0.94);
        border: 1px solid rgba(205, 229, 216, 0.98);
        font-size: 12px;
        font-weight: 850;
        letter-spacing: 0.075em;
        text-transform: uppercase;
      }

      .titleBlock h1 {
        margin: 0;
        color: var(--text);
        font-size: clamp(30px, 4vw, 42px);
        line-height: 0.98;
        letter-spacing: -0.055em;
      }

      .titleBlock p {
        margin: 0;
        color: var(--muted);
        font-size: 16px;
        font-weight: 620;
        line-height: 1.5;
      }

      .toolbar button {
        min-height: 48px;
        padding: 0 20px;
        border-radius: 999px;
        border: 1px solid rgba(210, 222, 237, 0.98);
        background: linear-gradient(180deg, #ffffff 0%, #eef4fb 100%);
        color: #1d3b62;
        font: inherit;
        font-size: 15px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 12px 24px rgba(23, 45, 75, 0.07);
      }

      .previewArea {
        display: grid;
        justify-items: center;
        padding: 22px;
        border-radius: 32px;
        background: rgba(255, 255, 255, 0.82);
        border: 1px solid rgba(217, 227, 235, 0.96);
        box-shadow: 0 26px 70px rgba(16, 31, 28, 0.08);
      }

      .qrLabel {
        width: min(100%, 510px);
        min-height: 292px;
        display: grid;
        grid-template-columns: 190px minmax(0, 1fr);
        gap: 18px;
        align-items: stretch;
        padding: 18px;
        border-radius: 28px;
        border: 1px solid #cbd9d1;
        background:
          radial-gradient(circle at top left, rgba(22, 83, 64, 0.09), transparent 36%),
          linear-gradient(180deg, #ffffff 0%, #f6faf8 100%);
        box-shadow:
          0 16px 36px rgba(16, 31, 28, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.96);
      }

      .qrFrame {
        display: grid;
        place-items: center;
        min-width: 0;
        padding: 10px;
        border-radius: 22px;
        background: #ffffff;
        border: 1px solid #d9e4dc;
      }

      .qrFrame img {
        width: 100%;
        max-width: 160px;
        aspect-ratio: 1 / 1;
        object-fit: contain;
        display: block;
      }

      .labelCopy {
        min-width: 0;
        display: grid;
        align-content: center;
        gap: 12px;
      }

      .brandRow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .brandName {
        color: var(--brand-dark);
        font-size: 24px;
        font-weight: 900;
        line-height: 1;
        letter-spacing: -0.055em;
      }

      .labelPill {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        min-height: 28px;
        padding: 0 11px;
        border-radius: 999px;
        color: var(--brand-mid);
        background: var(--brand-soft);
        border: 1px solid rgba(205, 229, 216, 0.98);
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.075em;
        text-transform: uppercase;
      }

      .assetTitle {
        margin: 0;
        color: var(--text);
        font-size: 30px;
        line-height: 1.02;
        letter-spacing: -0.055em;
      }

      .plateBlock {
        display: grid;
        gap: 4px;
        padding: 12px 14px;
        border-radius: 18px;
        background: #ffffff;
        border: 1px solid #d9e4dc;
      }

      .plateBlock span,
      .helpText span {
        color: #718195;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.07em;
        text-transform: uppercase;
      }

      .plateBlock strong {
        color: var(--text);
        font-size: 23px;
        line-height: 1;
        letter-spacing: -0.035em;
      }

      .helpText {
        display: grid;
        gap: 4px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 650;
        line-height: 1.45;
      }

      .publicCode {
        margin-top: 2px;
        color: #7a8797;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 10px;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }

      @page {
        size: A4;
        margin: 12mm;
      }

      @media print {
        body {
          padding: 0;
          background: #ffffff;
        }

        .toolbar {
          display: none;
        }

        .shell {
          width: 100%;
          margin: 0;
        }

        .previewArea {
          display: block;
          padding: 0;
          border: none;
          box-shadow: none;
          background: #ffffff;
        }

        .qrLabel {
          width: 110mm;
          min-height: 68mm;
          padding: 5mm;
          gap: 5mm;
          border-radius: 8mm;
          box-shadow: none;
          break-inside: avoid;
        }

        .qrFrame {
          border-radius: 6mm;
          padding: 3mm;
        }

        .qrFrame img {
          max-width: 42mm;
        }

        .brandName {
          font-size: 18pt;
        }

        .assetTitle {
          font-size: 20pt;
        }

        .plateBlock {
          border-radius: 5mm;
          padding: 3mm 4mm;
        }

        .plateBlock strong {
          font-size: 17pt;
        }
      }

      @media (max-width: 640px) {
        body {
          padding: 12px;
        }

        .previewArea {
          padding: 12px;
          border-radius: 24px;
        }

        .qrLabel {
          grid-template-columns: 1fr;
          width: 100%;
        }

        .qrFrame img {
          max-width: 210px;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="toolbar">
        <div class="titleBlock">
          <span class="eyebrow">QR label</span>
          <h1>Aim4price QR label</h1>
          <p>Print this compact label and attach it to the asset.</p>
        </div>
        <button type="button" onclick="window.print()">Print QR label</button>
      </div>

      <main class="previewArea">
        <section class="qrLabel" aria-label="Printable Aim4price QR label">
          <div class="qrFrame">
            <img src="${qrImageUrl}" alt="QR code for ${assetTitle}" />
          </div>

          <div class="labelCopy">
            <div class="brandRow">
              <strong class="brandName">Aim4price</strong>
              <span class="labelPill">Asset QR</span>
            </div>

            <h2 class="assetTitle">${assetTitle}</h2>

            <div class="plateBlock">
              <span>Plate label</span>
              <strong>${plateLabel}</strong>
            </div>

            <div class="helpText">
              <span>Scan access</span>
              <div>Scan to update hours, fuel, notes and photos. Farm PIN required.</div>
              <div class="publicCode">${publicAssetCode}</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </body>
</html>`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const assetId = asText(request.nextUrl.searchParams.get('assetId'));
  const format = normalizeFormat(request.nextUrl.searchParams.get('format'));
  const shouldDownload = request.nextUrl.searchParams.get('download') === '1';

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  const asset = await getAssetRegisterItemById(session.user.id, assetId);

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
      const qrImageUrl = buildExternalQrImageUrl(scanUrl, 640, 'png');
      const qrResponse = await fetch(qrImageUrl, { cache: 'no-store' });

      if (!qrResponse.ok) {
        throw new Error(`QR render service returned ${qrResponse.status}.`);
      }

      const qrBuffer = Buffer.from(await qrResponse.arrayBuffer());
      const embeddedQrImageUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;

      return new NextResponse(
        buildPrintHtml({
          assetTitle: asset.title,
          plateLabel,
          publicAssetCode,
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
    const qrImageUrl = buildExternalQrImageUrl(scanUrl, format === 'png' ? 1200 : 840, format);
    const qrResponse = await fetch(qrImageUrl, { cache: 'no-store' });

    if (!qrResponse.ok) {
      throw new Error(`QR render service returned ${qrResponse.status}.`);
    }

    const body = await qrResponse.arrayBuffer();
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
