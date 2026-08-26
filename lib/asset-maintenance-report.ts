import type { AccountProfile } from './account-profile';
import type {
  AssetMaintenanceAssetOption,
  AssetMaintenanceComputedStatus,
  AssetMaintenanceRecord,
  AssetMaintenanceSummary,
} from './asset-maintenance';
import type { XlsxCellStyle, XlsxCellValue, XlsxSheet } from './simple-xlsx';

export type AssetMaintenanceOwnerDetails = {
  businessName: string;
  contactDetails: string;
  businessEmail: string;
  locationAddress: string;
};

export type AssetMaintenanceReportOptions = {
  title: string;
  subtitle: string;
  generatedAt: string;
  ownerEmail: string;
  ownerDetails: AssetMaintenanceOwnerDetails;
  logoUrl: string;
  reportScopeLabel: string;
  assetLabel: string;
  selectedAsset: AssetMaintenanceAssetOption | null;
  summary: AssetMaintenanceSummary;
  records: AssetMaintenanceRecord[];
  xlsxUrl: string;
};

type KeyValueRow = { label: string; value: string };

type MaintenanceGroup = {
  key: 'attention' | 'scheduled' | 'completed';
  title: string;
  description: string;
  records: AssetMaintenanceRecord[];
};

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

function parseReportTimestamp(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const cleaned = typeof value === 'string' ? value.trim() : value;
  if (cleaned === '') return null;

  const dateOnly = typeof cleaned === 'string' && !cleaned.includes('T');
  const date = new Date(dateOnly ? `${cleaned}T00:00:00Z` : cleaned);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(value?: unknown): string {
  const date = parseReportTimestamp(value);
  if (!date) return '-';
  const dateOnly = typeof value === 'string' && !value.includes('T');
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: dateOnly ? 'UTC' : 'Africa/Johannesburg',
  }).format(date);
}

function formatDateTime(value?: unknown): string {
  const date = parseReportTimestamp(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Johannesburg',
  }).format(date);
}

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return value.toLocaleString('en-ZA', { maximumFractionDigits: 2 });
}

function formatCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  return Math.max(0, Math.round(value)).toLocaleString('en-ZA');
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'R 0';
  return `R ${Math.round(value).toLocaleString('en-ZA')}`;
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatType(value: string | null | undefined): string {
  return titleCase(asText(value) || 'maintenance');
}

function formatStatus(value: AssetMaintenanceComputedStatus | string | null | undefined): string {
  if (value === 'due_soon') return 'Due soon';
  return titleCase(asText(value) || 'upcoming');
}

function formatUsage(value: number | null | undefined, metric?: string | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${formatNumber(value)} ${asText(metric) || 'usage'}`;
}

function maintenanceSourceLabel(record: AssetMaintenanceRecord): string {
  return record.sourceScanEventId ? 'QR Scanner' : record.status === 'done' ? 'Maintenance' : 'Scheduled Maintenance';
}

function maintenanceLocation(record: AssetMaintenanceRecord): string {
  if (record.sourceLocationText) return record.sourceLocationText;
  if (
    typeof record.sourceLatitude === 'number'
    && Number.isFinite(record.sourceLatitude)
    && typeof record.sourceLongitude === 'number'
    && Number.isFinite(record.sourceLongitude)
  ) {
    return `${record.sourceLatitude.toFixed(6)}, ${record.sourceLongitude.toFixed(6)}`;
  }
  return '-';
}

function maintenanceMapUrl(record: AssetMaintenanceRecord): string {
  if (
    typeof record.sourceLatitude !== 'number'
    || !Number.isFinite(record.sourceLatitude)
    || typeof record.sourceLongitude !== 'number'
    || !Number.isFinite(record.sourceLongitude)
  ) return '';
  return `https://www.google.com/maps?q=${record.sourceLatitude},${record.sourceLongitude}`;
}

function maintenancePhotoLabel(record: AssetMaintenanceRecord): string {
  const count = record.sourcePhotoUrls.length;
  return count === 1 ? '1 photo captured' : count > 1 ? `${count} photos captured` : '-';
}

