import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterItemById } from '../../../../lib/asset-register-db';
import { listScanEventsForAsset, type ScanEventRecord } from '../../../../lib/scan-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugifyFileSegment(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatInteger(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return Math.round(value).toLocaleString('en-ZA');
}

function formatFuel(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return `${Math.round(value)}%`;
}

function formatQrStatus(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  return {
    active: 'Active',
    transferred: 'Transferred',
    retired: 'Retired',
    deleted: 'Deleted',
  }[normalized] ?? 'Unknown';
}

function formatActorType(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  return {
    scan_pin: 'Farm PIN',
    owner_session: 'Owner session',
    admin_session: 'Manager / admin',
  }[normalized] ?? 'Farm PIN';
}

function formatCoordinates(latitude: number | null, longitude: number | null): string {
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || typeof longitude !== 'number' || !Number.isFinite(longitude)) {
    return '';
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatLocationText(locationText: string, latitude: number | null, longitude: number | null): string {
  const normalized = asText(locationText);
  const coordinates = formatCoordinates(latitude, longitude);

  if (normalized && coordinates) {
    return `${normalized} • ${coordinates}`;
  }

  if (normalized) {
    return normalized;
  }

  return coordinates || '—';
}

function normalizeImageSrc(value?: string | null): string | null {
  const text = asText(value);

  if (!text) {
    return null;
  }

  if (/^(https?:)?\/\//i.test(text) || text.startsWith('/')) {
    return text;
  }

  return null;
}

function buildGoogleMapsUrl(latitude: number | null, longitude: number | null): string | null {
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || typeof longitude !== 'number' || !Number.isFinite(longitude)) {
    return null;
  }

  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function renderPhotoStrip(photoUrls: string[]): string {
  const safeUrls = photoUrls.map((entry) => normalizeImageSrc(entry)).filter(Boolean) as string[];

  if (!safeUrls.length) {
    return '';
  }

  return `
    <div class="photoStrip">
      ${safeUrls
        .slice(0, 6)
        .map(
          (photoUrl, index) => `
            <figure class="photoTile">
              <img src="${escapeHtml(photoUrl)}" alt="Scan photo ${index + 1}" />
            </figure>
          `,
        )
        .join('')}
    </div>
  `;
}

function buildEventFlags(event: ScanEventRecord): string[] {
  const flags: string[] = [formatActorType(event.actorType)];

  if (event.photoUrls.length) {
    flags.push(`${event.photoUrls.length} photo${event.photoUrls.length === 1 ? '' : 's'}`);
  }

  if (typeof event.latitude === 'number' && Number.isFinite(event.latitude) && typeof event.longitude === 'number' && Number.isFinite(event.longitude)) {
    flags.push('GPS captured');
  }

  if (asText(event.note)) {
    flags.push('Notes added');
  }

  return flags;
}

function renderEventCard(event: ScanEventRecord, index: number): string {
  const locationText = formatLocationText(event.locationText, event.latitude, event.longitude);
  const mapsUrl = buildGoogleMapsUrl(event.latitude, event.longitude);
  const flags = buildEventFlags(event);

  return `
    <article class="timelineCard">
      <div class="timelineHeader">
        <div>
          <span class="timelineEyebrow">Update ${index + 1}</span>
          <h3>${escapeHtml(formatDateTime(event.createdAtIso))}</h3>
        </div>
        <div class="timelineFlagRow">
          ${flags.map((flag) => `<span class="timelineFlag">${escapeHtml(flag)}</span>`).join('')}
        </div>
      </div>

      <div class="timelineStats">
        <div class="timelineStat">
          <span>Updated by</span>
          <strong>${escapeHtml(asText(event.operatorName) || 'Not captured')}</strong>
        </div>
        <div class="timelineStat">
          <span>Hour meter</span>
          <strong>${escapeHtml(formatInteger(event.hours))}</strong>
        </div>
        <div class="timelineStat">
          <span>Fuel</span>
          <strong>${escapeHtml(formatFuel(event.fuelPercent))}</strong>
        </div>
        <div class="timelineStat timelineStatWide">
          <span>Location</span>
          <strong>${escapeHtml(locationText)}</strong>
          ${mapsUrl ? `<a class="inlineLink" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">Open in Google Maps</a>` : ''}
        </div>
      </div>

      ${
        asText(event.note)
          ? `
            <div class="timelineNoteBlock">
              <span>Notes</span>
              <p>${escapeHtml(event.note)}</p>
            </div>
          `
          : ''
      }

      ${renderPhotoStrip(event.photoUrls)}
    </article>
  `;
}

function buildHtml(options: {
  ownerLabel: string;
  assetTitle: string;
  assetBadge: string;
  generatedAt: string;
  plateLabel: string;
  publicAssetCode: string;
  qrStatus: string;
  serialNumber: string;
  assetPhotoUrl: string | null;
  latestHours: string;
  latestFuel: string;
  lastScannedAt: string;
  lastKnownLocation: string;
  latestMapsUrl: string | null;
  stats: Array<{ label: string; value: string; note?: string }>;
  timelineHtml: string;
  hasEvents: boolean;
  footerNote: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.assetTitle)} QR scan report</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #edf2f0;
        --paper: #ffffff;
        --paper-soft: #f7faf8;
        --text: #12332b;
        --muted: #5d736d;
        --line: #d9e4df;
        --brand-dark: #10382f;
        --brand-mid: #1c5a4c;
        --brand-soft: #e8f4ef;
      }
      * { box-sizing: border-box; }
      @page { size: A4; margin: 14mm; }
      html, body {
        margin: 0;
        padding: 0;
        background: var(--bg);
        color: var(--text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .screenBar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 0.95rem 1.15rem;
        background: rgba(255, 255, 255, 0.92);
        border-bottom: 1px solid rgba(17, 56, 45, 0.08);
        backdrop-filter: blur(14px);
      }
      .screenBarText {
        color: var(--muted);
        font-size: 0.92rem;
        line-height: 1.45;
      }
      .screenBarActions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
      .screenButton {
        appearance: none;
        border: 1px solid rgba(16, 56, 47, 0.1);
        border-radius: 999px;
        background: var(--paper);
        color: var(--text);
        min-height: 2.8rem;
        padding: 0 1rem;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .screenButtonPrimary { color: #ffffff; background: linear-gradient(135deg, var(--brand-dark) 0%, var(--brand-mid) 100%); border-color: transparent; }
      .page {
        width: min(100%, 1040px);
        margin: 1.25rem auto 2rem;
        background: var(--paper);
        border-radius: 1.8rem;
        overflow: hidden;
        box-shadow: 0 24px 60px rgba(15, 38, 31, 0.08), 0 10px 24px rgba(15, 38, 31, 0.04);
      }
      .pageHeader {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.25rem;
        padding: 1.75rem 2rem 1.15rem;
        border-bottom: 1px solid var(--line);
      }
      .brandLockup { display: flex; align-items: center; gap: 1rem; min-width: 0; }
      .logo { width: 178px; max-width: 42vw; height: auto; object-fit: contain; }
      .documentKicker {
        display: inline-flex;
        align-items: center;
        min-height: 1.8rem;
        padding: 0 0.78rem;
        border-radius: 999px;
        background: var(--brand-soft);
        color: var(--brand-mid);
        border: 1px solid rgba(28, 90, 76, 0.12);
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }
      .documentMeta { text-align: right; min-width: 12rem; }
      .documentMetaLabel {
        display: block;
        color: var(--muted);
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }
      .documentMetaValue {
        display: block;
        margin-top: 0.35rem;
        color: var(--text);
        font-size: 1rem;
        font-weight: 800;
      }
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(18rem, 0.85fr);
        gap: 1.25rem;
        padding: 1.55rem 2rem 1.7rem;
        background: linear-gradient(135deg, #0f332b 0%, #1d5a4b 55%, #2a6170 100%);
        color: #ffffff;
      }
      .heroTitle {
        margin: 0.7rem 0 0.55rem;
        font-size: clamp(2rem, 5vw, 3.15rem);
        line-height: 0.98;
        letter-spacing: -0.06em;
      }
      .heroMeta { margin: 0; max-width: 42rem; color: rgba(234,245,241,0.9); font-size: 1rem; line-height: 1.7; }
      .heroValueCard {
        display: grid;
        gap: 0.85rem;
        align-content: start;
        padding: 1.2rem;
        border-radius: 1.35rem;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.14);
      }
      .heroValueLabel { color: rgba(234,245,241,0.86); font-size: 0.76rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
      .heroValueAmount { font-size: clamp(2rem,4vw,2.95rem); line-height: 0.94; letter-spacing: -0.055em; font-weight: 900; }
      .heroValueMeta { color: rgba(234,245,241,0.82); font-size: 0.93rem; line-height: 1.55; }
      .heroBadgeRow { display: flex; gap: 0.55rem; flex-wrap: wrap; }
      .heroBadge {
        display: inline-flex;
        align-items: center;
        min-height: 1.9rem;
        padding: 0 0.8rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 800;
        background: rgba(255,255,255,0.14);
        border: 1px solid rgba(255,255,255,0.14);
        color: #ffffff;
      }
      .content { display: grid; gap: 1rem; padding: 1.2rem 2rem 2rem; }
      .statsGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.85rem; }
      .statCard { border: 1px solid var(--line); border-radius: 1.2rem; background: #ffffff; padding: 0.95rem 1rem; }
      .statValue { display:block; color: var(--text); font-size: 1.45rem; line-height:1; font-weight:900; letter-spacing:-0.04em; }
      .statLabel { display:block; margin-top:0.35rem; color: var(--muted); font-size:0.86rem; font-weight:700; }
      .statNote { display:block; margin-top:0.28rem; color: var(--muted); font-size:0.8rem; line-height:1.45; }
      .gridTwo { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
      .card { border: 1px solid var(--line); border-radius: 1.3rem; background: var(--paper-soft); padding: 1.05rem 1.1rem; break-inside: avoid; }
      .cardTitle { margin: 0 0 0.85rem; color: var(--text); font-size: 1.12rem; font-weight: 850; letter-spacing: -0.03em; }
      .keyValueList { display:grid; gap: 0.8rem; }
      .keyValueRow { display:flex; justify-content:space-between; gap:1rem; padding-bottom:0.72rem; border-bottom:1px solid rgba(17,56,45,0.08); }
      .keyValueRow:last-child { padding-bottom:0; border-bottom:0; }
      .keyValueLabel { color: var(--muted); font-size:0.92rem; line-height:1.5; }
      .keyValueValue { color: var(--text); font-size:0.94rem; line-height:1.5; font-weight:700; text-align:right; }
      .photoFrame { overflow:hidden; border-radius:1.15rem; border:1px solid var(--line); background:#ffffff; }
      .photoFrame img { display:block; width:100%; height:19rem; object-fit:cover; }
      .timelineGrid { display:grid; gap:0.9rem; }
      .timelineCard { border:1px solid var(--line); border-radius:1.25rem; background:#ffffff; padding:1rem; }
      .timelineHeader { display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap; align-items:flex-start; }
      .timelineEyebrow { display:block; color: var(--muted); font-size:0.76rem; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; }
      .timelineHeader h3 { margin:0.32rem 0 0; font-size:1.25rem; line-height:1.15; letter-spacing:-0.03em; }
      .timelineFlagRow { display:flex; gap:0.5rem; flex-wrap:wrap; }
      .timelineFlag { display:inline-flex; align-items:center; min-height:1.85rem; padding:0 0.76rem; border-radius:999px; background:#f1f6f4; color:#245347; border:1px solid rgba(28,90,76,0.12); font-size:0.74rem; font-weight:800; }
      .timelineStats { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:0.75rem; margin-top:0.95rem; }
      .timelineStat { border:1px solid rgba(17,56,45,0.08); border-radius:1rem; background:#f8fbf9; padding:0.85rem 0.9rem; }
      .timelineStatWide { grid-column: span 1; }
      .timelineStat span, .timelineNoteBlock span { display:block; color:var(--muted); font-size:0.76rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; }
      .timelineStat strong { display:block; margin-top:0.32rem; font-size:1rem; line-height:1.45; }
      .inlineLink { display:inline-block; margin-top:0.4rem; color:#2457c5; text-decoration:none; font-weight:700; }
      .inlineLink:hover { text-decoration:underline; }
      .timelineNoteBlock { margin-top:0.85rem; padding:0.9rem; border-radius:1rem; background:#f8fbf9; border:1px solid rgba(17,56,45,0.08); }
      .timelineNoteBlock p { margin:0.35rem 0 0; color:var(--text); line-height:1.65; }
      .photoStrip { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:0.75rem; margin-top:0.9rem; }
      .photoTile { margin:0; overflow:hidden; border-radius:1rem; border:1px solid rgba(17,56,45,0.08); background:#ffffff; }
      .photoTile img { display:block; width:100%; height:8.5rem; object-fit:cover; }
      .emptyState { padding:1rem 1.1rem; border-radius:1.2rem; border:1px dashed rgba(17,56,45,0.16); background:#ffffff; color:var(--muted); line-height:1.65; }
      .footer { padding: 0 2rem 1.8rem; color: var(--muted); font-size:0.82rem; line-height:1.55; }
      @media (max-width: 900px) {
        .hero, .gridTwo, .statsGrid, .timelineStats { grid-template-columns: 1fr; }
        .photoStrip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media print {
        html, body { background:#ffffff; }
        .screenBar { display:none !important; }
        .page { width:100%; margin:0; border-radius:0; box-shadow:none; }
        a.inlineLink { color: var(--text); text-decoration:none; }
      }
    </style>
  </head>
  <body>
    <div class="screenBar">
      <div class="screenBarText">
        <strong>QR scan report</strong><br />
        Use Print and choose <em>Save as PDF</em> to keep a shareable report for owners, managers, insurers or service teams.
      </div>
      <div class="screenBarActions">
        <button class="screenButton" type="button" onclick="window.close()">Close</button>
        <button class="screenButton screenButtonPrimary" type="button" onclick="window.print()">Print / Save as PDF</button>
      </div>
    </div>

    <div class="page">
      <header class="pageHeader">
        <div class="brandLockup">
          <img class="logo" src="/brand/aim4price-mark-black.png" alt="Aim4price" />
          <div>
            <span class="documentKicker">QR scan report</span>
          </div>
        </div>
        <div class="documentMeta">
          <span class="documentMetaLabel">Generated</span>
          <span class="documentMetaValue">${escapeHtml(options.generatedAt)}</span>
        </div>
      </header>

      <section class="hero">
        <div>
          <span class="documentKicker">Operational history</span>
          <h1 class="heroTitle">${escapeHtml(options.assetTitle)}</h1>
          <p class="heroMeta">Built for owners and managers who need a clean audit trail of QR activity, last known location, hours, fuel, notes and photo-backed updates.</p>
        </div>

        <aside class="heroValueCard">
          <span class="heroValueLabel">Asset reference</span>
          <strong class="heroValueAmount">${escapeHtml(options.assetBadge)}</strong>
          <div class="heroBadgeRow">
            <span class="heroBadge">${escapeHtml(options.qrStatus)}</span>
            <span class="heroBadge">${escapeHtml(options.ownerLabel)}</span>
          </div>
          <div class="heroValueMeta">Latest scan: ${escapeHtml(options.lastScannedAt)}<br />Latest location: ${escapeHtml(options.lastKnownLocation)}</div>
        </aside>
      </section>

      <main class="content">
        <section class="statsGrid">
          ${options.stats.map((stat) => `
            <article class="statCard">
              <strong class="statValue">${escapeHtml(stat.value)}</strong>
              <span class="statLabel">${escapeHtml(stat.label)}</span>
              ${stat.note ? `<span class="statNote">${escapeHtml(stat.note)}</span>` : ''}
            </article>
          `).join('')}
        </section>

        <section class="gridTwo">
          <article class="card">
            <h2 class="cardTitle">Asset profile</h2>
            <div class="keyValueList">
              <div class="keyValueRow"><span class="keyValueLabel">Title</span><span class="keyValueValue">${escapeHtml(options.assetTitle)}</span></div>
              <div class="keyValueRow"><span class="keyValueLabel">Plate label</span><span class="keyValueValue">${escapeHtml(options.plateLabel)}</span></div>
              <div class="keyValueRow"><span class="keyValueLabel">Public asset code</span><span class="keyValueValue">${escapeHtml(options.publicAssetCode)}</span></div>
              <div class="keyValueRow"><span class="keyValueLabel">Serial number</span><span class="keyValueValue">${escapeHtml(options.serialNumber || '—')}</span></div>
              <div class="keyValueRow"><span class="keyValueLabel">QR status</span><span class="keyValueValue">${escapeHtml(options.qrStatus)}</span></div>
            </div>
          </article>

          <article class="card">
            <h2 class="cardTitle">Current operational snapshot</h2>
            <div class="keyValueList">
              <div class="keyValueRow"><span class="keyValueLabel">Latest hour meter</span><span class="keyValueValue">${escapeHtml(options.latestHours)}</span></div>
              <div class="keyValueRow"><span class="keyValueLabel">Latest fuel</span><span class="keyValueValue">${escapeHtml(options.latestFuel)}</span></div>
              <div class="keyValueRow"><span class="keyValueLabel">Last scanned</span><span class="keyValueValue">${escapeHtml(options.lastScannedAt)}</span></div>
              <div class="keyValueRow"><span class="keyValueLabel">Last known location</span><span class="keyValueValue">${escapeHtml(options.lastKnownLocation)}</span></div>
              <div class="keyValueRow"><span class="keyValueLabel">Map link</span><span class="keyValueValue">${options.latestMapsUrl ? `<a class="inlineLink" href="${escapeHtml(options.latestMapsUrl)}" target="_blank" rel="noreferrer">Open latest position</a>` : '—'}</span></div>
            </div>
          </article>
        </section>

        ${options.assetPhotoUrl ? `
          <section class="card">
            <h2 class="cardTitle">Current asset image</h2>
            <div class="photoFrame">
              <img src="${escapeHtml(options.assetPhotoUrl)}" alt="${escapeHtml(options.assetTitle)}" />
            </div>
          </section>
        ` : ''}

        <section class="card">
          <h2 class="cardTitle">QR update timeline</h2>
          ${options.hasEvents ? `<div class="timelineGrid">${options.timelineHtml}</div>` : '<div class="emptyState">No QR scan updates have been recorded for this asset yet. Once the machine is scanned and updated, this report will show time-stamped hours, fuel, GPS-backed locations, notes and photos.</div>'}
        </section>
      </main>

      <footer class="footer">${escapeHtml(options.footerNote)}</footer>
    </div>
  </body>
</html>`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth', request.url), { status: 302 });
  }

  const assetId = asText(request.nextUrl.searchParams.get('assetId'));

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Asset ID is required.' }, { status: 400 });
  }

  const asset = await getAssetRegisterItemById(session.user.id, assetId);

  if (!asset) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }

  const events = await listScanEventsForAsset(asset.id, 500);
  const latestEvent = events[0] ?? null;
  const oldestEvent = events[events.length - 1] ?? null;
  const scansWithPhotos = events.filter((event) => event.photoUrls.length > 0).length;
  const gpsCapturedCount = events.filter(
    (event) => typeof event.latitude === 'number' && Number.isFinite(event.latitude) && typeof event.longitude === 'number' && Number.isFinite(event.longitude),
  ).length;
  const notesCount = events.filter((event) => Boolean(asText(event.note))).length;
  const latestMapsUrl = buildGoogleMapsUrl(asset.lastKnownLat, asset.lastKnownLng);
  const assetPhotoUrl = normalizeImageSrc(asset.photos[0] ?? null);

  const stats = [
    {
      label: 'Total QR updates',
      value: String(events.length),
      note: oldestEvent ? `First recorded ${formatDate(oldestEvent.createdAtIso)}` : 'No scans recorded yet',
    },
    {
      label: 'Latest scan',
      value: latestEvent ? formatDate(latestEvent.createdAtIso) : '—',
      note: latestEvent ? formatDateTime(latestEvent.createdAtIso) : 'Waiting for the first QR update',
    },
    {
      label: 'GPS-backed updates',
      value: String(gpsCapturedCount),
      note: events.length ? `${Math.round((gpsCapturedCount / events.length) * 100)}% of QR updates captured a location.` : 'Location data becomes available after the first scan.',
    },
    {
      label: 'Photo-backed updates',
      value: String(scansWithPhotos),
      note: scansWithPhotos ? 'Useful for bank, insurance and workshop proof.' : 'No photo evidence captured yet.',
    },
    {
      label: 'Latest hour meter',
      value: formatInteger(asset.hours),
      note: latestEvent?.hours !== null && typeof latestEvent?.hours === 'number' ? `Latest QR update recorded ${formatInteger(latestEvent.hours)} hours.` : 'No hour meter value captured in the QR history yet.',
    },
    {
      label: 'Latest fuel',
      value: formatFuel(asset.fuelPercent),
      note: notesCount ? `${notesCount} QR updates included notes or comments.` : 'No notes have been added through QR updates yet.',
    },
  ];

  const html = buildHtml({
    ownerLabel: asText(session.user.name) || asText(session.user.email) || 'Owner session',
    assetTitle: asset.title,
    assetBadge: asset.plateLabel || asset.publicAssetCode || asset.id,
    generatedAt: formatDateTime(new Date().toISOString()),
    plateLabel: asset.plateLabel || '—',
    publicAssetCode: asset.publicAssetCode || '—',
    qrStatus: formatQrStatus(asset.qrStatus),
    serialNumber: asset.serialNumber || '—',
    assetPhotoUrl,
    latestHours: formatInteger(asset.hours),
    latestFuel: formatFuel(asset.fuelPercent),
    lastScannedAt: formatDateTime(asset.lastScannedAtIso),
    lastKnownLocation: formatLocationText(asset.lastKnownLocationText, asset.lastKnownLat, asset.lastKnownLng),
    latestMapsUrl,
    stats,
    timelineHtml: events.map((event, index) => renderEventCard(event, index)).join(''),
    hasEvents: events.length > 0,
    footerNote:
      'Aim4price QR scan report. This document focuses on operational history only — scan events, latest GPS-backed position, hours, fuel, notes and captured photos.',
  });

  const fileName = `${slugifyFileSegment(asset.title)}-${slugifyFileSegment(asset.plateLabel || asset.publicAssetCode || asset.id)}-qr-scan-report.html`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
