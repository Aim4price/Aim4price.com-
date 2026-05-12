import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterItemById, type AssetRegisterItem } from '../../../../lib/asset-register-db';
import { listScanEventsForAsset, type ScanEventRecord } from '../../../../lib/scan-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScanReportKind = 'scan' | 'fuel' | 'maintenance';

type KeyValueRow = {
  label: string;
  value: string;
  valueHtml?: string;
};

type ReportSummary = {
  label: string;
  value: string;
  subtext: string;
  basis: string;
  updated: string;
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
  fuel: 'Fuel Report',
  scan: 'Scan Report',
  maintenance: 'Maintenance Report',
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

function normalizeSpaces(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function displayValue(value: unknown, fallback = '-'): string {
  const text = normalizeSpaces(value);
  return text || fallback;
}

function slugifyFileSegment(value: string): string {
  return (
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'asset'
  );
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
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';

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
    return '-';
  }

  return Math.round(value).toLocaleString('en-ZA');
}

function formatNumber(value: number | null | undefined, digits = 0): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  return value.toLocaleString('en-ZA', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatFuel(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  const rounded = Math.max(0, Math.min(100, Math.round(value * 10) / 10));
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}%`;
}

function formatBoolean(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function formatQrStatus(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  return (
    {
      active: 'Active',
      transferred: 'Transferred',
      retired: 'Retired',
      deleted: 'Deleted',
    }[normalized] ?? 'Pending'
  );
}

function formatActorType(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  return (
    {
      scan_pin: 'Farm PIN',
      owner_session: 'Owner session',
      admin_session: 'Manager / admin',
    }[normalized] ?? 'Farm PIN'
  );
}

function formatCondition(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  return (
    {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      used: 'Used',
      serious: 'Requires attention',
    }[normalized] ?? displayValue(value)
  );
}

function formatAssetKind(asset: AssetRegisterItem): string {
  if (asset.kind === 'vehicle') return 'Vehicle';
  if (asset.kind === 'tractor') return 'Tractor';
  if (asset.kind === 'equipment') return displayValue(asset.equipmentFamilyLabel, 'Equipment');
  if (asset.kind === 'tools') return 'Tools / implements';
  if (asset.kind === 'property') return 'Property';
  return 'Asset';
}

function formatCoordinates(latitude: number | null, longitude: number | null): string {
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude)
  ) {
    return '';
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatLocationText(locationText: string, latitude: number | null, longitude: number | null): string {
  const normalized = asText(locationText);
  const coordinates = formatCoordinates(latitude, longitude);

  if (normalized && coordinates) {
    return `${normalized} - ${coordinates}`;
  }

  if (normalized) {
    return normalized;
  }

  return coordinates || '-';
}

function buildGoogleMapsUrl(latitude: number | null, longitude: number | null): string | null {
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude)
  ) {
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

  return '-';
}

function formatLatestUsage(asset: AssetRegisterItem): string {
  if (typeof asset.hours === 'number' && Number.isFinite(asset.hours)) {
    return `${formatInteger(asset.hours)} ${getUsageUnit(asset)}`;
  }

  if (typeof asset.lifeWorkedPercent === 'number' && Number.isFinite(asset.lifeWorkedPercent)) {
    return `${formatPercent(asset.lifeWorkedPercent)} worked`;
  }

  return '-';
}

function formatAssetHeroMeta(asset: AssetRegisterItem): string {
  const parts: string[] = [];

  if (typeof asset.yearModel === 'number' && Number.isFinite(asset.yearModel)) {
    parts.push(`Year Model: ${asset.yearModel}`);
  }

  const usage = formatLatestUsage(asset);
  if (usage !== '-') {
    parts.push(`Usage: ${usage}`);
  }

  const condition = formatCondition(asset.condition);
  if (condition !== '-') {
    parts.push(`Condition: ${condition}`);
  }

  return parts.length ? parts.join(' • ') : 'QR asset register operational report';
}

function splitItems(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function extractLabeledValue(text: string, label: string): string {
  const labels = ['Checked items', 'Work done', 'Company', 'Mechanic', 'Notes'];
  const otherLabels = labels.filter((entry) => entry.toLowerCase() !== label.toLowerCase()).map((entry) => `${entry}:`).join('|');
  const pattern = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\s+(?:${otherLabels})|$)`, 'i');
  const match = text.match(pattern);

  return normalizeSpaces(match?.[1] ?? '');
}