function formatAlert(record: AssetMaintenanceRecord): string {
  if (typeof record.alertBeforeValue !== 'number' || !record.alertBeforeUnit) return '-';
  return `${formatNumber(record.alertBeforeValue)} ${record.alertBeforeUnit} before`;
}

function formatRecurring(record: AssetMaintenanceRecord): string {
  if (!record.recurringEnabled) return 'No';
  if (typeof record.recurringIntervalValue !== 'number' || !record.recurringIntervalUnit) return 'Yes';
  return `Every ${formatNumber(record.recurringIntervalValue)} ${record.recurringIntervalUnit}`;
}

function formatDue(record: AssetMaintenanceRecord): string {
  return record.triggerType === 'date'
    ? formatDateOnly(record.dueDate)
    : formatUsage(record.dueUsage, record.usageMetric ?? record.assetUsageMetric);
}

function formatRemaining(record: AssetMaintenanceRecord): string {
  if (record.status === 'done') return 'Completed';
  if (record.triggerType === 'date' && typeof record.daysUntilDue === 'number') {
    if (record.daysUntilDue < 0) return `${formatNumber(Math.abs(record.daysUntilDue))} days overdue`;
    if (record.daysUntilDue === 0) return 'Due today';
    return `${formatNumber(record.daysUntilDue)} days remaining`;
  }
  if (record.triggerType === 'usage' && typeof record.remainingUsage === 'number') {
    const metric = record.usageMetric ?? record.assetUsageMetric;
    if (record.remainingUsage < 0) return `${formatUsage(Math.abs(record.remainingUsage), metric)} overdue`;
    if (record.remainingUsage === 0) return 'Due now';
    return `${formatUsage(record.remainingUsage, metric)} remaining`;
  }
  return formatStatus(record.computedStatus);
}

function buildOwnerLocationAddress(profile: AccountProfile | null): string {
  if (!profile) return '';
  const address = [profile.addressLine1, profile.addressLine2, profile.townCity, profile.province]
    .map((part) => asText(part))
    .filter(Boolean)
    .join(', ');
  return address || asText(profile.marketplaceLocation);
}

export function buildAssetMaintenanceOwnerDetails(
  profile: AccountProfile | null,
  fallbackUser: { name?: unknown; email?: unknown },
): AssetMaintenanceOwnerDetails {
  const fallbackEmail = asText(fallbackUser.email);
  const businessName =
    asText(profile?.businessName) ||
    asText(profile?.marketplaceSellerName) ||
    asText(profile?.displayName) ||
    asText(profile?.name) ||
    asText(fallbackUser.name) ||
    fallbackEmail ||
    'Aim4price account';

  return {
    businessName,
    contactDetails: asText(profile?.marketplacePhone) || asText(profile?.phone),
    businessEmail: asText(profile?.marketplaceEmail) || asText(profile?.email) || fallbackEmail,
    locationAddress: buildOwnerLocationAddress(profile),
  };
}

function renderRows(rows: KeyValueRow[]): string {
  return `<div class="assetReportRows">${rows
    .map(
      (row) => `<div class="assetReportRow"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value || '-')}</strong></div>`,
    )
    .join('')}</div>`;
}

function buildOwnerRows(owner: AssetMaintenanceOwnerDetails): KeyValueRow[] {
  return [
    { label: 'Business Name', value: owner.businessName || '-' },
    { label: 'Contact Details', value: owner.contactDetails || '-' },
    { label: 'Business Email', value: owner.businessEmail || '-' },
    { label: 'Location / Address', value: owner.locationAddress || '-' },
  ];
}

function buildAssetRows(asset: AssetMaintenanceAssetOption | null, scope: string): KeyValueRow[] {
  if (!asset) {
    return [
      { label: 'Report Scope', value: scope || 'All maintenance records' },
      { label: 'Asset Filter', value: 'All selected assets' },
    ];
  }
  return [
    { label: 'Category', value: asset.categoryLabel || asset.kind || '-' },
    { label: 'Asset', value: asset.title || '-' },
    { label: 'Year Model', value: asset.yearModel ? String(asset.yearModel) : '-' },
    { label: 'Usage', value: formatUsage(asset.usageReading, asset.usageMetric) },
    { label: 'Condition', value: asset.condition || '-' },
    { label: 'Current Value', value: formatMoney(asset.value) },
  ];
}

