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

function formatDateOnly(value?: string | null): string {
  if (!value) return '-';
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: value.includes('T') ? 'Africa/Johannesburg' : 'UTC',
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
    .map((record) => record.updatedAtIso)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0];
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
        { label: 'Completed', value: formatDateOnly(record.completedAtIso) },
        { label: 'Completed Usage', value: formatUsage(record.completedUsage, record.usageMetric ?? record.assetUsageMetric) },
        { label: 'Completed By', value: record.completedBy || record.assignedName || '-' },
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
<title>${escapeHtml(options.title)}</title>
<style>
  :root { color-scheme: light; --ink:#0b1116; --muted:#66717c; --line:#cfd6dc; --soft:#f5f7f8; --green:#0b4a3a; --green-soft:#eaf4f0; --amber:#815c12; --amber-soft:#fff7e3; --red:#8b2424; --red-soft:#fff0f0; }
  * { box-sizing:border-box; }
  body { margin:0; background:#fff; color:var(--ink); font-family:Arial,Helvetica,sans-serif; font-size:13px; }
  .reportPage { width:min(1120px,calc(100% - 36px)); margin:18px auto; }
  .topbar { min-height:82px; display:grid; grid-template-columns:1fr auto; gap:24px; align-items:start; padding:18px 20px 22px; border-bottom:1px solid #aeb7bf; }
  .brand { display:flex; align-items:center; gap:24px; }
  .assetReportLogo { width:74px; height:52px; object-fit:contain; }
  .assetReportLogoFallback { width:52px; height:52px; display:grid; place-items:center; border:2px solid var(--ink); border-radius:50%; font-weight:900; }
  .brand h1 { margin:0 0 8px; font-size:23px; line-height:1; letter-spacing:-.03em; }
  .brand p { margin:0; color:var(--muted); font-weight:700; }
  .meta { display:grid; grid-template-columns:auto auto; gap:9px 40px; min-width:320px; }
  .meta span { color:var(--muted); font-weight:700; }
  .meta strong { text-align:right; }
  .actions { display:flex; justify-content:flex-end; gap:8px; margin:12px 20px 0; }
  .action { border:1px solid #bfc8ce; background:#fff; color:var(--ink); border-radius:6px; padding:8px 12px; text-decoration:none; font-weight:800; cursor:pointer; }
  .hero { display:grid; grid-template-columns:minmax(0,2.1fr) minmax(280px,1fr); margin-top:16px; border:1px solid #bfc7cd; }
  .heroMain { min-height:160px; padding:20px; border-right:1px solid #bfc7cd; }
  .eyebrow { margin:0 0 12px; color:#4f5c66; font-size:12px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
  .heroTitle { margin:0; font-size:31px; line-height:1.05; letter-spacing:-.04em; }
  .heroMeta { margin:12px 0 0; color:#39444d; font-weight:700; }
  .heroStatus { padding:20px; background:#fafbfb; }
  .heroStatus span { display:block; font-size:12px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
  .heroStatus strong { display:block; margin:8px 0 12px; font-size:31px; line-height:1.05; }
  .heroStatus p { margin:0; color:var(--muted); font-weight:700; }
  .detailsGrid { display:grid; grid-template-columns:minmax(0,2fr) minmax(280px,1fr); gap:16px; margin:16px 0; }
  .stack { display:grid; gap:14px; }
  .panel { border:1px solid #bfc7cd; padding:15px 16px; }
  .panel h2 { margin:0 0 10px; font-size:16px; }
  .assetReportRows { border-top:1px solid var(--line); }
  .assetReportRow { display:grid; grid-template-columns:158px minmax(0,1fr); gap:16px; padding:7px 0; border-bottom:1px solid var(--line); }
  .assetReportRow span { color:#596671; font-weight:700; }
  .assetReportRow strong { overflow-wrap:anywhere; }
  .statusGrid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); border:1px solid #bfc7cd; margin-bottom:16px; }
  .statusGrid div { padding:13px 15px; border-right:1px solid var(--line); }
  .statusGrid div:last-child { border-right:0; }
  .statusGrid span { display:block; color:#5e6a74; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.06em; }
  .statusGrid strong { display:block; margin-top:6px; font-size:22px; }
  .recordsSection { margin-top:16px; border:1px solid #bfc7cd; padding:15px 16px 16px; break-inside:auto; }
  .sectionHeading { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; margin-bottom:11px; }
  .sectionHeading h2 { margin:0 0 4px; font-size:17px; }
  .sectionHeading p { margin:0; color:var(--muted); font-weight:600; }
  .sectionHeading > strong { padding:7px 14px; border:1px solid var(--line); white-space:nowrap; }
  .maintenanceList { display:grid; gap:12px; }
  .maintenanceCard { border:1px solid var(--line); break-inside:avoid; }
  .maintenanceCardHead { display:grid; grid-template-columns:minmax(0,1fr) 150px; gap:18px; padding:13px 14px; background:var(--soft); border-bottom:1px solid var(--line); }
  .maintenanceCardHead h3 { margin:7px 0 4px; font-size:16px; }
  .maintenanceCardHead p { margin:0; color:#505d67; font-weight:700; }
  .statusPill { display:inline-block; padding:4px 8px; border:1px solid #aeb9bf; border-radius:999px; background:#fff; color:#39444d; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.05em; }
  .status-overdue { color:var(--red); border-color:#e4baba; background:var(--red-soft); }
  .status-due,.status-due_soon { color:var(--amber); border-color:#ead69e; background:var(--amber-soft); }
  .status-done { color:var(--green); border-color:#b9d9cd; background:var(--green-soft); }
  .maintenanceType { text-align:right; }
  .maintenanceType span,.maintenanceType small { display:block; color:var(--muted); font-size:10px; font-weight:800; text-transform:uppercase; }
  .maintenanceType strong { display:block; margin:4px 0; }
  .maintenanceDetails { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
  .maintenanceDetail { min-height:58px; padding:10px 13px; border-right:1px solid var(--line); border-bottom:1px solid var(--line); }
  .maintenanceDetail:nth-child(2n) { border-right:0; }
  .maintenanceDetail span { display:block; color:#65717b; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.05em; }
  .maintenanceDetail strong { display:block; margin-top:5px; overflow-wrap:anywhere; }
  .assetReportEmpty { padding:20px; border:1px dashed #bfc7cd; color:var(--muted); font-weight:700; }
  .footer { display:grid; grid-template-columns:1fr auto; gap:24px; margin-top:18px; padding:12px 0 0; border-top:1px solid #aeb7bf; font-size:10px; color:#5f6971; }
  .footer strong { display:block; margin-bottom:6px; color:var(--ink); font-size:11px; }
  .footer p { margin:0; font-style:italic; line-height:1.35; }
  @media(max-width:800px){ .topbar,.hero,.detailsGrid{grid-template-columns:1fr}.meta{min-width:0}.heroMain{border-right:0;border-bottom:1px solid #bfc7cd}.statusGrid{grid-template-columns:repeat(2,1fr)}.maintenanceCardHead{grid-template-columns:1fr}.maintenanceType{text-align:left}.maintenanceDetails{grid-template-columns:1fr}.maintenanceDetail{border-right:0}.actions{margin-left:0;margin-right:0}.reportPage{width:calc(100% - 20px)} }
  @media print { @page{size:A4 landscape;margin:10mm} body{font-size:10px}.reportPage{width:auto;margin:0}.actions{display:none}.topbar{padding-top:0}.heroMain{min-height:125px}.recordsSection{margin-top:10px}.maintenanceCardHead{padding:9px 10px}.maintenanceDetail{min-height:44px;padding:7px 10px}.footer{position:relative}.footerPage:after{content:'Page ' counter(page)} }
</style>
</head>
<body>
<main class="reportPage">
  <header class="topbar">
    <div class="brand">${logo}<div><h1>${escapeHtml(options.title)}</h1><p>${escapeHtml(options.subtitle)}</p></div></div>
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
</body>
</html>`;
}

function cell(value: unknown, style: XlsxCellStyle = 'default'): XlsxCellValue {
  return { value: value as string | number | boolean | Date | null | undefined, style };
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
    cell(formatDateOnly(record.completedAtIso), 'date'),
    cell(formatUsage(record.completedUsage, record.usageMetric ?? record.assetUsageMetric), 'text'),
    cell(record.completedBy || '-', 'text'),
    cell(record.completedNotes || '-', 'note'),
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
      cell('Completed Date', 'tableHeader'), cell('Completed Usage', 'tableHeader'), cell('Completed By', 'tableHeader'), cell('Completion Notes', 'tableHeader'), cell('Updated', 'tableHeader'),
    ],
    ...options.records.map(recordRow),
  ];

  return [{
    name: 'Maintenance Report',
    rows,
    columns: [26, 30, 15, 15, 16, 20, 24, 20, 20, 24, 22, 38, 18, 20, 22, 38, 18],
    freezeRow: 22,
    autoFilter: options.records.length ? { fromRow: 22, fromColumn: 1, toRow: 22 + options.records.length, toColumn: 17 } : undefined,
  }];
}
