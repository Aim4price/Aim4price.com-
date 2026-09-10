import { renderQrImage } from '../../../../lib/qr-image';
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
      @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&display=swap");

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
        font-family: Montserrat, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
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
        position: sticky;
        top: 0;
        z-index: 5;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px 16px;
        padding: 12px 14px;
        border: 1px solid rgba(217, 227, 235, 0.92);
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 16px 36px rgba(16, 31, 28, 0.08);
        backdrop-filter: blur(12px);
      }

      .titleBlock {
        display: grid;
        gap: 5px;
      }

      .titleBlock h1 {
        margin: 0;
        color: var(--brand-dark);
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
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        min-width: 162px;
        padding: 0 20px;
        border-radius: 999px;
        border: 1px solid var(--brand-dark);
        background: var(--brand-dark);
        color: #ffffff;
        font: inherit;
        font-size: 14px;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
        cursor: pointer;
        box-shadow: 0 14px 26px rgba(16, 56, 47, 0.18);
      }

      .toolbar button:focus-visible {
        outline: 3px solid rgba(16, 56, 47, 0.18);
        outline-offset: 2px;
      }

      .previewArea {
        display: grid;
        justify-items: center;
        padding: 24px;
        border-radius: 32px;
        background: rgba(255, 255, 255, 0.82);
        border: 1px solid rgba(217, 227, 235, 0.96);
        box-shadow: 0 26px 70px rgba(16, 31, 28, 0.08);
      }

      .qrLabel {
        width: min(100%, 560px);
        min-height: 262px;
        display: grid;
        grid-template-columns: 184px minmax(0, 1fr);
        gap: 18px;
        align-items: stretch;
        padding: 16px;
        border-radius: 26px;
        border: 1px solid #cbd9d1;
        background:
          radial-gradient(circle at top left, rgba(22, 83, 64, 0.075), transparent 34%),
          linear-gradient(180deg, #ffffff 0%, #f7faf8 100%);
        box-shadow:
          0 16px 36px rgba(16, 31, 28, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.96);
      }

      .qrFrame {
        display: grid;
        place-items: center;
        min-width: 0;
        padding: 11px;
        border-radius: 22px;
        background: #ffffff;
        border: 1px solid #d9e4dc;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.96);
      }

      .qrFrame img {
        width: 100%;
        max-width: 154px;
        aspect-ratio: 1 / 1;
        object-fit: contain;
        display: block;
      }

      .labelCopy {
        min-width: 0;
        display: grid;
        align-content: center;
        gap: 11px;
      }


      .assetTitle {
        margin: 0;
        color: var(--brand-dark);
        font-size: 33px;
        font-weight: 900;
        line-height: 1;
        letter-spacing: -0.06em;
      }

      .plateBlock {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 17px;
        background: #ffffff;
        border: 1px solid #d5e2da;
      }

      .plateBlock span,
      .helpText span {
        color: #718195;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.075em;
        text-transform: uppercase;
      }

      .plateBlock strong {
        min-width: 0;
        color: var(--brand-dark);
        font-size: 22px;
        font-weight: 900;
        line-height: 1;
        letter-spacing: -0.035em;
        text-align: right;
      }

      .helpText {
        display: grid;
        gap: 4px;
        padding-top: 2px;
        color: var(--muted);
        font-size: 12.5px;
        font-weight: 700;
        line-height: 1.42;
      }

      .publicCode {
        margin-top: 2px;
        color: #8794a3;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 8.5px;
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
          width: 118mm;
          min-height: 64mm;
          grid-template-columns: 42mm minmax(0, 1fr);
          padding: 4mm;
          gap: 4mm;
          border-radius: 7mm;
          box-shadow: none;
          break-inside: avoid;
        }

        .qrFrame {
          border-radius: 5.5mm;
          padding: 2.5mm;
        }

        .qrFrame img {
          max-width: 35mm;
        }


        .assetTitle {
          font-size: 19pt;
        }

        .plateBlock {
          border-radius: 4.5mm;
          padding: 3mm 3.5mm;
        }

        .plateBlock span,
        .helpText span {
          font-size: 7pt;
        }

        .plateBlock strong {
          font-size: 15pt;
        }

        .helpText {
          font-size: 8.4pt;
        }

        .publicCode {
          font-size: 5.8pt;
        }
      }

      @media (max-width: 640px) {
        body {
          padding: 12px;
        }

        .toolbar {
          grid-template-columns: 1fr;
          border-radius: 20px;
          padding: 10px 12px 12px;
        }

        .titleBlock h1 {
          font-size: clamp(26px, 9vw, 34px);
        }

        .titleBlock p {
          font-size: 13px;
        }

        .toolbar button {
          width: 100%;
          min-width: 0;
          min-height: 44px;
          font-size: 13px;
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
          <h1>Aim4price QR label</h1>
          <p>Save or print this compact QR label for the asset.</p>
        </div>
        <button type="button" onclick="window.print()">Print / Save Label</button>
      </div>

      <main class="previewArea">
        <section class="qrLabel" aria-label="Printable Aim4price QR label">
          <div class="qrFrame">
            <img src="${qrImageUrl}" alt="QR code for ${assetTitle}" />
          </div>

          <div class="labelCopy">

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
  const session = await getServerSession({ allowDealerApp: true });

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