function parseMaintenanceEvent(event: ScanEventRecord): MaintenanceEntry | null {
  const note = asText(event.note);
  if (!note) return null;

  const compactNote = normalizeSpaces(note);
  const firstLine = note
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0]
    ?.toLowerCase() ?? '';

  let kind: MaintenanceKind | null = null;

  if (/^checked\b/i.test(compactNote) || firstLine.includes('checked') || /checked items:/i.test(compactNote)) {
    kind = 'checked';
  }

  if (/^serviced\b/i.test(compactNote) || firstLine.includes('serviced') || /work done:/i.test(compactNote)) {
    kind = 'serviced';
  }

  if (!kind) {
    return null;
  }

  const checkedItems = extractLabeledValue(note, 'Checked items');
  const workDone = extractLabeledValue(note, 'Work done');
  const items = splitItems(kind === 'checked' ? checkedItems : workDone);
  const company = extractLabeledValue(note, 'Company');
  const mechanic = extractLabeledValue(note, 'Mechanic');
  const notes = extractLabeledValue(note, 'Notes');
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

function summarizeScanEvent(asset: AssetRegisterItem, event: ScanEventRecord): string {
  const maintenanceEntry = parseMaintenanceEvent(event);
  if (maintenanceEntry) {
    const items = maintenanceEntry.items.length ? `: ${maintenanceEntry.items.join(', ')}` : '';
    return `${maintenanceEntry.label}${items}`;
  }

  const note = normalizeSpaces(event.note);
  if (note) {
    return note.length > 180 ? `${note.slice(0, 177)}...` : note;
  }

  const parts = [
    formatEventUsage(asset, event) !== '-' ? `Usage ${formatEventUsage(asset, event)}` : '',
    formatFuel(event.fuelPercent) !== '-' ? `Fuel ${formatFuel(event.fuelPercent)}` : '',
    formatCondition(event.condition) !== '-' ? `Condition ${formatCondition(event.condition)}` : '',
  ].filter(Boolean);

  return parts.join(' • ') || 'QR scan recorded';
}

