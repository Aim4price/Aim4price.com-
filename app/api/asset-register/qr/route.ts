import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterItemById } from '../../../../lib/asset-register-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type QrFormat = 'svg' | 'print';

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function normalizeFormat(value: string | null): QrFormat {
  return String(value ?? '').trim().toLowerCase() === 'print' ? 'print' : 'svg';
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

function buildScanUrl(origin: string, publicAssetCode: string): string {
  return new URL(`/scan/${encodeURIComponent(publicAssetCode)}`, origin).toString();
}

function buildExternalQrSvgUrl(scanUrl: string, size: number): string {
  const url = new URL('https://api.qrserver.com/v1/create-qr-code/');
  url.searchParams.set('data', scanUrl);
  url.searchParams.set('size', `${size}x${size}`);
  url.searchParams.set('format', 'svg');
  url.searchParams.set('margin', '0');
  return url.toString();
}

function buildSvgFileName(assetTitle: string, plateLabel: string): string {
  return `${slugifyFileSegment(assetTitle)}-${slugifyFileSegment(plateLabel)}-qr.svg`;
}

function buildPrintHtml(options: {
  assetTitle: string;
  plateLabel: string;
  publicAssetCode: string;
  scanUrl: string;
  qrImageUrl: string;
}): string {
  const assetTitle = escapeHtml(options.assetTitle);
  const plateLabel = escapeHtml(options.plateLabel);
  const publicAssetCode = escapeHtml(options.publicAssetCode);
  const scanUrl = escapeHtml(options.scanUrl);
  const qrImageUrl = escapeHtml(options.qrImageUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${assetTitle} QR sheet</title>
    <style>
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 24px;
        font-family: Inter, Arial, sans-serif;
        background: #eef3f7;
        color: #10232f;
      }
      .shell {
        width: min(100%, 920px);
        margin: 0 auto;
        display: grid;
        gap: 16px;
      }
      .toolbar {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .titleBlock h1 {
        margin: 0;
        font-size: 32px;
        line-height: 1.02;
        letter-spacing: -0.03em;
      }
      .titleBlock p {
        margin: 8px 0 0;
        color: #5d6d7a;
        line-height: 1.55;
      }
      .toolbar button {
        min-height: 48px;
        padding: 0 18px;
        border-radius: 999px;
        border: 1px solid #cfdae4;
        background: #ffffff;
        color: #173042;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .sheet {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
        gap: 20px;
        padding: 24px;
        background: #ffffff;
        border: 1px solid #d8e2ea;
        border-radius: 28px;
        box-shadow: 0 24px 60px rgba(13, 29, 41, 0.12);
      }
      .qrCard,
      .infoCard {
        border: 1px solid #dfe8ee;
        border-radius: 24px;
        background: linear-gradient(180deg, #f9fbfc 0%, #f3f7fa 100%);
        padding: 18px;
      }
      .qrCard {
        display: grid;
        gap: 16px;
        align-content: start;
      }
      .eyebrow,
      .infoRow span {
        display: inline-flex;
        color: #6f8190;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .qrFrame {
        aspect-ratio: 1 / 1;
        border-radius: 22px;
        background: #ffffff;
        border: 1px solid #d8e2ea;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .qrFrame img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .plateLabel {
        display: block;
        font-size: 30px;
        font-weight: 900;
        letter-spacing: -0.03em;
      }
      .infoCard {
        display: grid;
        gap: 12px;
      }
      .infoTitle {
        margin: 0;
        font-size: 42px;
        line-height: 0.96;
        letter-spacing: -0.04em;
      }
      .infoRow {
        display: grid;
        gap: 6px;
        padding: 14px 16px;
        border-radius: 18px;
        background: #ffffff;
        border: 1px solid #d8e2ea;
      }
      .infoRow strong,
      .scanUrl {
        color: #10232f;
        font-size: 18px;
        line-height: 1.45;
        word-break: break-word;
      }
      .scanUrl {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 14px;
      }
      .footerNote {
        color: #5d6d7a;
        font-size: 14px;
        line-height: 1.6;
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
        }
        .sheet {
          box-shadow: none;
          border-radius: 0;
          border: none;
          padding: 0;
        }
      }
      @media (max-width: 760px) {
        body {
          padding: 12px;
        }
        .sheet {
          grid-template-columns: 1fr;
        }
        .infoTitle {
          font-size: 34px;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="toolbar">
        <div class="titleBlock">
          <h1>Aim4price QR sheet</h1>
          <p>Print or share this permanent operational QR for field scanning and asset updates.</p>
        </div>
        <button type="button" onclick="window.print()">Print QR sheet</button>
      </div>

      <section class="sheet">
        <div class="qrCard">
          <span class="eyebrow">Permanent asset QR</span>
          <div class="qrFrame">
            <img src="${qrImageUrl}" alt="QR code for ${assetTitle}" />
          </div>
          <div>
            <span class="eyebrow">Plate label</span>
            <strong class="plateLabel">${plateLabel}</strong>
          </div>
        </div>

        <div class="infoCard">
          <span class="eyebrow">Operational scan</span>
          <h1 class="infoTitle">${assetTitle}</h1>
          <div class="infoRow">
            <span>Plate label</span>
            <strong>${plateLabel}</strong>
          </div>
          <div class="infoRow">
            <span>Public asset code</span>
            <strong>${publicAssetCode}</strong>
          </div>
          <div class="infoRow">
            <span>Scan page</span>
            <div class="scanUrl">${scanUrl}</div>
          </div>
          <p class="footerNote">
            This QR opens the Aim4price operational scan page only. Valuation and finance details stay hidden behind the owner side of the platform.
          </p>
        </div>
      </section>
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

  const scanUrl = buildScanUrl(request.nextUrl.origin, publicAssetCode);
  const qrImageUrl = buildExternalQrSvgUrl(scanUrl, format === 'print' ? 920 : 840);

  if (format === 'print') {
    return new NextResponse(
      buildPrintHtml({
        assetTitle: asset.title,
        plateLabel,
        publicAssetCode,
        scanUrl,
        qrImageUrl,
      }),
      {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        },
      },
    );
  }

  try {
    const qrResponse = await fetch(qrImageUrl, { cache: 'no-store' });

    if (!qrResponse.ok) {
      throw new Error(`QR render service returned ${qrResponse.status}.`);
    }

    const svg = await qrResponse.text();
    const fileName = buildSvgFileName(asset.title, plateLabel);

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
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
