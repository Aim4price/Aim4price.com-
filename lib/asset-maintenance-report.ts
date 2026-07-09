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

type KeyValueRow = {
  label: string;
  value: string;
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
  const label = asText(metric) || 'usage';
  return `${formatNumber(value)} ${label}`;
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
  if (record.triggerType === 'date') return formatDateOnly(record.dueDate);
  return formatUsage(record.dueUsage, record.usageMetric ?? record.assetUsageMetric);
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

function renderRows(rows: KeyValueRow[], emptyText = 'No details available.'): string {
  const visibleRows = rows.filter((row) => asText(row.label));

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
              <strong>${escapeHtml(row.value || '-')}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function buildOwnerRows(ownerDetails: AssetMaintenanceOwnerDetails): KeyValueRow[] {
  return [
    { label: 'Business Name', value: ownerDetails.businessName || '-' },
    { label: 'Contact Details', value: ownerDetails.contactDetails || '-' },
    { label: 'Business Email', value: ownerDetails.businessEmail || '-' },
    { label: 'Location / Address', value: ownerDetails.locationAddress || '-' },
  ];
}

function buildAssetRows(asset: AssetMaintenanceAssetOption | null, reportScopeLabel: string): KeyValueRow[] {
  if (!asset) {
    return [
      { label: 'Report Scope', value: reportScopeLabel || 'All maintenance records' },
      { label: 'Asset Filter', value: 'All saved assets' },
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

function renderMaintenanceRecords(records: AssetMaintenanceRecord[]): string {
  if (!records.length) {
    return '<div class="assetReportEmpty">No maintenance records match this report.</div>';
  }

  return `
    <div class="assetReportMaintenanceList">
      ${records
        .map((record) => {
          const isDone = record.status === 'done';
          return `
            <article class="assetReportMaintenanceItem ${isDone ? 'assetReportGood' : 'assetReportWarn'}">
              <div class="maintenanceItemHeader">
                <div>
                  <span class="statusPill">${escapeHtml(formatStatus(record.computedStatus))}</span>
                  <h3>${escapeHtml(formatType(record.maintenanceType))}: ${escapeHtml(record.assetTitle)}</h3>
                  <p>${escapeHtml(record.assetMeta || record.assetCategoryLabel || '-')}</p>
                </div>
                <strong>${escapeHtml(record.triggerType === 'date' ? 'Date-based' : 'Usage-based')}</strong>
              </div>
              <div class="maintenanceDetailGrid">
                <div><span>Due</span><strong>${escapeHtml(formatDue(record))}</strong></div>
                <div><span>Current Usage</span><strong>${escapeHtml(formatUsage(record.currentUsage, record.usageMetric ?? record.assetUsageMetric))}</strong></div>
                <div><span>Alert Before</span><strong>${escapeHtml(formatAlert(record))}</strong></div>
                <div><span>Recurring</span><strong>${escapeHtml(formatRecurring(record))}</strong></div>
                <div><span>Assigned To</span><strong>${escapeHtml(record.assignedName || 'All / unassigned')}</strong></div>
                <div><span>Updated</span><strong>${escapeHtml(formatDateOnly(record.updatedAtIso))}</strong></div>
                <div><span>Notes</span><strong>${escapeHtml(record.notes || '-')}</strong></div>
                <div><span>Completed</span><strong>${escapeHtml(isDone ? formatDateOnly(record.completedAtIso) : '-')}</strong></div>
                <div><span>Completed Usage</span><strong>${escapeHtml(isDone ? formatUsage(record.completedUsage, record.usageMetric ?? record.assetUsageMetric) : '-')}</strong></div>
                <div><span>Completed Notes</span><strong>${escapeHtml(isDone ? record.completedNotes || '-' : '-')}</strong></div>
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function summaryCards(summary: AssetMaintenanceSummary): string {
  const cards = [
    { label: 'Total Records', value: summary.totalCount },
    { label: 'Open', value: summary.openCount },
    { label: 'Due Soon', value: summary.dueSoonCount },
    { label: 'Due', value: summary.dueCount },
    { label: 'Overdue', value: summary.overdueCount },
    { label: 'Done', value: summary.doneCount },
  ];

  return `
    <div class="assetReportSummaryGrid">
      ${cards
        .map(
          (card) => `
            <div>
              <span>${escapeHtml(card.label)}</span>
              <strong>${escapeHtml(formatCount(card.value))}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

export function buildAssetMaintenanceReportHtml(options: AssetMaintenanceReportOptions): string {
  const logo = options.logoUrl
    ? `<img class="assetReportLogo" src="${escapeHtml(options.logoUrl)}" alt="Aim4price logo" />`
    : `<div class="assetReportLogoText">AIM4PRICE</div>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
  <style>
    :root {
      color-scheme: light;
      --brand-dark: #073b30;
      --brand-mid: #197454;
      --brand-soft: #eaf7f1;
      --line: #dce8ef;
      --text: #17372f;
      --muted: #657789;
      --warn-bg: #fff4f4;
      --warn-border: #f0caca;
      --good-bg: #eefaf3;
      --good-border: #c8ebd6;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f4f8f8; color: var(--text); font-family: Arial, Helvetica, sans-serif; }
    .assetReportPage { width: min(1120px, calc(100% - 32px)); margin: 24px auto; padding: 28px; background: #fff; border: 1px solid var(--line); border-radius: 24px; box-shadow: 0 18px 50px rgba(10, 34, 40, 0.1); }
    .assetReportTopbar { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
    .assetReportBrand { display: flex; gap: 14px; align-items: center; }
    .assetReportLogo { max-width: 130px; max-height: 68px; object-fit: contain; }
    .assetReportLogoText { font-weight: 900; letter-spacing: 0.08em; color: var(--brand-dark); }
    .assetReportActions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
    .assetReportButton { border: 1px solid #b9d8c7; border-radius: 12px; padding: 10px 14px; background: #f4fbf7; color: var(--brand-dark); font-weight: 800; text-decoration: none; }
    .assetReportPrintButton { cursor: pointer; }
    .assetReportHeader { margin: 24px 0; }
    .assetReportEyebrow { margin: 0 0 8px; color: var(--brand-mid); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; font-weight: 900; }
    h1 { margin: 0; color: var(--brand-dark); font-size: 42px; line-height: .98; letter-spacing: -.05em; text-transform: uppercase; }
    .assetReportSubtitle { margin: 10px 0 0; color: var(--muted); font-weight: 700; }
    .assetReportGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 18px; }
    .assetReportPanel { border: 1px solid var(--line); border-radius: 18px; padding: 18px; background: #fbfdfd; }
    .assetReportPanel h2 { margin: 0 0 14px; font-size: 15px; color: var(--brand-dark); text-transform: uppercase; letter-spacing: .06em; }
    .assetReportRows { display: grid; gap: 10px; }
    .assetReportRow { display: grid; grid-template-columns: 145px 1fr; gap: 12px; align-items: baseline; }
    .assetReportRow span, .assetReportMaintenanceItem span, .assetReportSummaryGrid span { color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
    .assetReportRow strong { font-size: 14px; color: #17372f; }
    .assetReportSummaryGrid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin: 18px 0; }
    .assetReportSummaryGrid div { padding: 14px; border: 1px solid var(--line); border-radius: 16px; background: #fbfdfd; }
    .assetReportSummaryGrid strong { display: block; margin-top: 6px; color: var(--brand-dark); font-size: 24px; }
    .assetReportMaintenanceList { display: grid; gap: 14px; margin-top: 18px; }
    .assetReportMaintenanceItem { border-radius: 20px; padding: 18px; border: 1px solid var(--line); background: #fff; }
    .assetReportGood { background: var(--good-bg); border-color: var(--good-border); }
    .assetReportWarn { background: var(--warn-bg); border-color: var(--warn-border); }
    .maintenanceItemHeader { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; border-bottom: 1px solid rgba(0,0,0,.08); padding-bottom: 12px; margin-bottom: 12px; }
    .maintenanceItemHeader h3 { margin: 8px 0 4px; color: var(--brand-dark); font-size: 22px; letter-spacing: -.03em; }
    .maintenanceItemHeader p { margin: 0; color: var(--muted); font-weight: 700; }
    .statusPill { display: inline-flex; padding: 6px 10px; border-radius: 999px; background: #fff; border: 1px solid rgba(7, 59, 48, .16); color: var(--brand-dark) !important; }
    .maintenanceDetailGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
    .maintenanceDetailGrid div { min-width: 0; }
    .maintenanceDetailGrid strong { display: block; margin-top: 4px; overflow-wrap: anywhere; }
    .assetReportEmpty { padding: 18px; border-radius: 16px; border: 1px dashed var(--line); color: var(--muted); font-weight: 700; }
    @media print { body { background: #fff; } .assetReportPage { width: auto; margin: 0; border: 0; border-radius: 0; box-shadow: none; } .assetReportActions { display: none; } }
    @media (max-width: 840px) { .assetReportGrid, .maintenanceDetailGrid { grid-template-columns: 1fr; } .assetReportSummaryGrid { grid-template-columns: repeat(2, 1fr); } h1 { font-size: 34px; } }
  </style>
</head>
<body>
  <main class="assetReportPage">
    <section class="assetReportTopbar">
      <div class="assetReportBrand">${logo}</div>
      <div class="assetReportActions">
        <a class="assetReportButton" href="${escapeHtml(options.xlsxUrl)}">Download Excel</a>
        <button class="assetReportButton assetReportPrintButton" onclick="window.print()">Print / Save PDF</button>
      </div>
    </section>

    <section class="assetReportHeader">
      <p class="assetReportEyebrow">${escapeHtml(options.subtitle)}</p>
      <h1>${escapeHtml(options.title)}</h1>
      <p class="assetReportSubtitle">${escapeHtml(options.reportScopeLabel)} • Generated ${escapeHtml(options.generatedAt)} • ${escapeHtml(options.ownerEmail)}</p>
    </section>

    <section class="assetReportGrid">
      <div class="assetReportPanel">
        <h2>Owner / Company</h2>
        ${renderRows(buildOwnerRows(options.ownerDetails))}
      </div>
      <div class="assetReportPanel">
        <h2>Asset / Scope</h2>
        ${renderRows(buildAssetRows(options.selectedAsset, options.reportScopeLabel))}
      </div>
    </section>

    ${summaryCards(options.summary)}

    <section class="assetReportPanel">
      <h2>Maintenance Timeline</h2>
      ${renderMaintenanceRecords(options.records)}
    </section>
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
    cell(formatType(record.maintenanceType), 'text'),
    cell(formatStatus(record.computedStatus), record.status === 'done' ? 'statusGood' : record.computedStatus === 'overdue' ? 'statusBad' : record.computedStatus === 'due' || record.computedStatus === 'due_soon' ? 'statusWarn' : 'statusInfo'),
    cell(record.triggerType === 'date' ? 'Specific Date' : 'Usage', 'text'),
    cell(formatDue(record), 'text'),
    cell(formatUsage(record.currentUsage, record.usageMetric ?? record.assetUsageMetric), 'text'),
    cell(formatAlert(record), 'text'),
    cell(formatRecurring(record), 'text'),
    cell(record.assignedName || 'All / unassigned', 'text'),
    cell(record.notes || '-', 'note'),
    cell(formatDateOnly(record.completedAtIso), 'date'),
    cell(formatUsage(record.completedUsage, record.usageMetric ?? record.assetUsageMetric), 'text'),
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
    [cell('Summary', 'section')],
    [cell('Total', 'metaLabel'), cell(options.summary.totalCount, 'integer')],
    [cell('Open', 'metaLabel'), cell(options.summary.openCount, 'integer')],
    [cell('Due Soon', 'metaLabel'), cell(options.summary.dueSoonCount, 'integer')],
    [cell('Due', 'metaLabel'), cell(options.summary.dueCount, 'integer')],
    [cell('Overdue', 'metaLabel'), cell(options.summary.overdueCount, 'integer')],
    [cell('Done', 'metaLabel'), cell(options.summary.doneCount, 'integer')],
    [],
    [cell('Maintenance Records', 'section')],
    [
      cell('Asset', 'tableHeader'),
      cell('Type', 'tableHeader'),
      cell('Status', 'tableHeader'),
      cell('Trigger', 'tableHeader'),
      cell('Due', 'tableHeader'),
      cell('Current Usage', 'tableHeader'),
      cell('Alert Before', 'tableHeader'),
      cell('Recurring', 'tableHeader'),
      cell('Assigned To', 'tableHeader'),
      cell('Notes', 'tableHeader'),
      cell('Completed Date', 'tableHeader'),
      cell('Completed Usage', 'tableHeader'),
      cell('Completed Notes', 'tableHeader'),
      cell('Updated', 'tableHeader'),
    ],
    ...options.records.map(recordRow),
  ];

  return [
    {
      name: 'Maintenance Report',
      rows,
      columns: [26, 16, 16, 16, 22, 20, 18, 24, 22, 38, 18, 20, 38, 18],
      freezeRow: 22,
      autoFilter: options.records.length
        ? { fromRow: 22, fromColumn: 1, toRow: 22 + options.records.length, toColumn: 14 }
        : undefined,
    },
  ];
}