function latestUpdatedDate(options: AssetMaintenanceReportOptions): string {
  const latest = options.records
    .map((record) => parseReportTimestamp(record.updatedAtIso))
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return latest ? formatDateOnly(latest) : options.generatedAt;
}

function primaryStatusLabel(summary: AssetMaintenanceSummary): string {
  if (summary.overdueCount > 0) return `${formatCount(summary.overdueCount)} overdue`;
  if (summary.dueCount > 0) return `${formatCount(summary.dueCount)} due`;
  if (summary.dueSoonCount > 0) return `${formatCount(summary.dueSoonCount)} due soon`;
  if (summary.openCount > 0) return 'Maintenance scheduled';
  if (summary.doneCount > 0) return 'All recorded work completed';
  return 'No maintenance records';
}

function groupRecords(records: AssetMaintenanceRecord[]): MaintenanceGroup[] {
  const priority = (record: AssetMaintenanceRecord): number => {
    if (record.computedStatus === 'overdue') return 0;
    if (record.computedStatus === 'due') return 1;
    if (record.computedStatus === 'due_soon') return 2;
    return 3;
  };
  const open = records.filter((record) => record.status !== 'done').sort((a, b) => priority(a) - priority(b));
  return [
    {
      key: 'attention',
      title: 'Attention Required',
      description: 'Overdue, due and due-soon work that should be reviewed first.',
      records: open.filter((record) => ['overdue', 'due', 'due_soon'].includes(record.computedStatus)),
    },
    {
      key: 'scheduled',
      title: 'Scheduled Maintenance',
      description: 'Open service and checkup work that is not yet within its alert threshold.',
      records: open.filter((record) => !['overdue', 'due', 'due_soon'].includes(record.computedStatus)),
    },
    {
      key: 'completed',
      title: 'Completed Maintenance',
      description: 'Completed work retained as an operational maintenance history.',
      records: records.filter((record) => record.status === 'done'),
    },
  ];
}

function recordTitle(record: AssetMaintenanceRecord): string {
  return asText(record.title) || `${formatType(record.maintenanceType)} - ${record.assetTitle}`;
}

function renderRecord(record: AssetMaintenanceRecord): string {
  const completed = record.status === 'done';
  const details: KeyValueRow[] = completed
    ? [
        { label: 'Completed (SAST)', value: formatDateTime(record.completedAtIso) },
        { label: 'Completed Usage', value: formatUsage(record.completedUsage, record.usageMetric ?? record.assetUsageMetric) },
        { label: 'Completed By', value: record.completedBy || record.assignedName || '-' },
        { label: 'Record Source', value: maintenanceSourceLabel(record) },
        { label: 'Recorded Location', value: maintenanceLocation(record) },
        { label: 'Photo Evidence', value: maintenancePhotoLabel(record) },
        { label: 'Work Notes', value: record.completedNotes || record.notes || '-' },
      ]
    : [
        { label: 'Due', value: formatDue(record) },
        { label: 'Time / Usage Remaining', value: formatRemaining(record) },
        { label: 'Current Usage', value: formatUsage(record.currentUsage, record.usageMetric ?? record.assetUsageMetric) },
        { label: 'Assigned To', value: record.assignedName || 'Unassigned' },
        { label: 'Reminder', value: formatAlert(record) },
        { label: 'Recurring', value: formatRecurring(record) },
        { label: 'Notes', value: record.notes || '-' },
      ];

  return `<article class="maintenanceCard ${completed ? 'maintenanceCardDone' : ''}">
    <div class="maintenanceCardHead">
      <div>
        <span class="statusPill status-${escapeHtml(record.computedStatus)}">${escapeHtml(formatStatus(record.computedStatus))}</span>
        <h3>${escapeHtml(recordTitle(record))}</h3>
        <p>${escapeHtml(record.assetTitle)}${record.assetMeta ? ` - ${escapeHtml(record.assetMeta)}` : ''}</p>
      </div>
      <div class="maintenanceType"><span>Type</span><strong>${escapeHtml(formatType(record.maintenanceType))}</strong><small>${escapeHtml(record.triggerType === 'date' ? 'Date based' : 'Usage based')}</small></div>
    </div>
    <div class="maintenanceDetails">${details
      .map((detail) => `<div class="maintenanceDetail"><span>${escapeHtml(detail.label)}</span><strong>${escapeHtml(detail.value || '-')}</strong></div>`)
      .join('')}</div>
  </article>`;
}