function renderRows(rows: KeyValueRow[], emptyText = 'No details available.'): string {
  const visibleRows = rows.filter((row) => String(row.label ?? '').trim());

  if (!visibleRows.length) {
    return `<div class="assetReportEmpty">${escapeHtml(emptyText)}</div>`;
  }

  return `
    <div class="assetReportRows">
      ${visibleRows
        .map(
          (row) => `
            <div class="assetReportRow">
              <span>${escapeHtml(row.label)}</span>
              <strong>${row.valueHtml ?? escapeHtml(displayValue(row.value))}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderTable(options: { className?: string; headers: string[]; rows: string[][]; emptyText: string }): string {
  if (!options.rows.length) {
    return `<div class="assetReportEmpty">${escapeHtml(options.emptyText)}</div>`;
  }

  return `
    <div class="assetReportTableWrap ${escapeHtml(options.className ?? '')}">
      <table class="assetReportTable">
        <thead>
          <tr>${options.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${options.rows
            .map(
              (row) => `
                <tr>
                  ${row.map((cell) => `<td>${cell}</td>`).join('')}
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function buildAssetDetailRows(asset: AssetRegisterItem): KeyValueRow[] {
  return [
    { label: 'Category', value: formatAssetKind(asset) },
    { label: 'Brand', value: asset.brandName || asset.title || '-' },
    { label: 'Model', value: asset.modelName || asset.typedModelName || '-' },
    { label: 'Year', value: typeof asset.yearModel === 'number' ? String(asset.yearModel) : '-' },
    { label: 'Usage', value: formatLatestUsage(asset) },
    { label: 'Condition', value: formatCondition(asset.condition) },
  ];
}

function buildClientRows(options: { ownerName: string; ownerEmail: string; asset: AssetRegisterItem }): KeyValueRow[] {
  return [
    { label: 'Name', value: options.ownerName || '-' },
    { label: 'Email', value: options.ownerEmail || '-' },
    { label: 'Phone', value: options.asset.sellerPhone || '-' },
    { label: 'Address', value: '-' },
  ];
}

function buildLocationRows(asset: AssetRegisterItem): KeyValueRow[] {
  const mapsUrl = buildGoogleMapsUrl(asset.lastKnownLat, asset.lastKnownLng);

  return [
    { label: 'Last Scanned', value: formatDateTime(asset.lastScannedAtIso) },
    { label: 'Last Location', value: formatLocationText(asset.lastKnownLocationText, asset.lastKnownLat, asset.lastKnownLng) },
    {
      label: 'Map Link',
      value: mapsUrl ? 'Open latest position' : '-',
      valueHtml: mapsUrl ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">Open latest position</a>` : undefined,
    },
  ];
}

function buildScanRecordRows(asset: AssetRegisterItem, events: ScanEventRecord[]): KeyValueRow[] {
  const fuelEvents = events.filter((event) => typeof event.fuelPercent === 'number' && Number.isFinite(event.fuelPercent));
  const maintenanceEntries = events.map((event) => parseMaintenanceEvent(event)).filter((entry): entry is MaintenanceEntry => Boolean(entry));
  const gpsEvents = events.filter(
    (event) =>
      typeof event.latitude === 'number' &&
      Number.isFinite(event.latitude) &&
      typeof event.longitude === 'number' &&
      Number.isFinite(event.longitude),
  );
  const photoEvents = events.filter((event) => event.photoUrls.length > 0);

  return [
    { label: 'Serial Number', value: asset.serialNumber || '-' },
    { label: 'QR Status', value: formatQrStatus(asset.qrStatus) },
    { label: 'Total Scans', value: String(events.length) },
    { label: 'Fuel Entries', value: String(fuelEvents.length) },
    { label: 'Maintenance', value: String(maintenanceEntries.length) },
    { label: 'GPS Locations', value: String(gpsEvents.length) },
    { label: 'Photo Updates', value: String(photoEvents.length) },
    { label: 'Updated', value: formatDate(asset.lastScannedAtIso || asset.updatedAtIso) },
  ];
}

function buildFuelRecordRows(asset: AssetRegisterItem, fuelEvents: ScanEventRecord[]): KeyValueRow[] {
  const fuelValues = fuelEvents
    .map((event) => event.fuelPercent)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const averageFuel = fuelValues.length ? fuelValues.reduce((sum, value) => sum + value, 0) / fuelValues.length : null;

  return [
    { label: 'Serial Number', value: asset.serialNumber || '-' },
    { label: 'Fuel Entries', value: String(fuelEvents.length) },
    { label: 'Latest Fuel', value: formatFuel(fuelEvents[0]?.fuelPercent) },
    { label: 'Lowest Fuel', value: formatFuel(fuelValues.length ? Math.min(...fuelValues) : null) },
    { label: 'Highest Fuel', value: formatFuel(fuelValues.length ? Math.max(...fuelValues) : null) },
    { label: 'Average Fuel', value: formatFuel(averageFuel) },
    { label: 'Updated', value: formatDate(fuelEvents[0]?.createdAtIso || asset.lastScannedAtIso || asset.updatedAtIso) },
  ];
}

function buildMaintenanceRecordRows(asset: AssetRegisterItem, entries: MaintenanceEntry[]): KeyValueRow[] {
  const checkedCount = entries.filter((entry) => entry.kind === 'checked').length;
  const servicedCount = entries.filter((entry) => entry.kind === 'serviced').length;
  const gpsCount = entries.filter(
    (entry) =>
      typeof entry.event.latitude === 'number' &&
      Number.isFinite(entry.event.latitude) &&
      typeof entry.event.longitude === 'number' &&
      Number.isFinite(entry.event.longitude),
  ).length;
  const photoCount = entries.filter((entry) => entry.event.photoUrls.length > 0).length;

  return [
    { label: 'Serial Number', value: asset.serialNumber || '-' },
    { label: 'Records', value: String(entries.length) },
    { label: 'Checked', value: String(checkedCount) },
    { label: 'Serviced', value: String(servicedCount) },
    { label: 'GPS Locations', value: String(gpsCount) },
    { label: 'Photo Records', value: String(photoCount) },
    { label: 'Updated', value: formatDate(entries[0]?.event.createdAtIso || asset.lastScannedAtIso || asset.updatedAtIso) },
  ];
}

function buildScanReportSummary(asset: AssetRegisterItem, events: ScanEventRecord[]): ReportSummary {
  return {
    label: 'QR Scans',
    value: formatNumber(events.length),
    subtext: 'stored QR updates',
    basis: 'QR Activity',
    updated: formatDate(events[0]?.createdAtIso || asset.lastScannedAtIso || asset.updatedAtIso),
  };
}

function buildFuelReportSummary(asset: AssetRegisterItem, fuelEvents: ScanEventRecord[]): ReportSummary {
  return {
    label: 'Fuel Entries',
    value: formatNumber(fuelEvents.length),
    subtext: fuelEvents.length === 1 ? 'QR fuel reading' : 'QR fuel readings',
    basis: 'QR Fuel',
    updated: formatDate(fuelEvents[0]?.createdAtIso || asset.lastScannedAtIso || asset.updatedAtIso),
  };
}

function buildMaintenanceReportSummary(asset: AssetRegisterItem, entries: MaintenanceEntry[]): ReportSummary {
  return {
    label: 'Maintenance',
    value: formatNumber(entries.length),
    subtext: entries.length === 1 ? 'check / service record' : 'check / service records',
    basis: 'QR Maintenance',
    updated: formatDate(entries[0]?.event.createdAtIso || asset.lastScannedAtIso || asset.updatedAtIso),
  };
}

function buildFuelBody(asset: AssetRegisterItem, events: ScanEventRecord[]): string {
  const rows = events.map((event) => [
    escapeHtml(formatDateTime(event.createdAtIso)),
    escapeHtml(formatEventUsage(asset, event)),
    `<strong>${escapeHtml(formatFuel(event.fuelPercent))}</strong>`,
    escapeHtml(formatLocationText(event.locationText, event.latitude, event.longitude)),
  ]);

  return `
    <section class="assetReportSection assetReportWideSection">
      <h2>Fuel Readings</h2>
      ${renderTable({
        headers: ['Date', 'Usage', 'Fuel', 'Scan Location'],
        rows,
        emptyText: 'No fuel readings have been recorded for this asset yet.',
      })}
    </section>
  `;
}

function buildScanBody(asset: AssetRegisterItem, events: ScanEventRecord[]): string {
  const rows = events.map((event) => [
    escapeHtml(formatDateTime(event.createdAtIso)),
    escapeHtml(formatEventUsage(asset, event)),
    escapeHtml(formatFuel(event.fuelPercent)),
    escapeHtml(summarizeScanEvent(asset, event)),
    escapeHtml(formatLocationText(event.locationText, event.latitude, event.longitude)),
  ]);

  return `
    <section class="assetReportSection assetReportWideSection">
      <h2>QR Scan Updates</h2>
      ${renderTable({
        className: 'assetReportScanTable',
        headers: ['Date', 'Usage', 'Fuel', 'Update Summary', 'Location'],
        rows,
        emptyText: 'No QR scan updates have been recorded for this asset yet.',
      })}
    </section>
  `;
}

function buildMaintenanceBody(asset: AssetRegisterItem, entries: MaintenanceEntry[]): string {
  const rows = entries.map((entry) => [
    escapeHtml(formatDateTime(entry.event.createdAtIso)),
    escapeHtml(entry.label),
    escapeHtml(formatEventUsage(asset, entry.event)),
    escapeHtml(entry.items.length ? entry.items.join(', ') : '-'),
    escapeHtml(entry.company || '-'),
    escapeHtml(entry.mechanic || '-'),
    escapeHtml(entry.notes || formatLocationText(entry.event.locationText, entry.event.latitude, entry.event.longitude)),
  ]);

  return `
    <section class="assetReportSection assetReportWideSection">
      <h2>Maintenance Records</h2>
      ${renderTable({
        className: 'assetReportMaintenanceTable',
        headers: ['Date', 'Type', 'Usage', 'Checked / Serviced', 'Company', 'Mechanic', 'Notes / Location'],
        rows,
        emptyText: 'No maintenance records have been captured for this asset yet.',
      })}
    </section>
  `;
}

function buildReportDisclaimer(reportKind: ScanReportKind): string {
  if (reportKind === 'fuel') {
    return 'Fuel readings are operational records captured from QR scan updates. They are intended to support internal asset management and future Fuel Tracker workflows. Final fuel use remains subject to physical verification.';
  }

  if (reportKind === 'maintenance') {
    return 'Maintenance records are based on QR scan updates saved as checked, serviced or repaired. This is an operational maintenance trail and not a certified mechanical inspection report.';
  }

  return 'Scan records are operational records based on QR activity, saved usage readings, fuel percentages, notes, service/check records, photos and locations. This is not a certified inspection report.';
}

function buildReportHtml(options: {
  reportKind: ScanReportKind;
  asset: AssetRegisterItem;
  ownerName: string;
  ownerEmail: string;
  generatedAt: string;
  summary: ReportSummary;
  recordRows: KeyValueRow[];
  bodyHtml: string;
}): string {
  const reportTitle = REPORT_LABELS[options.reportKind];
  const asset = options.asset;
  const safeTitle = escapeHtml(asset.title || 'Asset');
  const disclaimer = buildReportDisclaimer(options.reportKind);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle} - Aim4price ${escapeHtml(reportTitle)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: light;
        --ink: #111827;
        --strong: #070b12;
        --muted: #5f6b7a;
        --faint: #8b95a3;
        --paper: #ffffff;
        --soft: #f5f6f8;
        --soft-2: #fafbfc;
        --line: #d7dde5;
        --line-strong: #b9c2ce;
      }

      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      @page {
        size: A4;
        margin: 8mm 9mm 8mm;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #eef1f4;
        color: var(--ink);
        font-family: "Montserrat", "Segoe UI", Arial, Helvetica, sans-serif;
        font-size: 9.6px;
        line-height: 1.35;
      }

      .assetReportScreenBar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 18px;
        background: rgba(255, 255, 255, 0.96);
        border-bottom: 1px solid #d7dce2;
      }

      .assetReportScreenText {
        color: var(--muted);
        font-size: 13px;
      }

      .assetReportScreenActions {
        display: flex;
        gap: 10px;
      }

      .assetReportButton {
        appearance: none;
        min-height: 38px;
        padding: 0 16px;
        border: 1px solid #cfd5dd;
        border-radius: 999px;
        background: #ffffff;
        color: var(--ink);
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }

      .assetReportButtonPrimary {
        border-color: var(--strong);
        background: var(--strong);
        color: #ffffff;
      }

      .assetReportPage {
        width: min(100%, 210mm);
        min-height: 297mm;
        margin: 18px auto;
        padding: 11mm 11mm 9mm;
        background: var(--paper);
        box-shadow: 0 16px 44px rgba(17, 24, 39, 0.13);
      }

      .assetReportInner {
        position: relative;
        min-height: calc(297mm - 20mm);
        padding-bottom: 20mm;
      }

      .assetReportHeader {
        display: grid;
        grid-template-columns: 22mm minmax(0, 1fr) 62mm;
        gap: 12px;
        align-items: center;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--line-strong);
      }

      .assetReportLogoWrap {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        min-height: 18mm;
      }

      .assetReportLogo {
        display: block;
        width: 18mm;
        height: auto;
        object-fit: contain;
      }

      .assetReportDocumentTitle strong {
        display: block;
        color: var(--strong);
        font-size: 16px;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.025em;
      }

      .assetReportDocumentTitle span {
        display: block;
        margin-top: 5px;
        color: var(--muted);
        font-size: 8.9px;
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      .assetReportHeaderMeta {
        display: grid;
        gap: 4px;
        color: var(--muted);
        font-size: 8.3px;
      }

      .assetReportMetaLine {
        display: grid;
        grid-template-columns: 21mm minmax(0, 1fr);
        gap: 7px;
        align-items: baseline;
      }

      .assetReportMetaLine span {
        color: var(--muted);
        font-weight: 600;
      }

      .assetReportMetaLine strong {
        color: var(--strong);
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetReportOverview {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 62mm;
        align-items: stretch;
        margin-top: 11px;
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetReportIdentity {
        min-width: 0;
        padding: 11px 13px 12px;
      }

      .assetReportKicker {
        margin: 0 0 6px;
        color: var(--muted);
        font-size: 8.1px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .assetReportTitle {
        margin: 0;
        color: var(--strong);
        font-size: 21.5px;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.045em;
      }

      .assetReportMeta {
        margin: 7px 0 0;
        color: #3f4652;
        font-size: 9.2px;
        line-height: 1.35;
        font-weight: 600;
      }

      .assetReportValuationCard {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 11px 12px;
        border-left: 1px solid var(--line-strong);
        background: var(--soft-2);
      }

      .assetReportValuationCard h2 {
        margin: 0 0 6px;
        color: #2b313b;
        font-size: 8.8px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: 0.07em;
        text-transform: uppercase;
      }

      .assetReportValue {
        display: block;
        margin: 0;
        color: var(--strong);
        font-size: 30px;
        line-height: 0.96;
        font-weight: 800;
        letter-spacing: -0.055em;
        white-space: nowrap;
      }

      .assetReportVat {
        display: block;
        margin-top: 4px;
        color: var(--muted);
        font-size: 8.5px;
        font-weight: 600;
      }

      .assetReportValueMeta {
        display: grid;
        gap: 4px;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid var(--line);
      }

      .assetReportValueMeta div,
      .assetReportRecordRows .assetReportRow {
        display: grid;
        grid-template-columns: 22mm minmax(0, 1fr);
        gap: 7px;
        min-height: 17px;
        align-items: baseline;
      }

      .assetReportValueMeta span,
      .assetReportRecordRows .assetReportRow span {
        color: var(--muted);
        font-size: 8.2px;
        font-weight: 700;
      }

      .assetReportValueMeta strong,
      .assetReportRecordRows .assetReportRow strong {
        color: var(--strong);
        font-size: 8.3px;
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetReportContentGrid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 62mm;
        gap: 12px;
        align-items: start;
        margin-top: 12px;
      }

      .assetReportMainStack {
        display: grid;
        gap: 10px;
      }

      .assetReportSection,
      .assetReportSideCard {
        break-inside: avoid;
      }

      .assetReportSection {
        padding: 10px 11px 11px;
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetReportSection h2,
      .assetReportSideCard h2 {
        margin: 0 0 8px;
        color: var(--strong);
        font-size: 10.8px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: -0.01em;
      }

      .assetReportRows {
        width: 100%;
        border-top: 1px solid var(--line);
      }

      .assetReportRow {
        display: grid;
        grid-template-columns: 30mm minmax(0, 1fr);
        min-height: 20px;
        align-items: center;
        border-bottom: 1px solid var(--line);
      }

      .assetReportRow span {
        color: #38404c;
        font-size: 8.8px;
        line-height: 1.3;
        font-weight: 600;
      }

      .assetReportRow strong {
        color: var(--strong);
        font-size: 9px;
        line-height: 1.3;
        font-weight: 700;
        word-break: break-word;
      }

      .assetReportTechnical .assetReportRows {
        display: grid;
        grid-template-columns: 1fr;
        border-top: 1px solid var(--line);
      }

      .assetReportTechnical .assetReportRow {
        grid-template-columns: 31mm minmax(0, 1fr);
        min-height: 21px;
      }

      .assetReportClientCard .assetReportRow {
        grid-template-columns: 31mm minmax(0, 1fr);
        min-height: 20px;
        align-items: start;
        padding: 3px 0;
      }

      .assetReportClientCard .assetReportRow span,
      .assetReportClientCard .assetReportRow strong {
        line-height: 1.35;
      }

      .assetReportEmpty {
        padding: 6px 0;
        color: var(--muted);
        font-size: 8.8px;
      }

      .assetReportSide {
        display: grid;
        gap: 10px;
      }

      .assetReportSideCard {
        padding: 10px 10px 9px;
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetReportSideCard .assetReportRows {
        border-top: 1px solid var(--line);
      }

      .assetReportSideCard .assetReportRow {
        grid-template-columns: 21mm minmax(0, 1fr);
        min-height: 17.5px;
      }

      .assetReportSideCard .assetReportRow span {
        font-size: 8.1px;
      }

      .assetReportSideCard .assetReportRow strong {
        font-size: 8.2px;
      }

      .assetReportRecordRows .assetReportRows {
        display: grid;
        gap: 0;
      }

      .assetReportRecordRows .assetReportRow:last-child {
        border-bottom: 0;
      }

      .assetReportWideSection {
        break-inside: auto;
      }

      .assetReportTableWrap {
        width: 100%;
        overflow: hidden;
        border-top: 1px solid var(--line);
      }

      .assetReportTable {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      .assetReportTable th,
      .assetReportTable td {
        padding: 5px 5px 5px 0;
        border-bottom: 1px solid var(--line);
        color: #38404c;
        font-size: 7.7px;
        line-height: 1.35;
        text-align: left;
        vertical-align: top;
        word-break: break-word;
      }

      .assetReportTable th {
        color: var(--strong);
        font-size: 7.4px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .assetReportTable td strong {
        color: var(--strong);
        font-weight: 800;
      }

      .assetReportScanTable th:nth-child(1),
      .assetReportScanTable td:nth-child(1),
      .assetReportMaintenanceTable th:nth-child(1),
      .assetReportMaintenanceTable td:nth-child(1) {
        width: 22mm;
      }

      .assetReportScanTable th:nth-child(2),
      .assetReportScanTable td:nth-child(2),
      .assetReportScanTable th:nth-child(3),
      .assetReportScanTable td:nth-child(3),
      .assetReportMaintenanceTable th:nth-child(2),
      .assetReportMaintenanceTable td:nth-child(2),
      .assetReportMaintenanceTable th:nth-child(3),
      .assetReportMaintenanceTable td:nth-child(3) {
        width: 17mm;
      }

      a {
        color: var(--strong);
        font-weight: 700;
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      .assetReportFooter {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: end;
        padding-top: 8px;
        border-top: 1px solid var(--line-strong);
      }

      .assetReportPowered {
        margin: 0 0 4px;
        color: var(--strong);
        font-size: 8.2px;
        font-weight: 700;
      }

      .assetReportDisclaimer {
        max-width: 166mm;
        color: #323a45;
        font-size: 7.35px;
        line-height: 1.35;
        font-style: italic;
      }

      .assetReportPageNumber {
        color: var(--strong);
        font-size: 8px;
        font-weight: 700;
        white-space: nowrap;
      }

      @media screen and (max-width: 760px) {
        .assetReportPage {
          padding: 24px;
        }

        .assetReportHeader,
        .assetReportOverview,
        .assetReportContentGrid {
          grid-template-columns: 1fr;
        }

        .assetReportValuationCard {
          border-left: 0;
          border-top: 1px solid var(--line-strong);
        }

        .assetReportHeaderMeta,
        .assetReportMetaLine strong,
        .assetReportValueMeta strong,
        .assetReportRecordRows .assetReportRow strong {
          text-align: left;
        }
      }

      @media print {
        html,
        body {
          background: #ffffff;
        }

        .assetReportScreenBar {
          display: none !important;
        }

        .assetReportPage {
          width: auto;
          min-height: 281mm;
          margin: 0;
          padding: 0;
          box-shadow: none;
          overflow: visible;
        }

        .assetReportInner {
          min-height: 281mm;
          padding-bottom: 21mm;
        }

        .assetReportHeader {
          grid-template-columns: 22mm minmax(0, 1fr) 62mm;
        }

        .assetReportOverview,
        .assetReportContentGrid {
          grid-template-columns: minmax(0, 1fr) 62mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="assetReportScreenBar">
      <div class="assetReportScreenText">Choose <strong>Save as PDF</strong> in the print dialog to download this ${escapeHtml(reportTitle.toLowerCase())}.</div>
      <div class="assetReportScreenActions">
        <button type="button" class="assetReportButton" onclick="window.close()">Close</button>
        <button type="button" class="assetReportButton assetReportButtonPrimary" onclick="window.print()">Print / Save PDF</button>
      </div>
    </div>

    <main class="assetReportPage">
      <div class="assetReportInner">
        <header class="assetReportHeader">
          <div class="assetReportLogoWrap"><img class="assetReportLogo" src="/brand/aim4price-mark-black.png" alt="Aim4price" /></div>
          <div class="assetReportDocumentTitle">
            <strong>${escapeHtml(reportTitle)}</strong>
            <span>Aim4price asset register</span>
          </div>
          <div class="assetReportHeaderMeta">
            <div class="assetReportMetaLine"><span>Generated</span><strong>${escapeHtml(options.generatedAt)}</strong></div>
            ${options.ownerEmail ? `<div class="assetReportMetaLine"><span>Email</span><strong>${escapeHtml(options.ownerEmail)}</strong></div>` : ''}
          </div>
        </header>

        <section class="assetReportOverview">
          <div class="assetReportIdentity">
            <p class="assetReportKicker">${escapeHtml(formatAssetKind(asset))}</p>
            <h1 class="assetReportTitle">${safeTitle}</h1>
            <p class="assetReportMeta">${escapeHtml(formatAssetHeroMeta(asset))}</p>
          </div>

          <aside class="assetReportValuationCard">
            <h2>${escapeHtml(options.summary.label)}</h2>
            <strong class="assetReportValue">${escapeHtml(options.summary.value)}</strong>
            <span class="assetReportVat">${escapeHtml(options.summary.subtext)}</span>
            <div class="assetReportValueMeta">
              <div><span>Basis</span><strong>${escapeHtml(options.summary.basis)}</strong></div>
              <div><span>Updated</span><strong>${escapeHtml(options.summary.updated)}</strong></div>
            </div>
          </aside>
        </section>

        <div class="assetReportContentGrid">
          <div class="assetReportMainStack">
            <section class="assetReportSection assetReportTechnical">
              <h2>Asset Details</h2>
              ${renderRows(buildAssetDetailRows(asset), 'No asset details available.')}
            </section>

            <section class="assetReportSection assetReportClientCard">
              <h2>Client / Asset Owner</h2>
              ${renderRows(buildClientRows({ ownerName: options.ownerName, ownerEmail: options.ownerEmail, asset }), 'No client details available.')}
            </section>

            ${options.bodyHtml}
          </div>

          <aside class="assetReportSide">
            <section class="assetReportSideCard assetReportRecordRows">
              <h2>Record Summary</h2>
              ${renderRows(options.recordRows, 'No record details available.')}
            </section>

            <section class="assetReportSideCard assetReportRecordRows">
              <h2>Latest Location</h2>
              ${renderRows(buildLocationRows(asset), 'No location captured yet.')}
            </section>
          </aside>
        </div>

        <footer class="assetReportFooter">
          <div>
            <p class="assetReportPowered">Powered by Aim4price.com</p>
            <div class="assetReportDisclaimer">${escapeHtml(disclaimer)}</div>
          </div>
          <div class="assetReportPageNumber">Page 1 of 1</div>
        </footer>
      </div>
    </main>

    <script>
      (function () {
        function waitForImages() {
          var images = Array.prototype.slice.call(document.images || []);
          if (!images.length) {
            return Promise.resolve();
          }

          return Promise.all(images.map(function (image) {
            if (image.complete) {
              return Promise.resolve();
            }

            return new Promise(function (resolve) {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            });
          }));
        }

        function waitForFonts() {
          if (document.fonts && document.fonts.ready) {
            return Promise.race([
              document.fonts.ready.catch(function () { return undefined; }),
              new Promise(function (resolve) { window.setTimeout(resolve, 900); }),
            ]);
          }

          return Promise.resolve();
        }

        function openPrintDialog() {
          Promise.all([waitForImages(), waitForFonts()]).then(function () {
            window.setTimeout(function () {
              window.focus();
              window.print();
            }, 250);
          });
        }

        if (document.readyState === 'complete') {
          openPrintDialog();
        } else {
          window.addEventListener('load', openPrintDialog, { once: true });
        }
      })();
    </script>
  </body>
</html>`;
}

function buildScanReport(asset: AssetRegisterItem, events: ScanEventRecord[], ownerName: string, ownerEmail: string, generatedAt: string): string {
  return buildReportHtml({
    reportKind: 'scan',
    asset,
    ownerName,
    ownerEmail,
    generatedAt,
    summary: buildScanReportSummary(asset, events),
    recordRows: buildScanRecordRows(asset, events),
    bodyHtml: buildScanBody(asset, events),
  });
}

function buildFuelReport(asset: AssetRegisterItem, events: ScanEventRecord[], ownerName: string, ownerEmail: string, generatedAt: string): string {
  const fuelEvents = events.filter((event) => typeof event.fuelPercent === 'number' && Number.isFinite(event.fuelPercent));

  return buildReportHtml({
    reportKind: 'fuel',
    asset,
    ownerName,
    ownerEmail,
    generatedAt,
    summary: buildFuelReportSummary(asset, fuelEvents),
    recordRows: buildFuelRecordRows(asset, fuelEvents),
    bodyHtml: buildFuelBody(asset, fuelEvents),
  });
}

function buildMaintenanceReport(asset: AssetRegisterItem, events: ScanEventRecord[], ownerName: string, ownerEmail: string, generatedAt: string): string {
  const maintenanceEntries = events.map((event) => parseMaintenanceEvent(event)).filter((entry): entry is MaintenanceEntry => Boolean(entry));

  return buildReportHtml({
    reportKind: 'maintenance',
    asset,
    ownerName,
    ownerEmail,
    generatedAt,
    summary: buildMaintenanceReportSummary(asset, maintenanceEntries),
    recordRows: buildMaintenanceRecordRows(asset, maintenanceEntries),
    bodyHtml: buildMaintenanceBody(asset, maintenanceEntries),
  });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth', request.url), { status: 302 });
  }

  const assetId = asText(request.nextUrl.searchParams.get('assetId'));
  const reportKind = normalizeReportKind(
    request.nextUrl.searchParams.get('report') ?? request.nextUrl.searchParams.get('reportType') ?? request.nextUrl.searchParams.get('type'),
  );

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Asset ID is required.' }, { status: 400 });
  }

  const asset = await getAssetRegisterItemById(session.user.id, assetId);

  if (!asset) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }

  const events = await listScanEventsForAsset(asset.id, 500);
  const ownerName = asText(session.user.name) || asText(session.user.email) || 'Owner session';
  const ownerEmail = asText(session.user.email);
  const generatedAt = formatDate(new Date().toISOString());

  const html =
    reportKind === 'fuel'
      ? buildFuelReport(asset, events, ownerName, ownerEmail, generatedAt)
      : reportKind === 'maintenance'
        ? buildMaintenanceReport(asset, events, ownerName, ownerEmail, generatedAt)
        : buildScanReport(asset, events, ownerName, ownerEmail, generatedAt);

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
