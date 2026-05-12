import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterItemById, type AssetRegisterItem } from '../../../../lib/asset-register-db';
import { listScanEventsForAsset, type ScanEventRecord } from '../../../../lib/scan-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScanReportKind = 'scan' | 'fuel' | 'maintenance';

type ReportStat = {
  label: string;
  value: string;
  note?: string;
};

type KeyValueRow = {
  label: string;
  value: string;
  valueHtml?: string;
};

type MaintenanceKind = 'checked' | 'serviced';

type MaintenanceEntry = {
  kind: MaintenanceKind;
  label: string;
  items: string[];
  company: string;
  mechanic: string;
  notes: string;
  event: ScanEventRecord;
};

const REPORT_LABELS: Record<ScanReportKind, string> = {
  fuel: 'Fuel report',
  scan: 'Scan report',
  maintenance: 'Maintenance report',
};

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

function normalizeReportKind(value: unknown): ScanReportKind {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');

  if (normalized === 'fuel' || normalized === 'fuel-report') return 'fuel';
  if (
    normalized === 'maintenance' ||
    normalized === 'maintenance-report' ||
    normalized === 'maintainance' ||
    normalized === 'maintainance-report'
  ) {
    return 'maintenance';
  }

  return 'scan';
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

  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  const rounded = Math.max(0, Math.min(100, Math.round(value * 10) / 10));
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}%`;
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

function formatCondition(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  return {
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    used: 'Used',
    serious: 'Requires attention',
  }[normalized] ?? '—';
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

function extractLifeWorkedPercentFromNote(note: string): number | null {
  const match = asText(note).match(/lifetime\s+worked\s+updated\s+to\s+(\d+(?:\.\d+)?)%/i);
  const parsed = match ? Number(match[1]) : NaN;

  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
}

function formatEventUsage(asset: AssetRegisterItem, event: ScanEventRecord): string {
  if (typeof event.hours === 'number' && Number.isFinite(event.hours)) {
    return `${formatInteger(event.hours)} ${getUsageUnit(asset)}`;
  }

  const lifeWorkedPercent = extractLifeWorkedPercentFromNote(event.note);
  if (lifeWorkedPercent !== null) {
    return `${formatPercent(lifeWorkedPercent)} worked`;
  }

  return '—';
}

function formatLatestUsage(asset: AssetRegisterItem): string {
  if (typeof asset.hours === 'number' && Number.isFinite(asset.hours)) {
    return `${formatInteger(asset.hours)} ${getUsageUnit(asset)}`;
  }

  if (typeof asset.lifeWorkedPercent === 'number' && Number.isFinite(asset.lifeWorkedPercent)) {
    return `${formatPercent(asset.lifeWorkedPercent)} worked`;
  }

  return '—';
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

function renderEventCard(asset: AssetRegisterItem, event: ScanEventRecord, index: number): string {
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
          <span>Usage</span>
          <strong>${escapeHtml(formatEventUsage(asset, event))}</strong>
        </div>
        <div class="timelineStat">
          <span>Fuel</span>
          <strong>${escapeHtml(formatFuel(event.fuelPercent))}</strong>
        </div>
        <div class="timelineStat">
          <span>Condition</span>
          <strong>${escapeHtml(formatCondition(event.condition))}</strong>
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
              <span>Summary</span>
              <p>${escapeHtml(event.note).replace(/\n/g, '<br />')}</p>
            </div>
          `
          : ''
      }

      ${renderPhotoStrip(event.photoUrls)}
    </article>
  `;
}

function splitItems(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseMaintenanceEvent(event: ScanEventRecord): MaintenanceEntry | null {
  const note = asText(event.note);
  if (!note) return null;

  const lines = note
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstLine = (lines[0] ?? '').toLowerCase();
  let kind: MaintenanceKind | null = null;

  if (firstLine === 'checked' || firstLine.includes('checked')) {
    kind = 'checked';
  }

  if (firstLine === 'serviced' || firstLine.includes('serviced')) {
    kind = 'serviced';
  }

  if (!kind) {
    return null;
  }

  const values = new Map<string, string[]>();
  let activeKey = '';

  for (const line of lines.slice(1)) {
    const match = line.match(/^([A-Za-z][A-Za-z\s/]+):\s*(.*)$/);

    if (match) {
      activeKey = match[1].trim().toLowerCase();
      const current = values.get(activeKey) ?? [];
      if (match[2].trim()) {
        current.push(match[2].trim());
      }
      values.set(activeKey, current);
      continue;
    }

    if (activeKey) {
      values.set(activeKey, [...(values.get(activeKey) ?? []), line]);
    }
  }

  const checkedItems = values.get('checked items')?.join(' ') ?? '';
  const workDone = values.get('work done')?.join(' ') ?? '';
  const items = splitItems(kind === 'checked' ? checkedItems : workDone);
  const company = values.get('company')?.join(' ') ?? '';
  const mechanic = values.get('mechanic')?.join(' ') ?? '';
  const notes = values.get('notes')?.join('\n') ?? '';
  const hasRepairWork = kind === 'serviced' && items.some((item) => /repair|repaired|replace|replaced|tyre|bearing|weld/i.test(item));

  return {
    kind,
    label: kind === 'checked' ? 'Checked' : hasRepairWork ? 'Serviced / repaired' : 'Serviced',
    items,
    company,
    mechanic,
    notes,
    event,
  };
}

function renderMaintenanceEntry(asset: AssetRegisterItem, entry: MaintenanceEntry, index: number): string {
  const { event } = entry;
  const locationText = formatLocationText(event.locationText, event.latitude, event.longitude);
  const mapsUrl = buildGoogleMapsUrl(event.latitude, event.longitude);

  return `
    <article class="timelineCard maintenanceCard">
      <div class="timelineHeader">
        <div>
          <span class="timelineEyebrow">Maintenance ${index + 1}</span>
          <h3>${escapeHtml(entry.label)} • ${escapeHtml(formatDateTime(event.createdAtIso))}</h3>
        </div>
        <div class="timelineFlagRow">
          <span class="timelineFlag">${escapeHtml(formatActorType(event.actorType))}</span>
          ${event.photoUrls.length ? `<span class="timelineFlag">${event.photoUrls.length} photo${event.photoUrls.length === 1 ? '' : 's'}</span>` : ''}
          ${mapsUrl ? '<span class="timelineFlag">GPS captured</span>' : ''}
        </div>
      </div>

      <div class="timelineStats">
        <div class="timelineStat">
          <span>Updated by</span>
          <strong>${escapeHtml(asText(event.operatorName) || 'Not captured')}</strong>
        </div>
        <div class="timelineStat">
          <span>Usage at update</span>
          <strong>${escapeHtml(formatEventUsage(asset, event))}</strong>
        </div>
        <div class="timelineStat">
          <span>Company / dealer</span>
          <strong>${escapeHtml(entry.company || '—')}</strong>
        </div>
        <div class="timelineStat">
          <span>Mechanic / technician</span>
          <strong>${escapeHtml(entry.mechanic || '—')}</strong>
        </div>
        <div class="timelineStat timelineStatWide">
          <span>Location</span>
          <strong>${escapeHtml(locationText)}</strong>
          ${mapsUrl ? `<a class="inlineLink" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">Open in Google Maps</a>` : ''}
        </div>
      </div>

      <div class="timelineNoteBlock">
        <span>${entry.kind === 'checked' ? 'Checked items' : 'Work completed'}</span>
        <p>${entry.items.length ? escapeHtml(entry.items.join(', ')) : 'No item list captured.'}</p>
      </div>

      ${
        entry.notes
          ? `
            <div class="timelineNoteBlock">
              <span>Notes</span>
              <p>${escapeHtml(entry.notes).replace(/\n/g, '<br />')}</p>
            </div>
          `
          : ''
      }

      ${renderPhotoStrip(event.photoUrls)}
    </article>
  `;
}

function renderKeyValueRows(rows: KeyValueRow[]): string {
  return rows
    .map(
      (row) => `
        <div class="keyValueRow">
          <span class="keyValueLabel">${escapeHtml(row.label)}</span>
          <span class="keyValueValue">${row.valueHtml ?? escapeHtml(row.value)}</span>
        </div>
      `,
    )
    .join('');
}

function renderFuelTable(asset: AssetRegisterItem, events: ScanEventRecord[]): string {
  if (!events.length) {
    return '<div class="emptyState">No fuel readings have been recorded for this asset yet. Once fuel is captured from the QR page, this report will list the date, usage reading and tank percentage.</div>';
  }

  return `
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Usage reading</th>
            <th>Fuel</th>
            <th>Updated by</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          ${events
            .map((event) => {
              const mapsUrl = buildGoogleMapsUrl(event.latitude, event.longitude);
              const locationText = formatLocationText(event.locationText, event.latitude, event.longitude);

              return `
                <tr>
                  <td>${escapeHtml(formatDateTime(event.createdAtIso))}</td>
                  <td>${escapeHtml(formatEventUsage(asset, event))}</td>
                  <td><strong>${escapeHtml(formatFuel(event.fuelPercent))}</strong></td>
                  <td>${escapeHtml(asText(event.operatorName) || 'Not captured')}</td>
                  <td>${mapsUrl ? `<a class="inlineLink" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">${escapeHtml(locationText)}</a>` : escapeHtml(locationText)}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function buildCommonAssetRows(asset: AssetRegisterItem): KeyValueRow[] {
  return [
    { label: 'Title', value: asset.title || '—' },
    { label: 'Plate label', value: asset.plateLabel || '—' },
    { label: 'Public asset code', value: asset.publicAssetCode || '—' },
    { label: 'Serial number', value: asset.serialNumber || '—' },
    { label: 'QR status', value: formatQrStatus(asset.qrStatus) },
  ];
}

function buildCurrentSnapshotRows(asset: AssetRegisterItem): KeyValueRow[] {
  const latestMapsUrl = buildGoogleMapsUrl(asset.lastKnownLat, asset.lastKnownLng);

  return [
    { label: 'Current usage', value: formatLatestUsage(asset) },
    { label: 'Current fuel', value: formatFuel(asset.fuelPercent) },
    { label: 'Last scanned', value: formatDateTime(asset.lastScannedAtIso) },
    { label: 'Last known location', value: formatLocationText(asset.lastKnownLocationText, asset.lastKnownLat, asset.lastKnownLng) },
    {
      label: 'Map link',
      value: latestMapsUrl ? 'Open latest position' : '—',
      valueHtml: latestMapsUrl ? `<a class="inlineLink" href="${escapeHtml(latestMapsUrl)}" target="_blank" rel="noreferrer">Open latest position</a>` : undefined,
    },
  ];
}

function buildBaseStats(asset: AssetRegisterItem, events: ScanEventRecord[]): ReportStat[] {
  const latestEvent = events[0] ?? null;
  const oldestEvent = events[events.length - 1] ?? null;
  const scansWithPhotos = events.filter((event) => event.photoUrls.length > 0).length;
  const gpsCapturedCount = events.filter(
    (event) => typeof event.latitude === 'number' && Number.isFinite(event.latitude) && typeof event.longitude === 'number' && Number.isFinite(event.longitude),
  ).length;
  const notesCount = events.filter((event) => Boolean(asText(event.note))).length;

  return [
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
      note: scansWithPhotos ? 'Useful for owner, bank, insurance and workshop proof.' : 'No photo evidence captured yet.',
    },
    {
      label: 'Current usage',
      value: formatLatestUsage(asset),
      note: latestEvent ? `Latest QR activity: ${formatDateTime(latestEvent.createdAtIso)}.` : 'No QR activity has been recorded yet.',
    },
    {
      label: 'Current fuel',
      value: formatFuel(asset.fuelPercent),
      note: notesCount ? `${notesCount} QR update${notesCount === 1 ? '' : 's'} included notes or comments.` : 'No notes have been added through QR updates yet.',
    },
  ];
}

function buildFuelStats(events: ScanEventRecord[]): ReportStat[] {
  const fuelValues = events
    .map((event) => event.fuelPercent)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const latestFuelEvent = events[0] ?? null;
  const lowestFuel = fuelValues.length ? Math.min(...fuelValues) : null;
  const highestFuel = fuelValues.length ? Math.max(...fuelValues) : null;
  const averageFuel = fuelValues.length ? fuelValues.reduce((sum, value) => sum + value, 0) / fuelValues.length : null;
  const lowFuelCount = fuelValues.filter((value) => value <= 25).length;

  return [
    {
      label: 'Fuel entries',
      value: String(events.length),
      note: latestFuelEvent ? `Latest fuel capture ${formatDateTime(latestFuelEvent.createdAtIso)}.` : 'No fuel entries recorded yet.',
    },
    {
      label: 'Latest fuel',
      value: formatFuel(latestFuelEvent?.fuelPercent),
      note: latestFuelEvent ? 'Most recent tank percentage captured from the QR page.' : 'Capture fuel from the QR page to populate this report.',
    },
    {
      label: 'Lowest fuel',
      value: formatFuel(lowestFuel),
      note: lowFuelCount ? `${lowFuelCount} reading${lowFuelCount === 1 ? '' : 's'} at or below 25%.` : 'No low-fuel readings captured.',
    },
    {
      label: 'Highest fuel',
      value: formatFuel(highestFuel),
      note: highestFuel !== null ? 'Highest recorded tank percentage.' : 'No readings available.',
    },
    {
      label: 'Average fuel',
      value: formatFuel(averageFuel),
      note: averageFuel !== null ? 'Simple average across captured fuel readings.' : 'No readings available.',
    },
    {
      label: 'GPS-backed entries',
      value: String(
        events.filter(
          (event) => typeof event.latitude === 'number' && Number.isFinite(event.latitude) && typeof event.longitude === 'number' && Number.isFinite(event.longitude),
        ).length,
      ),
      note: 'Fuel readings with a saved scan position.',
    },
  ];
}

function buildMaintenanceStats(entries: MaintenanceEntry[]): ReportStat[] {
  const checkedCount = entries.filter((entry) => entry.kind === 'checked').length;
  const servicedCount = entries.filter((entry) => entry.kind === 'serviced').length;
  const latestEntry = entries[0] ?? null;
  const gpsCount = entries.filter(
    (entry) => typeof entry.event.latitude === 'number' && Number.isFinite(entry.event.latitude) && typeof entry.event.longitude === 'number' && Number.isFinite(entry.event.longitude),
  ).length;
  const photoCount = entries.filter((entry) => entry.event.photoUrls.length > 0).length;
  const uniqueItems = new Set(entries.flatMap((entry) => entry.items));

  return [
    {
      label: 'Maintenance records',
      value: String(entries.length),
      note: latestEntry ? `Latest record ${formatDateTime(latestEntry.event.createdAtIso)}.` : 'No check or service records captured yet.',
    },
    {
      label: 'Checked records',
      value: String(checkedCount),
      note: 'Quick inspection records saved from the QR page.',
    },
    {
      label: 'Service / repair records',
      value: String(servicedCount),
      note: 'Workshop, dealer, mechanic or repair records saved from the QR page.',
    },
    {
      label: 'Unique items recorded',
      value: String(uniqueItems.size),
      note: uniqueItems.size ? 'Distinct checked or serviced items across the report.' : 'No maintenance items captured yet.',
    },
    {
      label: 'GPS-backed records',
      value: String(gpsCount),
      note: 'Maintenance records with a saved scan position.',
    },
    {
      label: 'Photo-backed records',
      value: String(photoCount),
      note: photoCount ? 'Maintenance records with photo evidence.' : 'No photo evidence captured for maintenance yet.',
    },
  ];
}

function buildReportHtml(options: {
  reportKind: ScanReportKind;
  ownerLabel: string;
  asset: AssetRegisterItem;
  generatedAt: string;
  stats: ReportStat[];
  heroMeta: string;
  bodyHtml: string;
  footerNote: string;
}): string {
  const reportTitle = REPORT_LABELS[options.reportKind];
  const latestMapsUrl = buildGoogleMapsUrl(options.asset.lastKnownLat, options.asset.lastKnownLng);
  const assetPhotoUrl = normalizeImageSrc(options.asset.photos[0] ?? null);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.asset.title)} ${escapeHtml(reportTitle)}</title>
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
      .screenBarText { color: var(--muted); font-size: 0.92rem; line-height: 1.45; }
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
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .documentMeta { text-align: right; color: var(--muted); display: grid; gap: 0.2rem; font-size: 0.8rem; }
      .documentMetaLabel { text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; color: #7d928c; }
      .documentMetaValue { color: var(--text); font-weight: 800; }
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 20rem;
        gap: 1.4rem;
        padding: 1.65rem 2rem;
        background: linear-gradient(135deg, #ffffff 0%, #f7fbf9 100%);
      }
      .heroTitle { margin: 0.8rem 0 0.55rem; font-size: clamp(2rem, 5vw, 3.2rem); line-height: 0.96; letter-spacing: -0.055em; }
      .heroMeta { margin: 0; max-width: 48rem; color: var(--muted); line-height: 1.65; }
      .heroValueCard {
        align-self: stretch;
        border-radius: 1.35rem;
        background: #102f28;
        color: #ffffff;
        padding: 1.25rem;
        display: grid;
        gap: 0.75rem;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
      }
      .heroValueLabel { color: rgba(255,255,255,0.72); font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
      .heroValueAmount { font-size: 2rem; line-height: 1; letter-spacing: -0.04em; word-break: break-word; }
      .heroBadgeRow { display:flex; gap:0.45rem; flex-wrap:wrap; }
      .heroBadge { border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.09); color:#ffffff; border-radius:999px; padding:0.35rem 0.58rem; font-size:0.75rem; font-weight:800; }
      .heroValueMeta { color: rgba(255,255,255,0.72); font-size: 0.86rem; line-height: 1.55; }
      .content { padding: 1.2rem 2rem 1.55rem; display: grid; gap: 1rem; }
      .statsGrid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:0.8rem; }
      .statCard { border:1px solid rgba(17,56,45,0.09); border-radius:1.15rem; padding:1rem; background:#ffffff; display:grid; gap:0.35rem; }
      .statValue { font-size:1.45rem; letter-spacing:-0.04em; color:var(--brand-dark); }
      .statLabel { color:var(--text); font-size:0.82rem; font-weight:850; text-transform:uppercase; letter-spacing:0.07em; }
      .statNote { color:var(--muted); font-size:0.82rem; line-height:1.45; }
      .gridTwo { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:1rem; }
      .card { border:1px solid rgba(17,56,45,0.09); border-radius:1.35rem; background:#ffffff; padding:1.15rem; break-inside: avoid; }
      .cardTitle { margin:0 0 0.9rem; font-size:1rem; letter-spacing:-0.02em; }
      .keyValueList { display:grid; gap:0.58rem; }
      .keyValueRow { display:grid; grid-template-columns: 10rem minmax(0,1fr); gap:0.75rem; padding-bottom:0.58rem; border-bottom:1px solid rgba(17,56,45,0.07); }
      .keyValueRow:last-child { border-bottom:0; padding-bottom:0; }
      .keyValueLabel { color:var(--muted); font-size:0.82rem; }
      .keyValueValue { color:var(--text); font-weight:800; word-break:break-word; }
      .photoFrame { overflow:hidden; border-radius:1.2rem; border:1px solid rgba(17,56,45,0.08); background:#f8fbf9; }
      .photoFrame img { display:block; width:100%; max-height:20rem; object-fit:cover; }
      .timelineGrid { display:grid; gap:1rem; }
      .timelineCard { border:1px solid rgba(17,56,45,0.1); border-radius:1.25rem; background:#ffffff; padding:1rem; break-inside: avoid; }
      .timelineHeader { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; margin-bottom:0.9rem; }
      .timelineHeader h3 { margin:0.25rem 0 0; font-size:1.06rem; letter-spacing:-0.025em; }
      .timelineEyebrow { color:var(--muted); font-size:0.76rem; font-weight:850; letter-spacing:0.08em; text-transform:uppercase; }
      .timelineFlagRow { display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end; }
      .timelineFlag { border:1px solid rgba(28,90,76,0.13); background:var(--brand-soft); color:var(--brand-mid); border-radius:999px; padding:0.32rem 0.5rem; font-size:0.72rem; font-weight:850; }
      .timelineStats { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:0.65rem; }
      .timelineStat { border:1px solid rgba(17,56,45,0.07); background:#fbfdfc; border-radius:0.9rem; padding:0.78rem; display:grid; gap:0.3rem; }
      .timelineStatWide { grid-column: span 4; }
      .timelineStat span { color:var(--muted); font-size:0.76rem; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; }
      .timelineStat strong { color:var(--text); font-size:0.9rem; line-height:1.35; word-break:break-word; }
      .inlineLink { color:var(--brand-mid); text-decoration:none; font-weight:700; }
      .inlineLink:hover { text-decoration:underline; }
      .timelineNoteBlock { margin-top:0.85rem; padding:0.9rem; border-radius:1rem; background:#f8fbf9; border:1px solid rgba(17,56,45,0.08); }
      .timelineNoteBlock span { color:var(--muted); font-size:0.76rem; font-weight:850; letter-spacing:0.08em; text-transform:uppercase; }
      .timelineNoteBlock p { margin:0.35rem 0 0; color:var(--text); line-height:1.65; }
      .photoStrip { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:0.75rem; margin-top:0.9rem; }
      .photoTile { margin:0; overflow:hidden; border-radius:1rem; border:1px solid rgba(17,56,45,0.08); background:#ffffff; }
      .photoTile img { display:block; width:100%; height:8.5rem; object-fit:cover; }
      .emptyState { padding:1rem 1.1rem; border-radius:1.2rem; border:1px dashed rgba(17,56,45,0.16); background:#ffffff; color:var(--muted); line-height:1.65; }
      .tableWrap { overflow-x:auto; border:1px solid rgba(17,56,45,0.09); border-radius:1.1rem; }
      table { width:100%; border-collapse:collapse; background:#ffffff; }
      th, td { padding:0.82rem 0.9rem; text-align:left; border-bottom:1px solid rgba(17,56,45,0.07); vertical-align:top; font-size:0.86rem; }
      th { background:#f7faf8; color:var(--muted); font-size:0.75rem; font-weight:850; letter-spacing:0.08em; text-transform:uppercase; }
      tr:last-child td { border-bottom:0; }
      .footer { padding: 0 2rem 1.8rem; color: var(--muted); font-size:0.82rem; line-height:1.55; }
      @media (max-width: 900px) {
        .hero, .gridTwo, .statsGrid, .timelineStats { grid-template-columns: 1fr; }
        .timelineStatWide { grid-column: span 1; }
        .photoStrip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .keyValueRow { grid-template-columns: 1fr; gap:0.2rem; }
      }
      @media print {
        html, body { background:#ffffff; }
        .screenBar { display:none !important; }
        .page { width:100%; margin:0; border-radius:0; box-shadow:none; }
        a.inlineLink { color: var(--text); text-decoration:none; }
        .card, .timelineCard, .statCard { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="screenBar">
      <div class="screenBarText">
        <strong>${escapeHtml(reportTitle)}</strong><br />
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
            <span class="documentKicker">${escapeHtml(reportTitle)}</span>
          </div>
        </div>
        <div class="documentMeta">
          <span class="documentMetaLabel">Generated</span>
          <span class="documentMetaValue">${escapeHtml(options.generatedAt)}</span>
        </div>
      </header>

      <section class="hero">
        <div>
          <span class="documentKicker">QR operational record</span>
          <h1 class="heroTitle">${escapeHtml(options.asset.title)}</h1>
          <p class="heroMeta">${escapeHtml(options.heroMeta)}</p>
        </div>

        <aside class="heroValueCard">
          <span class="heroValueLabel">Asset reference</span>
          <strong class="heroValueAmount">${escapeHtml(options.asset.plateLabel || options.asset.publicAssetCode || options.asset.id)}</strong>
          <div class="heroBadgeRow">
            <span class="heroBadge">${escapeHtml(formatQrStatus(options.asset.qrStatus))}</span>
            <span class="heroBadge">${escapeHtml(options.ownerLabel)}</span>
          </div>
          <div class="heroValueMeta">Latest scan: ${escapeHtml(formatDateTime(options.asset.lastScannedAtIso))}<br />Latest location: ${escapeHtml(formatLocationText(options.asset.lastKnownLocationText, options.asset.lastKnownLat, options.asset.lastKnownLng))}${latestMapsUrl ? `<br /><a class="inlineLink" href="${escapeHtml(latestMapsUrl)}" target="_blank" rel="noreferrer">Open latest position</a>` : ''}</div>
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
            <div class="keyValueList">${renderKeyValueRows(buildCommonAssetRows(options.asset))}</div>
          </article>

          <article class="card">
            <h2 class="cardTitle">Current operational snapshot</h2>
            <div class="keyValueList">${renderKeyValueRows(buildCurrentSnapshotRows(options.asset))}</div>
          </article>
        </section>

        ${assetPhotoUrl ? `
          <section class="card">
            <h2 class="cardTitle">Current asset image</h2>
            <div class="photoFrame">
              <img src="${escapeHtml(assetPhotoUrl)}" alt="${escapeHtml(options.asset.title)}" />
            </div>
          </section>
        ` : ''}

        ${options.bodyHtml}
      </main>

      <footer class="footer">${escapeHtml(options.footerNote)}</footer>
    </div>
  </body>
</html>`;
}

function buildScanReport(asset: AssetRegisterItem, events: ScanEventRecord[], ownerLabel: string, generatedAt: string): string {
  return buildReportHtml({
    reportKind: 'scan',
    ownerLabel,
    asset,
    generatedAt,
    stats: buildBaseStats(asset, events),
    heroMeta:
      'Complete QR scan history for this asset, including who updated it, usage readings, fuel readings, service/check notes, photo-backed updates and saved GPS positions.',
    bodyHtml: `
      <section class="card">
        <h2 class="cardTitle">QR update timeline</h2>
        ${events.length ? `<div class="timelineGrid">${events.map((event, index) => renderEventCard(asset, event, index)).join('')}</div>` : '<div class="emptyState">No QR scan updates have been recorded for this asset yet. Once the machine is scanned and updated, this report will show time-stamped usage, fuel, GPS-backed locations, notes and photos.</div>'}
      </section>
    `,
    footerNote:
      'Aim4price scan report. This document focuses on operational QR activity only — scan events, latest GPS-backed position, usage, fuel, notes, service/check records and captured photos.',
  });
}

function buildFuelReport(asset: AssetRegisterItem, events: ScanEventRecord[], ownerLabel: string, generatedAt: string): string {
  const fuelEvents = events.filter((event) => typeof event.fuelPercent === 'number' && Number.isFinite(event.fuelPercent));

  return buildReportHtml({
    reportKind: 'fuel',
    ownerLabel,
    asset,
    generatedAt,
    stats: buildFuelStats(fuelEvents),
    heroMeta:
      'Focused fuel record for this asset. It lists each QR fuel capture with the date, usage reading, tank percentage, operator and saved location. This is ready to tie into the future Fuel Tracker / Fuel Tank system.',
    bodyHtml: `
      <section class="card">
        <h2 class="cardTitle">Fuel readings</h2>
        ${renderFuelTable(asset, fuelEvents)}
      </section>
    `,
    footerNote:
      'Aim4price fuel report. This document only includes QR updates where a fuel percentage was captured. It is intended as an operational record and can later be connected to Fuel Tracker / Fuel Tank workflows.',
  });
}

function buildMaintenanceReport(asset: AssetRegisterItem, events: ScanEventRecord[], ownerLabel: string, generatedAt: string): string {
  const maintenanceEntries = events
    .map((event) => parseMaintenanceEvent(event))
    .filter((entry): entry is MaintenanceEntry => Boolean(entry));

  return buildReportHtml({
    reportKind: 'maintenance',
    ownerLabel,
    asset,
    generatedAt,
    stats: buildMaintenanceStats(maintenanceEntries),
    heroMeta:
      'Focused maintenance record for this asset. It lists checks, services and repair-type work captured from the QR page, including date, operator, usage reading, company, mechanic, notes, photos and location.',
    bodyHtml: `
      <section class="card">
        <h2 class="cardTitle">Maintenance timeline</h2>
        ${maintenanceEntries.length ? `<div class="timelineGrid">${maintenanceEntries.map((entry, index) => renderMaintenanceEntry(asset, entry, index)).join('')}</div>` : '<div class="emptyState">No maintenance records have been captured for this asset yet. Once a Checked or Serviced update is saved from the QR page, it will appear here with the date, selected items, notes and location.</div>'}
      </section>
    `,
    footerNote:
      'Aim4price maintenance report. This document includes QR updates saved as checked, serviced or repair-type records. It is intended as an operational maintenance trail, not as a certified mechanical inspection.',
  });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth', request.url), { status: 302 });
  }

  const assetId = asText(request.nextUrl.searchParams.get('assetId'));
  const reportKind = normalizeReportKind(
    request.nextUrl.searchParams.get('report') ??
      request.nextUrl.searchParams.get('reportType') ??
      request.nextUrl.searchParams.get('type'),
  );

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Asset ID is required.' }, { status: 400 });
  }

  const asset = await getAssetRegisterItemById(session.user.id, assetId);

  if (!asset) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }

  const events = await listScanEventsForAsset(asset.id, 500);
  const ownerLabel = asText(session.user.name) || asText(session.user.email) || 'Owner session';
  const generatedAt = formatDateTime(new Date().toISOString());

  const html = reportKind === 'fuel'
    ? buildFuelReport(asset, events, ownerLabel, generatedAt)
    : reportKind === 'maintenance'
      ? buildMaintenanceReport(asset, events, ownerLabel, generatedAt)
      : buildScanReport(asset, events, ownerLabel, generatedAt);

  const fileName = `${slugifyFileSegment(asset.title)}-${slugifyFileSegment(asset.plateLabel || asset.publicAssetCode || asset.id)}-${slugifyFileSegment(REPORT_LABELS[reportKind])}.html`;

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