function renderMaintenanceGroups(records: AssetMaintenanceRecord[]): string {
  const visibleGroups = groupRecords(records).filter((group) => group.records.length > 0);
  if (!visibleGroups.length) return '<div class="assetReportEmpty">No maintenance records match this report.</div>';
  return visibleGroups
    .map(
      (group) => `<section class="recordsSection">
        <div class="sectionHeading"><div><h2>${escapeHtml(group.title)}</h2><p>${escapeHtml(group.description)}</p></div><strong>${formatCount(group.records.length)} ${group.records.length === 1 ? 'record' : 'records'}</strong></div>
        <div class="maintenanceList">${group.records.map(renderRecord).join('')}</div>
      </section>`,
    )
    .join('');
}

function summaryRows(options: AssetMaintenanceReportOptions): KeyValueRow[] {
  return [
    { label: 'Report Scope', value: options.reportScopeLabel },
    { label: 'Asset Filter', value: options.assetLabel },
    { label: 'Total Records', value: formatCount(options.summary.totalCount) },
    { label: 'Open Work', value: formatCount(options.summary.openCount) },
    { label: 'Attention Required', value: formatCount(options.summary.overdueCount + options.summary.dueCount + options.summary.dueSoonCount) },
    { label: 'Completed', value: formatCount(options.summary.doneCount) },
    { label: 'Last Updated', value: latestUpdatedDate(options) },
  ];
}

