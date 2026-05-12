import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { listAssetRegisterItems, type AssetRegisterItem } from '../../../../lib/asset-register-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PrintableAsset = {
  number: number;
  title: string;
  plateLabel: string;
  publicAssetCode: string;
  serialNumber: string;
  assetTypeLabel: string;
  fuel: string;
  usage: string;
  condition: string;
  lastScanned: string;
  locationText: string;
  latitude: number;
  longitude: number;
  latLngText: string;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Not scanned';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not scanned';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatGeneratedAt(value = new Date()): string {
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function formatFileDate(value = new Date()): string {
  return value.toISOString().slice(0, 10);
}

function formatCondition(value: string): string {
  const normalized = asText(value).toLowerCase();

  return (
    {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      used: 'Used',
      serious: 'Requires attention',
    }[normalized] ?? (asText(value) || 'Not saved')
  );
}

function formatFuel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not saved';
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat('en-ZA').format(Math.round(value));
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function getUsageUnit(asset: AssetRegisterItem): 'hours' | 'km' {
  const specs = asset.specsJson && typeof asset.specsJson === 'object' ? asset.specsJson : {};
  const rawUsage = String(
    specs.usageMetric ?? specs.usage_metric ?? specs.usageUnit ?? specs.usage_unit ?? specs.usageMetricType ?? specs.usage_metric_type ?? '',
  )
    .trim()
    .toLowerCase();

  if (asset.kind === 'vehicle') return 'km';
  if (rawUsage === 'km' || rawUsage === 'kms' || rawUsage === 'kilometres' || rawUsage === 'kilometers') return 'km';
  return 'hours';
}

function formatUsage(asset: AssetRegisterItem): string {
  if (typeof asset.hours === 'number' && Number.isFinite(asset.hours)) {
    return `${formatNumber(asset.hours)} ${getUsageUnit(asset)}`;
  }

  if (typeof asset.lifeWorkedPercent === 'number' && Number.isFinite(asset.lifeWorkedPercent)) {
    const percent = Math.max(0, Math.min(100, Math.round(asset.lifeWorkedPercent * 10) / 10));
    return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}% worked`;
  }

  return 'Not saved';
}

function assetTypeLabel(asset: AssetRegisterItem): string {
  const family = asText(asset.equipmentFamilyLabel);
  if (family) return family;

  const kind = asText(asset.kind);
  if (kind) return titleCase(kind);

  return 'Asset';
}

function hasCoordinates(asset: AssetRegisterItem): boolean {
  const { lastKnownLat: lat, lastKnownLng: lng } = asset;
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function sortByScanDate(left: AssetRegisterItem, right: AssetRegisterItem): number {
  const leftTime = left.lastScannedAtIso ? new Date(left.lastScannedAtIso).getTime() : 0;
  const rightTime = right.lastScannedAtIso ? new Date(right.lastScannedAtIso).getTime() : 0;

  if (rightTime !== leftTime) {
    return rightTime - leftTime;
  }

  return left.title.localeCompare(right.title, 'en', { sensitivity: 'base' });
}

function toPrintableAsset(asset: AssetRegisterItem, index: number): PrintableAsset {
  const latitude = typeof asset.lastKnownLat === 'number' ? asset.lastKnownLat : Number(asset.lastKnownLat);
  const longitude = typeof asset.lastKnownLng === 'number' ? asset.lastKnownLng : Number(asset.lastKnownLng);

  return {
    number: index + 1,
    title: asset.title || 'Saved asset',
    plateLabel: asset.plateLabel || asset.publicAssetCode || 'No plate label',
    publicAssetCode: asset.publicAssetCode,
    serialNumber: asset.serialNumber || 'Not saved',
    assetTypeLabel: assetTypeLabel(asset),
    fuel: formatFuel(asset.fuelPercent),
    usage: formatUsage(asset),
    condition: formatCondition(asset.condition),
    lastScanned: formatDateTime(asset.lastScannedAtIso),
    locationText: asset.lastKnownLocationText || 'No written location note saved',
    latitude,
    longitude,
    latLngText: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
  };
}

function filterAssetsByCodes(assets: AssetRegisterItem[], codes: string[]): AssetRegisterItem[] {
  if (!codes.length) {
    return assets.sort(sortByScanDate);
  }

  const byCode = new Map(assets.map((asset) => [asset.publicAssetCode, asset]));
  return codes.map((code) => byCode.get(code)).filter((asset): asset is AssetRegisterItem => Boolean(asset));
}

function renderRows(assets: PrintableAsset[]): string {
  if (!assets.length) {
    return `
      <div class="emptyState">
        <strong>No mapped assets in this report.</strong>
        <span>Go back to the asset map and choose at least one scanned asset with saved GPS coordinates.</span>
      </div>
    `;
  }

  return assets
    .map(
      (asset) => `
        <article class="assetRow">
          <div class="rowNumber">${asset.number}</div>
          <div class="rowMain">
            <strong>${escapeHtml(asset.title)}</strong>
            <span>${escapeHtml(asset.plateLabel)} · ${escapeHtml(asset.assetTypeLabel)}</span>
          </div>
          <div class="rowDetail">
            <span>Serial</span>
            <strong>${escapeHtml(asset.serialNumber)}</strong>
          </div>
          <div class="rowDetail">
            <span>Fuel</span>
            <strong>${escapeHtml(asset.fuel)}</strong>
          </div>
          <div class="rowDetail wide">
            <span>GPS</span>
            <strong>${escapeHtml(asset.latLngText)}</strong>
          </div>
          <div class="rowDetail wide">
            <span>Last scanned</span>
            <strong>${escapeHtml(asset.lastScanned)}</strong>
          </div>
        </article>
      `,
    )
    .join('');
}

function buildReportHtml(assets: PrintableAsset[], generatedAt: string): string {
  const title = assets.length === 1 ? `${assets[0].title} Asset Map` : 'Aim4price Asset Map';
  const subtitle = assets.length === 1 ? 'Single asset map report' : `${assets.length} mapped assets shown and numbered`;
  const mapData = safeScriptJson(assets);
  const rowsHtml = renderRows(assets);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      :root {
        color-scheme: light;
        --bg: #eef3f1;
        --paper: #ffffff;
        --paper-soft: #f7faf8;
        --text: #12332b;
        --muted: #62736d;
        --line: #dce7e2;
        --brand: #103f35;
        --brand-2: #176b56;
        --blue: #3768d5;
      }

      * { box-sizing: border-box; }

      @page {
        size: A4 landscape;
        margin: 10mm;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: var(--bg);
        color: var(--text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .screenBar {
        position: sticky;
        top: 0;
        z-index: 50;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 0.85rem 1rem;
        background: rgba(255, 255, 255, 0.94);
        border-bottom: 1px solid rgba(17, 56, 45, 0.08);
        backdrop-filter: blur(14px);
      }

      .screenBar strong { color: var(--text); }

      .screenBar span {
        color: var(--muted);
        font-size: 0.9rem;
      }

      .screenActions { display: flex; gap: 0.65rem; flex-wrap: wrap; }

      .button {
        appearance: none;
        min-height: 2.7rem;
        border: 1px solid rgba(16, 56, 47, 0.12);
        border-radius: 999px;
        background: #ffffff;
        color: var(--text);
        padding: 0 1rem;
        font: inherit;
        font-weight: 850;
        cursor: pointer;
      }

      .buttonPrimary {
        color: #ffffff;
        border-color: transparent;
        background: linear-gradient(135deg, var(--brand), var(--brand-2));
      }

      .page {
        width: min(100% - 1.5rem, 1120px);
        margin: 1rem auto 1.4rem;
        display: grid;
        gap: 0.75rem;
      }

      .reportHeader,
      .mapCard,
      .keyCard {
        border: 1px solid rgba(18, 49, 43, 0.08);
        background: var(--paper);
        box-shadow: 0 20px 52px rgba(24, 45, 55, 0.08);
      }

      .reportHeader {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.85rem 1rem;
        border-radius: 1.3rem;
      }

      .brandBlock { display: grid; gap: 0.18rem; }

      .kicker {
        width: fit-content;
        color: var(--brand);
        font-size: 0.68rem;
        font-weight: 950;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        color: var(--text);
        font-size: 2rem;
        line-height: 1;
        letter-spacing: -0.06em;
      }

      .subtitle,
      .meta {
        margin: 0;
        color: var(--muted);
        font-size: 0.88rem;
        line-height: 1.4;
        font-weight: 650;
      }

      .meta { text-align: right; }

      .mapCard {
        overflow: hidden;
        border-radius: 1.35rem;
      }

      #map {
        width: 100%;
        height: 445px;
        background: #dfe8e2;
      }

      .keyCard {
        display: grid;
        gap: 0.52rem;
        padding: 0.72rem;
        border-radius: 1.25rem;
      }

      .keyHeader {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
        padding: 0 0.2rem 0.18rem;
      }

      .keyHeader h2 {
        margin: 0;
        color: var(--text);
        font-size: 1rem;
        letter-spacing: -0.03em;
      }

      .keyHeader span {
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 800;
      }

      .assetRows {
        display: grid;
        gap: 0.42rem;
      }

      .assetRow {
        display: grid;
        grid-template-columns: auto minmax(12rem, 1fr) minmax(7rem, 0.55fr) minmax(5rem, 0.36fr) minmax(9rem, 0.7fr) minmax(9rem, 0.7fr);
        gap: 0.48rem;
        align-items: center;
        padding: 0.52rem;
        border-radius: 0.9rem;
        border: 1px solid rgba(18, 49, 43, 0.07);
        background: var(--paper-soft);
        break-inside: avoid;
      }

      .rowNumber {
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        color: #ffffff;
        background: var(--brand);
        font-weight: 950;
      }

      .rowMain,
      .rowDetail {
        min-width: 0;
        display: grid;
        gap: 0.1rem;
      }

      .rowMain strong,
      .rowDetail strong {
        min-width: 0;
        overflow-wrap: anywhere;
        color: var(--text);
        font-size: 0.82rem;
        line-height: 1.25;
      }

      .rowMain span,
      .rowDetail span {
        min-width: 0;
        overflow-wrap: anywhere;
        color: var(--muted);
        font-size: 0.68rem;
        line-height: 1.25;
        font-weight: 800;
      }

      .emptyState {
        display: grid;
        place-items: center;
        gap: 0.35rem;
        min-height: 9rem;
        text-align: center;
        color: var(--muted);
      }

      .emptyState strong { color: var(--text); }

      .leaflet-container { font-family: inherit; }
      .leaflet-control-attribution { font-size: 9px; }

      .reportMarker { background: transparent; border: 0; }
      .reportMarkerPin {
        position: relative;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        color: #ffffff;
        background: var(--brand);
        border: 3px solid #ffffff;
        box-shadow: 0 12px 22px rgba(16, 63, 53, 0.3);
      }
      .reportMarkerPin::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: -5px;
        width: 10px;
        height: 10px;
        border-right: 3px solid #ffffff;
        border-bottom: 3px solid #ffffff;
        background: var(--brand);
        transform: translateX(-50%) rotate(45deg);
        border-radius: 0 0 3px 0;
      }
      .reportMarkerPin b {
        position: relative;
        z-index: 2;
        font-size: 0.84rem;
        font-weight: 950;
      }

      @media print {
        html,
        body { background: #ffffff; }
        .screenBar { display: none; }
        .page {
          width: 100%;
          margin: 0;
          gap: 0.55rem;
        }
        .reportHeader,
        .mapCard,
        .keyCard {
          box-shadow: none;
        }
        #map { height: 420px; }
        .assetRow {
          grid-template-columns: auto minmax(11rem, 1fr) minmax(6rem, 0.48fr) minmax(4.6rem, 0.32fr) minmax(8.4rem, 0.64fr) minmax(8.4rem, 0.64fr);
          padding: 0.42rem;
        }
      }
    </style>
  </head>
  <body>
    <div class="screenBar">
      <span><strong>Asset map report is ready.</strong> Choose Save as PDF in the print dialog.</span>
      <div class="screenActions">
        <button type="button" class="button" onclick="window.close()">Close</button>
        <button type="button" class="button buttonPrimary" onclick="window.print()">Print / Save PDF</button>
      </div>
    </div>

    <main class="page">
      <header class="reportHeader">
        <div class="brandBlock">
          <span class="kicker">Aim4price fleet visibility</span>
          <h1>${escapeHtml(title)}</h1>
          <p class="subtitle">${escapeHtml(subtitle)}</p>
        </div>
        <p class="meta">Generated ${escapeHtml(generatedAt)}<br />${assets.length === 1 ? 'Single selected asset' : 'Markers are numbered to match the key below.'}</p>
      </header>

      <section class="mapCard">
        <div id="map" aria-label="Asset map report"></div>
      </section>

      <section class="keyCard">
        <div class="keyHeader">
          <h2>Map key</h2>
          <span>${assets.length} asset${assets.length === 1 ? '' : 's'}</span>
        </div>
        <div class="assetRows">${rowsHtml}</div>
      </section>
    </main>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const assets = ${mapData};

      function initMap() {
        const mapEl = document.getElementById('map');
        if (!mapEl || !window.L) {
          return;
        }

        const map = L.map(mapEl, {
          zoomControl: false,
          attributionControl: true,
          scrollWheelZoom: false,
          dragging: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          tap: false,
        });

        const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        if (!assets.length) {
          map.setView([-29.0, 24.0], 5);
          setTimeout(() => window.print(), 900);
          return;
        }

        const bounds = [];
        const escapePopup = (value) => String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

        assets.forEach((asset) => {
          const icon = L.divIcon({
            className: 'reportMarker',
            html: '<span class="reportMarkerPin"><b>' + asset.number + '</b></span>',
            iconSize: [38, 44],
            iconAnchor: [19, 40],
            popupAnchor: [0, -34],
          });

          const marker = L.marker([asset.latitude, asset.longitude], { icon }).addTo(map);
          marker.bindPopup('<strong>' + escapePopup(asset.title) + '</strong><br />' + escapePopup(asset.plateLabel) + '<br />GPS ' + escapePopup(asset.latLngText));
          bounds.push([asset.latitude, asset.longitude]);
        });

        if (bounds.length === 1) {
          map.setView(bounds[0], 13);
        } else {
          map.fitBounds(bounds, { padding: [56, 56], maxZoom: 13 });
        }

        let printed = false;
        const printReport = () => {
          if (printed) return;
          printed = true;
          setTimeout(() => window.print(), 850);
        };
        tiles.once('load', printReport);
        setTimeout(printReport, 1800);
      }

      if (document.readyState === 'complete') {
        initMap();
      } else {
        window.addEventListener('load', initMap, { once: true });
      }
    </script>
  </body>
</html>`;
}

export async function GET(request: Request) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const url = new URL(request.url);
    const rawCodes = asText(url.searchParams.get('codes'));
    const requestedCodes = rawCodes
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean);

    const items = await listAssetRegisterItems(session.user.id);
    const mappedItems = items.filter(hasCoordinates);
    const reportItems = filterAssetsByCodes(mappedItems, requestedCodes);
    const printableAssets = reportItems.map(toPrintableAsset);
    const html = buildReportHtml(printableAssets, formatGeneratedAt());
    const filename = `aim4price-asset-map-${formatFileDate()}.html`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('asset map report failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to build the asset map report.' },
      { status: 500 },
    );
  }
}
