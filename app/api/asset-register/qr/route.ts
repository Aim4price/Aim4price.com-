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
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&display=swap');

      :root {
        color-scheme: light;
        --page: #edf3f5;
        --surface: #ffffff;
        --surface-soft: #f7faf9;
        --line: #d8e4dd;
        --line-strong: #c8d8cf;
        --text: #0f3329;
        --muted: #5f7084;
        --muted-soft: #7a8b9d;
        --brand-dark: #10382f;
        --brand-mid: #165340;
        --blue-text: #1d3b62;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        min-height: 100%;
      }

      body {
        margin: 0;
        padding: 28px;
        font-family: "Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(22, 83, 64, 0.08), transparent 34%),
          linear-gradient(180deg, #f4f7f8 0%, var(--page) 100%);
        color: var(--text);
      }

      .shell {
        width: min(100%, 940px);
        margin: 0 auto;
        display: grid;
        gap: 20px;
      }

      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        flex-wrap: wrap;
      }

      .titleBlock {
        display: grid;
        gap: 6px;
        min-width: 0;
      }

      .titleBlock h1 {
        margin: 0;
        color: var(--text);
        font-size: clamp(30px, 4vw, 42px);
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.055em;
      }

      .titleBlock p {
        margin: 0;
        color: var(--muted);
        font-size: 15px;
        font-weight: 600;
        line-height: 1.48;
      }

      .toolbar button {
        min-height: 48px;
        padding: 0 20px;
        border: 1px solid rgba(210, 222, 237, 0.98);
        border-radius: 999px;
        background: linear-gradient(180deg, #ffffff 0%, #eef4fb 100%);
        color: var(--blue-text);
        font: inherit;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 12px 24px rgba(23, 45, 75, 0.07);
      }

      .previewArea {
        display: grid;
        justify-items: center;
        padding: 26px;
        border: 1px solid rgba(217, 227, 235, 0.96);
        border-radius: 32px;
        background: rgba(255, 255, 255, 0.82);
        box-shadow: 0 26px 70px rgba(16, 31, 28, 0.08);
      }

      .qrLabel {
        width: min(100%, 680px);
        display: grid;
        grid-template-columns: 210px minmax(0, 1fr);
        gap: 22px;
        align-items: stretch;
        padding: 20px;
        border: 1px solid var(--line-strong);
        border-radius: 30px;
        background:
          radial-gradient(circle at top left, rgba(22, 83, 64, 0.08), transparent 34%),
          linear-gradient(180deg, #ffffff 0%, #f7fbf9 100%);
        box-shadow:
          0 18px 38px rgba(16, 31, 28, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.96);
      }

      .qrFrame {
        display: grid;
        place-items: center;
        min-width: 0;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: #ffffff;
      }

      .qrFrame img {
        display: block;
        width: 100%;
        max-width: 176px;
        aspect-ratio: 1 / 1;
        object-fit: contain;
      }

      .labelCopy {
        min-width: 0;
        display: grid;
        align-content: center;
        gap: 14px;
        padding: 2px 0;
      }

      .brandName {
        color: var(--brand-dark);
        font-size: 25px;
        font-weight: 900;
        line-height: 1;
        letter-spacing: -0.06em;
      }

      .assetTitle {
        margin: 0;
        color: var(--text);
        font-size: clamp(27px, 4vw, 38px);
        font-weight: 800;
        line-height: 1.02;
        letter-spacing: -0.065em;
      }

      .plateBlock {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
        padding: 13px 16px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: #ffffff;
      }

      .plateBlock span,
      .helpText span {
        color: var(--muted-soft);
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.075em;
        text-transform: uppercase;
      }

      .plateBlock strong {
        color: var(--text);
        font-size: 24px;
        font-weight: 900;
        line-height: 1;
        letter-spacing: -0.035em;
        white-space: nowrap;
      }

      .helpText {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 650;
        line-height: 1.45;
      }

      .publicCode {
        margin-top: 1px;
        color: #7a8797;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 9px;
        font-weight: 700;
        line-height: 1.3;
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
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
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
          width: 132mm;
          min-height: 72mm;
          grid-template-columns: 48mm minmax(0, 1fr);
          gap: 6mm;
          padding: 5mm;
          border-radius: 8mm;
          box-shadow: none;
          break-inside: avoid;
        }

        .qrFrame {
          padding: 3mm;
          border-radius: 6mm;
        }

        .qrFrame img {
          max-width: 40mm;
        }

        .brandName {
          font-size: 17pt;
        }

        .assetTitle {
          font-size: 21pt;
        }

        .plateBlock {
          border-radius: 5mm;
          padding: 3mm 4mm;
        }

        .plateBlock strong {
          font-size: 17pt;
        }
      }

      @media (max-width: 680px) {
        body {
          padding: 12px;
        }

        .previewArea {
          padding: 12px;
          border-radius: 24px;
        }

        .qrLabel {
          width: 100%;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .qrFrame img {
          max-width: 230px;
        }

        .plateBlock {
          grid-template-columns: 1fr;
          align-items: start;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="toolbar">
        <div class="titleBlock">
          <h1>Aim4price QR label</h1>
          <p>Print this permanent operational QR label and attach it to the asset.</p>
        </div>
        <button type="button" onclick="window.print()">Print QR label</button>
      </div>

      <main class="previewArea">
        <section class="qrLabel" aria-label="Printable Aim4price QR label">
          <div class="qrFrame">
            <img src="${qrImageUrl}" alt="QR code for ${assetTitle}" />
          </div>

          <div class="labelCopy">
            <strong class="brandName">Aim4price</strong>

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