export function buildAssetMaintenanceReportHtml(options: AssetMaintenanceReportOptions): string {
  const reportTitle = 'Maintenance Report';
  const heroTitle = options.selectedAsset?.title || options.assetLabel || 'All selected assets';
  const heroMeta = options.selectedAsset?.meta || `${formatCount(options.summary.totalCount)} maintenance records - ${options.reportScopeLabel}`;
  const logo = options.logoUrl
    ? `<img class="assetReportLogo" src="${escapeHtml(options.logoUrl)}" alt="Aim4price logo" />`
    : '<div class="assetReportLogoFallback">A4P</div>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(reportTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet" />
<style>
  :root { color-scheme:light; --ink:#111827; --strong:#070b12; --muted:#5f6b7a; --line:#d7dde5; --line-strong:#b9c2ce; --soft:#f5f6f8; --green:#0b4a3a; --green-soft:#eaf4f0; --amber:#815c12; --amber-soft:#fff7e3; --red:#8b2424; --red-soft:#fff0f0; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:A4; margin:8mm 9mm; }
  html,body { margin:0; padding:0; background:#eef1f4; color:var(--ink); font-family:"Montserrat","Segoe UI",Arial,Helvetica,sans-serif; font-size:9.6px; line-height:1.35; }
  .reportPage { width:min(100%,210mm); min-height:297mm; margin:18px auto; padding:11mm 11mm 9mm; background:#fff; box-shadow:0 16px 44px rgba(17,24,39,.13); }
  .topbar { display:grid; grid-template-columns:22mm minmax(0,1fr) 62mm; gap:12px; align-items:center; min-height:18mm; padding:0 0 10px; border-bottom:1px solid var(--line-strong); }
  .brand { display:contents; }
  .assetReportLogo { display:block; width:18mm; max-height:18mm; object-fit:contain; }
  .assetReportLogoFallback { width:18mm; height:18mm; display:grid; place-items:center; border:1.5px solid var(--strong); border-radius:50%; font-weight:800; }
  .brand h1 { margin:0; font-size:16px; line-height:1.05; font-weight:800; letter-spacing:-.025em; }
  .brand p { margin:5px 0 0; color:var(--muted); font-size:8.9px; font-weight:600; }
  .meta { display:grid; grid-template-columns:21mm minmax(0,1fr); gap:4px 7px; min-width:0; font-size:8.3px; }
  .meta span { color:var(--muted); font-weight:700; }
  .meta strong { color:var(--strong); text-align:right; word-break:break-word; }
  .actions { position:fixed; z-index:10; top:12px; right:16px; display:flex; justify-content:flex-end; gap:8px; }
  .action { min-height:42px; display:inline-flex; align-items:center; border:1px solid #cfd5dd; background:#fff; color:var(--ink); border-radius:999px; padding:0 16px; text-decoration:none; font:inherit; font-size:12.5px; font-weight:800; cursor:pointer; }
  .action:last-child { min-width:150px; justify-content:center; border-color:var(--strong); background:var(--strong); color:#fff; }
  .hero { display:grid; grid-template-columns:minmax(0,1fr) 62mm; margin-top:11px; border:1px solid var(--line-strong); }
  .heroMain { min-height:34mm; padding:11px 13px 12px; border-right:1px solid var(--line-strong); }
  .eyebrow { margin:0 0 6px; color:var(--muted); font-size:8.1px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
  .heroTitle { margin:0; color:var(--strong); font-size:21.5px; line-height:1.05; font-weight:800; letter-spacing:-.045em; }
  .heroMeta { margin:7px 0 0; color:#3f4652; font-size:9.2px; font-weight:600; }
  .heroStatus { display:flex; flex-direction:column; justify-content:center; padding:11px 12px; background:#fafbfc; }
  .heroStatus span { display:block; font-size:8.8px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; }
  .heroStatus strong { display:block; margin:6px 0 4px; font-size:17px; line-height:1.05; }
  .heroStatus p { margin:6px 0 0; padding-top:7px; border-top:1px solid var(--line); color:var(--muted); font-size:8.3px; font-weight:600; }
  .detailsGrid { display:grid; grid-template-columns:minmax(0,1fr) 62mm; gap:12px; margin:12px 0 10px; align-items:start; }
  .stack { display:grid; gap:10px; }
  .panel { break-inside:avoid; border:1px solid var(--line-strong); padding:10px 11px 11px; }
  .panel h2 { margin:0 0 8px; color:var(--strong); font-size:10.8px; }
  .assetReportRows { border-top:1px solid var(--line); }
  .assetReportRow { display:grid; grid-template-columns:31mm minmax(0,1fr); gap:7px; min-height:20px; align-items:center; border-bottom:1px solid var(--line); }
  .assetReportRow span { color:#38404c; font-size:8.8px; font-weight:600; }
  .assetReportRow strong { color:var(--strong); font-size:9px; overflow-wrap:anywhere; }
  .detailsGrid > .panel .assetReportRow { grid-template-columns:21mm minmax(0,1fr); min-height:17.5px; }
  .detailsGrid > .panel .assetReportRow strong { text-align:right; font-size:8.2px; }
  .statusGrid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); border:1px solid var(--line-strong); margin-bottom:10px; }
  .statusGrid div { padding:8px 10px; border-right:1px solid var(--line); }
  .statusGrid div:last-child { border-right:0; }
  .statusGrid span { display:block; color:var(--muted); font-size:7.3px; font-weight:800; text-transform:uppercase; letter-spacing:.045em; }
  .statusGrid strong { display:block; margin-top:4px; font-size:14px; }
  .recordsSection { margin-top:10px; border:1px solid var(--line-strong); padding:10px 11px 11px; break-inside:auto; }
  .sectionHeading { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; margin-bottom:11px; }
  .sectionHeading h2 { margin:0 0 4px; font-size:10.8px; }
  .sectionHeading p { margin:0; color:var(--muted); font-size:8px; font-weight:600; }
  .sectionHeading > strong { min-width:24mm; min-height:22px; display:inline-flex; align-items:center; justify-content:center; padding:3px 8px; border:1px solid var(--line); background:#fafbfc; font-size:8px; text-transform:uppercase; white-space:nowrap; }
  .maintenanceList { display:grid; gap:8px; }
  .maintenanceCard { border:1px solid var(--line); break-inside:avoid; }
  .maintenanceCardHead { display:grid; grid-template-columns:minmax(0,1fr) 35mm; gap:0; padding:0; background:#fafbfc; border-bottom:1px solid var(--line); }
  .maintenanceCardHead > div { padding:7px 8px; }
  .maintenanceCardHead > div + div { border-left:1px solid var(--line); }
  .maintenanceCardHead h3 { margin:5px 0 3px; font-size:9.4px; }
  .maintenanceCardHead p { margin:0; color:#505d67; font-size:8px; font-weight:600; }
  .statusPill { display:inline-block; padding:2px 6px; border:1px solid #aeb9bf; border-radius:999px; background:#fff; color:#39444d; font-size:6.8px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
  .status-overdue { color:var(--red); border-color:#e4baba; background:var(--red-soft); }
  .status-due,.status-due_soon { color:var(--amber); border-color:#ead69e; background:var(--amber-soft); }
  .status-done { color:var(--green); border-color:#b9d9cd; background:var(--green-soft); }
  .maintenanceType { text-align:left; }
  .maintenanceType span,.maintenanceType small { display:block; color:var(--muted); font-size:7.3px; font-weight:800; text-transform:uppercase; }
  .maintenanceType strong { display:block; margin:4px 0; }
  .maintenanceDetails { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
  .maintenanceDetail { min-height:37px; padding:7px 8px; border-right:1px solid var(--line); border-bottom:1px solid var(--line); }
  .maintenanceDetail:nth-child(2n) { border-right:0; }
  .maintenanceDetail span { display:block; color:var(--muted); font-size:7.3px; font-weight:800; text-transform:uppercase; letter-spacing:.045em; }
  .maintenanceDetail strong { display:block; margin-top:3px; color:var(--strong); font-size:8.6px; line-height:1.35; overflow-wrap:anywhere; }
  .assetReportEmpty { padding:20px; border:1px dashed #bfc7cd; color:var(--muted); font-weight:700; }
  .footer { display:grid; grid-template-columns:1fr auto; gap:10px; margin-top:12px; padding-top:12px; border-top:1px solid var(--line-strong); font-size:7.35px; color:#323a45; }
  .footer strong { display:block; margin-bottom:4px; color:var(--strong); font-size:8.2px; }
  .footer p { margin:0; font-style:italic; line-height:1.35; }
  @media(max-width:800px){ .topbar,.hero,.detailsGrid{grid-template-columns:1fr}.meta{min-width:0}.heroMain{border-right:0;border-bottom:1px solid #bfc7cd}.statusGrid{grid-template-columns:repeat(2,1fr)}.maintenanceCardHead{grid-template-columns:1fr}.maintenanceType{text-align:left}.maintenanceDetails{grid-template-columns:1fr}.maintenanceDetail{border-right:0}.actions{margin-left:0;margin-right:0}.reportPage{width:calc(100% - 20px)} }
  @media print { html,body{background:#fff}.reportPage{width:auto;min-height:281mm;margin:0;padding:0;box-shadow:none}.actions{display:none}.footerPage:after{content:' - Page ' counter(page)} }
</style>
</head>
<body>
<main class="reportPage">
  <header class="topbar">
    <div class="brand">${logo}<div><h1>${escapeHtml(reportTitle)}</h1><p>${escapeHtml(options.subtitle)}</p></div></div>
    <div class="meta"><span>Generated</span><strong>${escapeHtml(options.generatedAt)}</strong><span>Business Email</span><strong>${escapeHtml(options.ownerEmail || '-')}</strong></div>
  </header>
  <div class="actions"><a class="action" href="${escapeHtml(options.xlsxUrl)}">Download Excel</a><button class="action" onclick="window.print()">Print / Save PDF</button></div>
  <section class="hero">
    <div class="heroMain"><p class="eyebrow">Maintenance Management</p><h2 class="heroTitle">${escapeHtml(heroTitle)}</h2><p class="heroMeta">${escapeHtml(heroMeta)}</p></div>
    <div class="heroStatus"><span>Current Position</span><strong>${escapeHtml(primaryStatusLabel(options.summary))}</strong><p>${formatCount(options.summary.openCount)} open - ${formatCount(options.summary.doneCount)} completed</p></div>
  </section>
  <section class="detailsGrid">
    <div class="stack"><div class="panel"><h2>Asset Details</h2>${renderRows(buildAssetRows(options.selectedAsset, options.reportScopeLabel))}</div><div class="panel"><h2>Client / Asset Owner</h2>${renderRows(buildOwnerRows(options.ownerDetails))}</div></div>
    <div class="panel"><h2>Record Summary</h2>${renderRows(summaryRows(options))}</div>
  </section>
  <section class="statusGrid"><div><span>Overdue</span><strong>${formatCount(options.summary.overdueCount)}</strong></div><div><span>Due / Due Soon</span><strong>${formatCount(options.summary.dueCount + options.summary.dueSoonCount)}</strong></div><div><span>Scheduled</span><strong>${formatCount(Math.max(0, options.summary.openCount - options.summary.dueCount - options.summary.dueSoonCount - options.summary.overdueCount))}</strong></div><div><span>Completed</span><strong>${formatCount(options.summary.doneCount)}</strong></div></section>
  ${renderMaintenanceGroups(options.records)}
  <footer class="footer"><div><strong>Powered by Aim4price.com</strong><p>Maintenance records are based on information captured by the account user. This operational report supports planning and record keeping; it is not a certified mechanical inspection, warranty, compliance or safety certificate.</p></div><strong class="footerPage">Maintenance Report</strong></footer>
</main>
<script>
  (function () {
    function waitForImages() {
      var images = Array.prototype.slice.call(document.images || []);
      if (!images.length) return Promise.resolve();
      return Promise.all(images.map(function (image) {
        if (image.complete) return Promise.resolve();
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

    if (document.readyState === 'complete') openPrintDialog();
    else window.addEventListener('load', openPrintDialog, { once: true });
  })();
</script>
</body>
</html>`;
}

function cell(value: unknown, style: XlsxCellStyle = 'default'): XlsxCellValue {
  return { value: value as string | number | boolean | Date | null | undefined, style };
}

function linkedCell(value: unknown, hyperlink: string, style: XlsxCellStyle = 'text'): XlsxCellValue {
  return {
    value: value as string | number | boolean | Date | null | undefined,
    style,
    hyperlink: /^https?:\/\//i.test(hyperlink) ? hyperlink : undefined,
  };
}

function recordRow(record: AssetMaintenanceRecord): XlsxCellValue[] {
  return [
    cell(record.assetTitle, 'text'),
    cell(record.title || formatType(record.maintenanceType), 'text'),
    cell(formatType(record.maintenanceType), 'text'),
    cell(formatStatus(record.computedStatus), record.status === 'done' ? 'statusGood' : record.computedStatus === 'overdue' ? 'statusBad' : record.computedStatus === 'due' || record.computedStatus === 'due_soon' ? 'statusWarn' : 'statusInfo'),
    cell(record.triggerType === 'date' ? 'Specific Date' : 'Usage', 'text'),
    cell(formatDue(record), 'text'),
    cell(formatRemaining(record), 'text'),
    cell(formatUsage(record.currentUsage, record.usageMetric ?? record.assetUsageMetric), 'text'),
    cell(formatAlert(record), 'text'),
    cell(formatRecurring(record), 'text'),
    cell(record.assignedName || 'Unassigned', 'text'),
    cell(record.notes || '-', 'note'),
    cell(parseReportTimestamp(record.completedAtIso), 'dateTime'),
    cell(formatUsage(record.completedUsage, record.usageMetric ?? record.assetUsageMetric), 'text'),
    cell(record.completedBy || '-', 'text'),
    cell(record.completedNotes || '-', 'note'),
    cell(maintenanceSourceLabel(record), 'text'),
    linkedCell(maintenanceLocation(record), maintenanceMapUrl(record)),
    cell(record.sourceLatitude, 'decimal'),
    cell(record.sourceLongitude, 'decimal'),
    cell(record.sourcePhotoUrls.length || null, 'integer'),
    cell(record.sourcePhotoUrls.join('\n') || '-', 'note'),
    cell(formatDateOnly(record.updatedAtIso), 'date'),
  ];
}

export function buildAssetMaintenanceWorkbook(options: AssetMaintenanceReportOptions): XlsxSheet[] {
  const rows: XlsxCellValue[][] = [
    [cell(options.title, 'title')],
    [cell(options.subtitle, 'subtitle')],
    [cell('Generated', 'metaLabel'), cell(options.generatedAt, 'metaValue')],
    [cell('Report Scope', 'metaLabel'), cell(options.reportScopeLabel, 'metaValue')],
    [cell('Asset', 'metaLabel'), cell(options.assetLabel, 'metaValue')],
    [],
    [cell('Owner / Company', 'section')],
    [cell('Business Name', 'metaLabel'), cell(options.ownerDetails.businessName || '-', 'metaValue')],
    [cell('Contact Details', 'metaLabel'), cell(options.ownerDetails.contactDetails || '-', 'metaValue')],
    [cell('Business Email', 'metaLabel'), cell(options.ownerDetails.businessEmail || '-', 'metaValue')],
    [cell('Location / Address', 'metaLabel'), cell(options.ownerDetails.locationAddress || '-', 'metaValue')],
    [],
    [cell('Maintenance Position', 'section')],
    [cell('Total Records', 'metaLabel'), cell(options.summary.totalCount, 'integer')],
    [cell('Open Work', 'metaLabel'), cell(options.summary.openCount, 'integer')],
    [cell('Due Soon', 'metaLabel'), cell(options.summary.dueSoonCount, 'integer')],
    [cell('Due', 'metaLabel'), cell(options.summary.dueCount, 'integer')],
    [cell('Overdue', 'metaLabel'), cell(options.summary.overdueCount, 'integer')],
    [cell('Completed', 'metaLabel'), cell(options.summary.doneCount, 'integer')],
    [],
    [cell('Maintenance Records', 'section')],
    [
      cell('Asset', 'tableHeader'), cell('Maintenance Item', 'tableHeader'), cell('Type', 'tableHeader'), cell('Status', 'tableHeader'),
      cell('Trigger', 'tableHeader'), cell('Due', 'tableHeader'), cell('Time / Usage Remaining', 'tableHeader'), cell('Current Usage', 'tableHeader'),
      cell('Reminder', 'tableHeader'), cell('Recurring', 'tableHeader'), cell('Assigned To', 'tableHeader'), cell('Planning Notes', 'tableHeader'),
      cell('Completed On (SAST)', 'tableHeader'), cell('Completed Usage', 'tableHeader'), cell('Completed By', 'tableHeader'), cell('Completion Notes', 'tableHeader'),
      cell('Record Source', 'tableHeader'), cell('Recorded Location', 'tableHeader'), cell('Latitude', 'tableHeader'), cell('Longitude', 'tableHeader'),
      cell('Photo Count', 'tableHeader'), cell('Photo Evidence URLs', 'tableHeader'), cell('Updated', 'tableHeader'),
    ],
    ...options.records.map(recordRow),
  ];

  return [{
    name: 'Maintenance Report',
    rows,
    columns: [26, 30, 15, 15, 16, 20, 24, 20, 20, 24, 22, 38, 18, 20, 22, 38, 20, 34, 14, 14, 14, 48, 18],
    freezeRow: 22,
    autoFilter: options.records.length ? { fromRow: 22, fromColumn: 1, toRow: 22 + options.records.length, toColumn: 23 } : undefined,
  }];
}
