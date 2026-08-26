import type { AccountProfile } from './account-profile';
import type { MyInvoiceAssetOption, MyInvoiceRecord, MyInvoiceSummary } from './my-invoices';
import type { XlsxCellStyle, XlsxCellValue, XlsxPrimitiveCellValue, XlsxSheet } from './simple-xlsx';

export type MyInvoicesOwnerDetails = {
  businessName: string;
  contactDetails: string;
  businessEmail: string;
  locationAddress: string;
};

export type MyInvoicesReportOptions = {
  title: string;
  subtitle: string;
  generatedAt: string;
  ownerEmail: string;
  ownerDetails: MyInvoicesOwnerDetails;
  logoUrl: string;
  dateRangeLabel: string;
  assetLabel: string;
  selectedAsset: MyInvoiceAssetOption | null;
  summary: MyInvoiceSummary;
  invoices: MyInvoiceRecord[];
  includeFuelSlipCosts: boolean;
  xlsxUrl: string;
  hideXlsx?: boolean;
};

type KeyValueRow = {
  label: string;
  value: string;
};

const NOT_RECORDED = 'Not recorded';

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeSpaces(value: unknown): string {
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

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'R 0';

  return `R ${Math.round(value).toLocaleString('en-ZA')}`;
}

function formatMoneyWithCents(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'R 0.00';

  return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  return Math.max(0, Math.round(value)).toLocaleString('en-ZA');
}

function formatAssetKind(asset: MyInvoiceAssetOption | null): string {
  if (!asset) return 'Cost of ownership';

  const kind = asText(asset.kind).toLowerCase();
  if (kind === 'tractor') return 'Tractor';
  if (kind === 'vehicle') return 'Vehicle';
  if (kind === 'property') return 'Property';
  if (kind === 'tools') return 'Tools';
  if (kind === 'stock') return 'Stock';
  if (kind === 'equipment') return 'Equipment';
  if (kind === 'manual') return 'Manual asset';

  return asText(asset.categoryLabel) || 'Asset';
}

function invoiceCountLabel(count: number): string {
  return count === 1 ? '1 approved invoice' : `${formatCount(count)} approved invoices`;
}

function invoiceRecordCountLabel(count: number): string {
  return count === 1 ? '1 record' : `${formatCount(count)} records`;
}

function latestInvoiceDateLabel(options: MyInvoicesReportOptions): string {
  const latestInvoiceDate = options.invoices
    .map((invoice) => invoice.invoiceDate)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0];

  return latestInvoiceDate ? formatDateOnly(latestInvoiceDate) : options.generatedAt;
}

function formatUsage(asset: MyInvoiceAssetOption | null): string {
  if (!asset || typeof asset.usageReading !== 'number' || !Number.isFinite(asset.usageReading)) return '-';
  return `${asset.usageReading.toLocaleString('en-ZA')} ${asset.usageMetric}`;
}

function formatCondition(value: string): string {
  const normalized = asText(value).toLowerCase();
  if (!normalized) return NOT_RECORDED;

  return ({
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    used: 'Used',
    serious: 'Requires attention',
  } as Record<string, string>)[normalized] ?? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function buildOwnerLocationAddress(profile: AccountProfile | null): string {
  if (!profile) return '';

  const address = [profile.addressLine1, profile.addressLine2, profile.townCity, profile.province]
    .map((part) => asText(part))
    .filter(Boolean)
    .join(', ');

  return address || asText(profile.marketplaceLocation);
}

export function buildMyInvoicesOwnerDetails(
  profile: AccountProfile | null,
  fallbackUser: { name?: unknown; email?: unknown },
): MyInvoicesOwnerDetails {
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
              <strong>${escapeHtml(row.value || NOT_RECORDED)}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function buildOwnerRows(ownerDetails: MyInvoicesOwnerDetails): KeyValueRow[] {
  return [
    { label: 'Business name', value: ownerDetails.businessName || NOT_RECORDED },
    { label: 'Contact details', value: ownerDetails.contactDetails || NOT_RECORDED },
    { label: 'Business email', value: ownerDetails.businessEmail || NOT_RECORDED },
    { label: 'Location / address', value: ownerDetails.locationAddress || NOT_RECORDED },
  ];
}

function buildAssetRows(asset: MyInvoiceAssetOption | null): KeyValueRow[] {
  if (!asset) {
    return [
      { label: 'Report Scope', value: 'All selected assets' },
      { label: 'Asset Filter', value: 'All assets' },
    ];
  }

  return [
    { label: 'Category', value: formatAssetKind(asset) },
    { label: 'Asset', value: asset.title || NOT_RECORDED },
    { label: 'Model year', value: asset.yearModel ? String(asset.yearModel) : NOT_RECORDED },
    { label: 'Usage', value: formatUsage(asset) === '-' ? NOT_RECORDED : formatUsage(asset) },
    { label: 'Condition', value: formatCondition(asset.condition) },
    { label: 'Current value (excl. VAT)', value: formatMoney(asset.value) },
  ];
}

function invoiceBlockText(invoice: MyInvoiceRecord, blockType: 'maintenance' | 'parts' | 'repair'): string {
  const block = invoice.blocks.find((entry) => entry.blockType === blockType);
  return normalizeSpaces(block?.description) || NOT_RECORDED;
}

function invoiceSourceLabel(invoice: MyInvoiceRecord): string {
  if (invoice.source === 'fuel_slip') return 'Fuel Slip';
  if (invoice.source === 'automatic') return 'Aim4price captured';
  return 'Manual';
}

function fuelSlipInvoices(options: MyInvoicesReportOptions): MyInvoiceRecord[] {
  return options.includeFuelSlipCosts
    ? options.invoices.filter((invoice) => invoice.source === 'fuel_slip')
    : [];
}

function fuelSlipSpend(options: MyInvoicesReportOptions): number {
  return fuelSlipInvoices(options).reduce((sum, invoice) => sum + invoice.totalIncVat, 0);
}

const ACCOUNTING_HEADERS = [
  'Date',
  'Effect',
  'Supplier',
  'Reference',
  'Description',
  'VAT %',
  'Excl. VAT',
  'VAT',
  'Incl. VAT',
  'by Affecting Acc.',
] as const;

function accountingInvoiceDate(invoice: MyInvoiceRecord): string {
  return invoice.invoiceDate || invoice.createdAtIso.slice(0, 10);
}

function accountingDescription(invoice: MyInvoiceRecord): string {
  const details = [
    invoice.maintenanceWorkDone ? `Maintenance: ${normalizeSpaces(invoice.maintenanceWorkDone)}` : '',
    invoice.partsSupplied ? `Parts: ${normalizeSpaces(invoice.partsSupplied)}` : '',
    invoice.repairWorkDone ? `Repairs: ${normalizeSpaces(invoice.repairWorkDone)}` : '',
    invoice.notes ? `Notes: ${normalizeSpaces(invoice.notes)}` : '',
  ].filter(Boolean);
  const asset = normalizeSpaces(invoice.assetTitle) || 'Saved asset';

  return details.length ? `${asset} — ${details.join('; ')}` : `${asset} — Asset cost`;
}

function accountingVatRate(invoice: MyInvoiceRecord): string {
  const vat = invoice.vatAmount ?? 0;
  const exclVat = invoice.subtotalExVat ?? Math.max(0, invoice.totalIncVat - vat);
  if (vat <= 0 || exclVat <= 0) return 'No VAT';

  const rate = Math.round((vat / exclVat) * 10000) / 100;
  return `${rate.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}%`;
}

function accountingAffectingAccount(invoice: MyInvoiceRecord): string {
  const category = normalizeSpaces(invoice.assetCategoryLabel || invoice.assetKind) || 'Assets';
  return invoice.source === 'fuel_slip'
    ? `Fuel - ${category}`
    : `Repairs and maintenance - ${category}`;
}

function accountingValues(invoice: MyInvoiceRecord): XlsxPrimitiveCellValue[] {
  const vat = Math.round((invoice.vatAmount ?? 0) * 100) / 100;
  const exclVat = Math.round((invoice.subtotalExVat ?? Math.max(0, invoice.totalIncVat - vat)) * 100) / 100;
  const inclVat = Math.round(invoice.totalIncVat * 100) / 100;

  return [
    accountingInvoiceDate(invoice),
    'Increase',
    invoice.supplierName || 'Unknown supplier',
    invoice.invoiceNumber || `AIM-${invoice.id.slice(0, 8).toUpperCase()}`,
    accountingDescription(invoice),
    accountingVatRate(invoice),
    exclVat,
    vat,
    inclVat,
    accountingAffectingAccount(invoice),
  ];
}

function csvCell(value: XlsxPrimitiveCellValue): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildMyInvoicesAccountingCsv(invoices: MyInvoiceRecord[]): string {
  const rows = [
    [...ACCOUNTING_HEADERS],
    ...invoices.map(accountingValues),
  ];

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function renderInvoiceRecords(invoices: MyInvoiceRecord[]): string {
  if (!invoices.length) {
    return '<div class="assetReportEmpty">No invoices have been saved for this report period.</div>';
  }

  return `
    <div class="assetReportMaintenanceList">
      ${invoices
        .map((invoice) => {
          const attachmentLabel = invoice.document ? `${invoice.document.fileName || 'Attached document'} (${invoice.document.contentType || 'file'})` : 'No attachment';
          const costDetailsHtml = invoice.source === 'fuel_slip'
            ? `
                <div class="assetReportMaintenanceDetail assetReportMaintenanceDetailWide">
                  <span>Fuel purchase / notes</span>
                  <strong>${escapeHtml(invoice.notes || 'Fuel slip cost')}</strong>
                </div>
              `
            : `
                <div class="assetReportMaintenanceDetail assetReportMaintenanceDetailWide">
                  <span>Maintenance Work Done</span>
                  <strong>${escapeHtml(invoiceBlockText(invoice, 'maintenance'))}</strong>
                </div>
                <div class="assetReportMaintenanceDetail assetReportMaintenanceDetailWide">
                  <span>Parts Supplied</span>
                  <strong>${escapeHtml(invoiceBlockText(invoice, 'parts'))}</strong>
                </div>
                <div class="assetReportMaintenanceDetail assetReportMaintenanceDetailWide">
                  <span>Repair Work Done</span>
                  <strong>${escapeHtml(invoiceBlockText(invoice, 'repair'))}</strong>
                </div>
                <div class="assetReportMaintenanceDetail assetReportMaintenanceDetailWide">
                  <span>Notes</span>
                  <strong>${escapeHtml(invoice.notes || 'No notes recorded')}</strong>
                </div>
              `;

          return `
            <article class="assetReportMaintenanceCard">
              <div class="assetReportMaintenanceHeader assetReportInvoiceHeader">
                <div>
                  <span>Invoice Date</span>
                  <strong>${escapeHtml(formatDateOnly(invoice.invoiceDate))}</strong>
                </div>
                <div>
                  <span>Supplier</span>
                  <strong>${escapeHtml(invoice.supplierName || NOT_RECORDED)}</strong>
                </div>
                <div>
                  <span>Invoice Number</span>
                  <strong>${escapeHtml(invoice.invoiceNumber || NOT_RECORDED)}</strong>
                </div>
                <div>
                  <span>Asset</span>
                  <strong>${escapeHtml(invoice.assetTitle || NOT_RECORDED)}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>${escapeHtml(formatMoneyWithCents(invoice.totalIncVat))}</strong>
                </div>
              </div>

              <div class="assetReportMaintenanceDetails assetReportInvoiceDetails">
                ${costDetailsHtml}
                <div class="assetReportMaintenanceDetail assetReportMaintenanceDetailWide">
                  <span>Attached Document / Photo</span>
                  <strong>${escapeHtml(attachmentLabel)}</strong>
                </div>
                <div class="assetReportMaintenanceDetail assetReportMaintenanceDetailWide">
                  <span>Source</span>
                  <strong>${escapeHtml(invoiceSourceLabel(invoice))}</strong>
                </div>
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function buildSummaryRows(options: MyInvoicesReportOptions): KeyValueRow[] {
  const fuelInvoices = fuelSlipInvoices(options);

  return [
    { label: 'Report Period', value: options.dateRangeLabel },
    { label: 'Asset Filter', value: options.assetLabel },
    { label: 'External Fuel Costs', value: options.includeFuelSlipCosts ? 'Included' : 'Excluded' },
    { label: 'Invoices', value: options.summary.invoiceCount.toLocaleString('en-ZA') },
    { label: 'Total Spend', value: formatMoneyWithCents(options.summary.totalSpent) },
    { label: 'Maintenance Spend', value: formatMoneyWithCents(options.summary.maintenanceSpend) },
    { label: 'Parts Spend', value: formatMoneyWithCents(options.summary.partsSpend) },
    { label: 'Repair Spend', value: formatMoneyWithCents(options.summary.repairSpend) },
    { label: 'Fuel Slip Records', value: options.includeFuelSlipCosts ? formatCount(fuelInvoices.length) : 'Excluded' },
    { label: 'Fuel Slip Spend', value: options.includeFuelSlipCosts ? formatMoneyWithCents(fuelSlipSpend(options)) : 'Excluded' },
    { label: 'VAT Total', value: formatMoneyWithCents(options.summary.vatTotal) },
    { label: 'Updated', value: latestInvoiceDateLabel(options) },
  ];
}

export function buildMyInvoicesReportHtml(options: MyInvoicesReportOptions): string {
  const updatedLabel = latestInvoiceDateLabel(options);
  const heroTitle = options.selectedAsset?.title || 'All selected assets';
  const heroMeta = options.selectedAsset ? options.selectedAsset.meta : `${formatCount(options.summary.invoiceCount)} invoice records • ${options.dateRangeLabel}`;
  const reportSubtitle = options.subtitle || 'Aim4price asset register';
  const disclaimer = 'Cost of Ownership records are based on invoices manually entered or uploaded by the account user. This report is an operational ownership-cost summary and not a certified accounting, tax or mechanical audit report.';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)} - Aim4price</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: light;
        --ink: #111827;
        --strong: #070b12;
        --muted: #5f6b7a;
        --paper: #ffffff;
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
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px 16px;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.96);
        border-bottom: 1px solid #d7dce2;
        box-shadow: 0 10px 26px rgba(17, 24, 39, 0.07);
      }

      .assetReportScreenText {
        min-width: 0;
        margin: 0;
        color: var(--muted);
        font-size: 12.5px;
        line-height: 1.4;
      }

      .assetReportScreenActions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: nowrap;
      }

      .assetReportButton {
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        min-height: 42px;
        padding: 0 16px;
        border: 1px solid #cfd5dd;
        border-radius: 999px;
        background: #ffffff;
        color: var(--ink);
        font: inherit;
        font-size: 12.5px;
        font-weight: 800;
        line-height: 1;
        text-decoration: none;
        white-space: nowrap;
        cursor: pointer;
      }

      .assetReportButtonPrimary {
        min-width: 150px;
        border-color: var(--strong);
        background: var(--strong);
        color: #ffffff;
        box-shadow: 0 12px 22px rgba(7, 11, 18, 0.18);
      }

      .assetReportButton:focus-visible {
        outline: 3px solid rgba(17, 24, 39, 0.18);
        outline-offset: 2px;
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
        display: flex;
        min-height: calc(297mm - 20mm);
        flex-direction: column;
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
        max-height: 18mm;
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

      .assetReportMainStack,
      .assetReportFullStack {
        display: grid;
        gap: 10px;
      }

      .assetReportFullStack {
        margin-top: 10px;
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
        width: 100%;
        break-inside: auto;
      }

      .assetReportSectionHeading {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: start;
        margin-bottom: 8px;
      }

      .assetReportSectionHeading h2 {
        margin-bottom: 4px;
      }

      .assetReportSectionHeading p {
        margin: 0;
        max-width: 140mm;
        color: var(--muted);
        font-size: 8px;
        line-height: 1.35;
        font-weight: 600;
      }

      .assetReportSectionHeading > strong {
        display: inline-flex;
        min-width: 24mm;
        min-height: 22px;
        align-items: center;
        justify-content: center;
        padding: 3px 8px;
        border: 1px solid var(--line);
        background: var(--soft-2);
        color: var(--strong);
        font-size: 8px;
        font-weight: 800;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .assetReportMaintenanceList {
        display: grid;
        gap: 8px;
      }

      .assetReportMaintenanceCard {
        break-inside: avoid;
        page-break-inside: avoid;
        border: 1px solid var(--line);
        background: #ffffff;
      }

      .assetReportMaintenanceHeader {
        display: grid;
        grid-template-columns: 31mm 36mm 35mm minmax(0, 1fr);
        gap: 0;
        border-bottom: 1px solid var(--line);
        background: var(--soft-2);
      }

      .assetReportInvoiceHeader {
        grid-template-columns: 27mm 39mm 34mm minmax(0, 1fr) 28mm;
      }

      .assetReportMaintenanceHeader div {
        min-width: 0;
        padding: 7px 8px;
        border-right: 1px solid var(--line);
      }

      .assetReportMaintenanceHeader div:last-child {
        border-right: 0;
      }

      .assetReportMaintenanceHeader span,
      .assetReportMaintenanceDetail span {
        display: block;
        margin-bottom: 3px;
        color: var(--muted);
        font-size: 7.3px;
        line-height: 1.15;
        font-weight: 800;
        letter-spacing: 0.045em;
        text-transform: uppercase;
      }

      .assetReportMaintenanceHeader strong,
      .assetReportMaintenanceDetail strong {
        display: block;
        color: var(--strong);
        font-size: 8.6px;
        line-height: 1.35;
        font-weight: 700;
        overflow-wrap: anywhere;
      }

      .assetReportMaintenanceDetails {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }

      .assetReportMaintenanceDetail {
        min-width: 0;
        padding: 7px 8px;
        border-right: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
      }

      .assetReportMaintenanceDetail:nth-child(2n) {
        border-right: 0;
      }

      .assetReportMaintenanceDetailWide {
        grid-column: 1 / -1;
        border-right: 0;
      }

      .assetReportMaintenanceDetail:last-child {
        border-bottom: 0;
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
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
        align-items: end;
        margin-top: auto;
        padding-top: 12px;
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

      @media screen and (max-width: 760px) {
        .assetReportScreenBar {
          grid-template-columns: 1fr;
          padding: 10px 12px 12px;
        }

        .assetReportScreenText {
          font-size: 12px;
        }

        .assetReportScreenActions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          width: 100%;
          gap: 8px;
        }

        .assetReportButton {
          width: 100%;
          min-height: 44px;
          padding: 0 10px;
          font-size: 12px;
        }

        .assetReportButtonPrimary {
          min-width: 0;
        }

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

        .assetReportMaintenanceHeader,
        .assetReportMaintenanceDetails,
        .assetReportSectionHeading {
          grid-template-columns: 1fr;
        }

        .assetReportMaintenanceHeader div,
        .assetReportMaintenanceDetail {
          border-right: 0;
        }
      }

      @media screen and (max-width: 380px) {
        .assetReportScreenActions {
          grid-template-columns: 1fr;
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
          min-height: 0;
        }

        .assetReportFooter {
          margin-top: 12px;
        }

        .assetReportHeader {
          grid-template-columns: 22mm minmax(0, 1fr) 62mm;
        }

        .assetReportOverview,
        .assetReportContentGrid {
          grid-template-columns: minmax(0, 1fr) 62mm;
        }

        .assetReportMaintenanceCard {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    <div class="assetReportScreenBar">
      <p class="assetReportScreenText"><strong>${escapeHtml(options.title)}</strong> - ${options.hideXlsx ? 'use Print / Save as PDF to download your report.' : 'use Print / Save as PDF for a PDF copy, or download the XLSX workbook.'}</p>
      <div class="assetReportScreenActions">
        ${options.hideXlsx ? '' : `<a class="assetReportButton" href="${escapeHtml(options.xlsxUrl)}">Download XLSX</a>`}
        <button type="button" class="assetReportButton assetReportButtonPrimary" onclick="window.print()">Print / Save PDF</button>
      </div>
    </div>

    <main class="assetReportPage">
      <div class="assetReportInner">
        <header class="assetReportHeader">
          <div class="assetReportLogoWrap">${options.logoUrl ? `<img class="assetReportLogo" src="${escapeHtml(options.logoUrl)}" alt="Logo" />` : ''}</div>
          <div class="assetReportDocumentTitle">
            <strong>${escapeHtml(options.title)}</strong>
            <span>${escapeHtml(reportSubtitle)}</span>
          </div>
          <div class="assetReportHeaderMeta">
            <div class="assetReportMetaLine"><span>Generated</span><strong>${escapeHtml(options.generatedAt)}</strong></div>
            ${options.ownerEmail ? `<div class="assetReportMetaLine"><span>Business Email</span><strong>${escapeHtml(options.ownerEmail)}</strong></div>` : ''}
          </div>
        </header>

        <section class="assetReportOverview">
          <div class="assetReportIdentity">
            <p class="assetReportKicker">${escapeHtml(formatAssetKind(options.selectedAsset))}</p>
            <h1 class="assetReportTitle">${escapeHtml(heroTitle)}</h1>
            <p class="assetReportMeta">${escapeHtml(heroMeta)}</p>
          </div>

          <aside class="assetReportValuationCard">
            <h2>Total Spent</h2>
            <strong class="assetReportValue">${escapeHtml(formatMoney(options.summary.totalSpent))}</strong>
            <span class="assetReportVat">${escapeHtml(invoiceCountLabel(options.summary.invoiceCount))}</span>
            <div class="assetReportValueMeta">
              <div><span>Updated</span><strong>${escapeHtml(updatedLabel)}</strong></div>
            </div>
          </aside>
        </section>

        <div class="assetReportContentGrid">
          <div class="assetReportMainStack">
            <section class="assetReportSection assetReportTechnical">
              <h2>Asset Details</h2>
              ${renderRows(buildAssetRows(options.selectedAsset))}
            </section>

            <section class="assetReportSection assetReportClientCard">
              <h2>Client / Asset Owner</h2>
              ${renderRows(buildOwnerRows(options.ownerDetails))}
            </section>
          </div>

          <aside class="assetReportSide">
            <section class="assetReportSideCard assetReportRecordRows">
              <h2>Record Summary</h2>
              ${renderRows(buildSummaryRows(options))}
            </section>
          </aside>
        </div>

        <div class="assetReportFullStack">
          <section class="assetReportSection assetReportWideSection">
            <div class="assetReportSectionHeading">
              <div>
                <h2>Invoice Records</h2>
                <p>Readable operational cost trail captured from invoices manually entered or uploaded by the account user.</p>
              </div>
              <strong>${escapeHtml(invoiceRecordCountLabel(options.summary.invoiceCount))}</strong>
            </div>
            ${renderInvoiceRecords(options.invoices)}
          </section>
        </div>

        <footer class="assetReportFooter">
          <div>
            <p class="assetReportPowered">Powered by Aim4price.com</p>
            <div class="assetReportDisclaimer">${escapeHtml(disclaimer)}</div>
          </div>
        </footer>
      </div>
    </main>

    <script>
      (function () {
        function waitForFonts() {
          return document.fonts && document.fonts.ready ? document.fonts.ready.catch(function () {}) : Promise.resolve();
        }
        function waitForImages() {
          var images = Array.prototype.slice.call(document.images || []);
          return Promise.all(images.map(function (img) {
            if (img.complete) return Promise.resolve();
            return new Promise(function (resolve) {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            });
          }));
        }
        if (document.readyState === 'complete') {
          Promise.all([waitForImages(), waitForFonts()]).then(function () { window.setTimeout(function () { window.focus(); }, 150); });
        }
      })();
    </script>
  </body>
</html>`;
}

function styled(value: XlsxPrimitiveCellValue, style: XlsxCellStyle): XlsxCellValue {
  return { value, style };
}

function linked(value: XlsxPrimitiveCellValue, hyperlink: string | null | undefined): XlsxCellValue {
  return hyperlink ? { value, style: 'link', hyperlink } : styled(value, 'text');
}

function invoiceDateForExcel(value: string | null): Date | null {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function blockRows(invoices: MyInvoiceRecord[], blockType: 'maintenance' | 'parts' | 'repair'): XlsxCellValue[][] {
  const rows: XlsxCellValue[][] = [
    ['Invoice Date', 'Asset', 'Supplier', 'Invoice Number', 'Description', 'Total Incl. VAT'],
  ].map((row) => row.map((value) => styled(value, 'tableHeader')));

  for (const invoice of invoices) {
    const block = invoice.blocks.find((entry) => entry.blockType === blockType);
    if (!block || !block.description) continue;

    rows.push([
      styled(invoiceDateForExcel(invoice.invoiceDate), 'date'),
      styled(invoice.assetTitle, 'text'),
      styled(invoice.supplierName, 'text'),
      styled(invoice.invoiceNumber, 'text'),
      styled(block.description, 'note'),
      styled(block.totalIncVat, 'currency'),
    ]);
  }

  return rows;
}

function buildSupplierSpendRows(invoices: MyInvoiceRecord[]): XlsxCellValue[][] {
  const supplierMap = new Map<string, { count: number; total: number; vat: number }>();

  for (const invoice of invoices) {
    const supplier = invoice.supplierName || 'Unknown supplier';
    const current = supplierMap.get(supplier) ?? { count: 0, total: 0, vat: 0 };
    current.count += 1;
    current.total += invoice.totalIncVat;
    current.vat += invoice.vatAmount ?? 0;
    supplierMap.set(supplier, current);
  }

  const rows: XlsxCellValue[][] = [
    [styled('Supplier', 'tableHeader'), styled('Invoice Count', 'tableHeader'), styled('Total Incl. VAT', 'tableHeader'), styled('VAT', 'tableHeader')],
  ];

  for (const [supplier, values] of [...supplierMap.entries()].sort((a, b) => b[1].total - a[1].total)) {
    rows.push([
      styled(supplier, 'text'),
      styled(values.count, 'integer'),
      styled(Math.round(values.total * 100) / 100, 'currency'),
      styled(Math.round(values.vat * 100) / 100, 'currency'),
    ]);
  }

  return rows;
}

export function buildMyInvoicesWorkbook(options: MyInvoicesReportOptions): XlsxSheet[] {
  const fuelInvoices = fuelSlipInvoices(options);
  const assetSummaryRows: XlsxCellValue[][] = options.selectedAsset
    ? [
        [styled('Category', 'metaLabel'), styled(formatAssetKind(options.selectedAsset), 'metaValue')],
        [styled('Asset', 'metaLabel'), styled(options.selectedAsset.title || NOT_RECORDED, 'metaValue')],
        [styled('Model year', 'metaLabel'), styled(options.selectedAsset.yearModel, 'year')],
        [styled('Usage', 'metaLabel'), styled(formatUsage(options.selectedAsset) === '-' ? NOT_RECORDED : formatUsage(options.selectedAsset), 'metaValue')],
        [styled('Condition', 'metaLabel'), styled(formatCondition(options.selectedAsset.condition), 'metaValue')],
        [styled('Current value (excl. VAT)', 'metaLabel'), styled(options.selectedAsset.value, 'currency')],
      ]
    : [
        [styled('Report scope', 'metaLabel'), styled('All selected assets', 'metaValue')],
        [styled('Asset filter', 'metaLabel'), styled(options.assetLabel, 'metaValue')],
      ];
  const assetSectionRow = 15;
  const summaryRows: XlsxCellValue[][] = [
    [styled(options.title, 'title'), '', '', '', '', '', ''],
    [styled(options.subtitle, 'subtitle'), '', '', '', '', '', ''],
    [],
    [styled('Generated', 'metaLabel'), styled(options.generatedAt, 'metaValue')],
    [styled('Period', 'metaLabel'), styled(options.dateRangeLabel, 'metaValue')],
    [styled('Asset Filter', 'metaLabel'), styled(options.assetLabel, 'metaValue')],
    [styled('External fuel costs', 'metaLabel'), styled(options.includeFuelSlipCosts ? 'Included' : 'Excluded', 'metaValue')],
    [styled('Fuel slip records', 'metaLabel'), styled(options.includeFuelSlipCosts ? fuelInvoices.length : 'Excluded', options.includeFuelSlipCosts ? 'integer' : 'metaValue')],
    [styled('Fuel slip spend', 'metaLabel'), styled(options.includeFuelSlipCosts ? fuelSlipSpend(options) : 'Excluded', options.includeFuelSlipCosts ? 'currency' : 'metaValue')],
    [styled('Business name', 'metaLabel'), styled(options.ownerDetails.businessName, 'metaValue')],
    [styled('Contact details', 'metaLabel'), styled(options.ownerDetails.contactDetails, 'metaValue')],
    [styled('Business email', 'metaLabel'), styled(options.ownerDetails.businessEmail, 'metaValue')],
    [styled('Location / address', 'metaLabel'), styled(options.ownerDetails.locationAddress, 'metaValue')],
    [],
    [styled('Asset details', 'section'), '', '', '', '', '', ''],
    ...assetSummaryRows,
    [],
    [
      styled('Total spent', 'tableHeader'),
      styled('Maintenance', 'tableHeader'),
      styled('Parts', 'tableHeader'),
      styled('Repairs', 'tableHeader'),
      styled('Fuel slips', 'tableHeader'),
      styled('VAT', 'tableHeader'),
      styled('Invoice Count', 'tableHeader'),
    ],
    [
      styled(options.summary.totalSpent, 'currency'),
      styled(options.summary.maintenanceSpend, 'currency'),
      styled(options.summary.partsSpend, 'currency'),
      styled(options.summary.repairSpend, 'currency'),
      styled(fuelSlipSpend(options), 'currency'),
      styled(options.summary.vatTotal, 'currency'),
      styled(options.summary.invoiceCount, 'integer'),
    ],
  ];

  const invoiceHeader = [
    'Invoice Date',
    'Asset',
    'Supplier',
    'Invoice Number',
    'Subtotal Excl. VAT',
    'VAT',
    'Total Incl. VAT',
    'Usage Reading',
    'Usage Metric',
    'Source',
    'Maintenance Work Done',
    'Parts Supplied',
    'Repair Work Done',
    'Notes',
    'Attached Document',
  ];

  const invoiceRows: XlsxCellValue[][] = [
    [styled('Invoices', 'title'), '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [styled(`Filtered report: ${options.dateRangeLabel} • ${options.assetLabel}`, 'subtitle'), '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [],
    invoiceHeader.map((header) => styled(header, 'tableHeader')),
    ...options.invoices.map((invoice) => [
      styled(invoiceDateForExcel(invoice.invoiceDate), 'date'),
      styled(invoice.assetTitle, 'text'),
      styled(invoice.supplierName, 'text'),
      styled(invoice.invoiceNumber, 'text'),
      styled(invoice.subtotalExVat, 'currency'),
      styled(invoice.vatAmount, 'currency'),
      styled(invoice.totalIncVat, 'currency'),
      styled(invoice.usageReading, 'decimal'),
      styled(invoice.usageMetric === 'none' ? '' : invoice.usageMetric, 'text'),
      styled(invoiceSourceLabel(invoice), 'text'),
      styled(invoice.maintenanceWorkDone, 'note'),
      styled(invoice.partsSupplied, 'note'),
      styled(invoice.repairWorkDone, 'note'),
      styled(invoice.notes, 'note'),
      linked(invoice.document?.fileName || 'No attachment', invoice.document?.uploadUrl),
    ]),
  ];

  const fuelHeaders = ['Invoice Date', 'Asset', 'Supplier', 'Invoice Number', 'Total Incl. VAT', 'Usage', 'Notes', 'Attached Document'];
  const fuelRows: XlsxCellValue[][] = [
    [styled('Fuel Slip Costs', 'title'), '', '', '', '', '', '', ''],
    [styled(
      options.includeFuelSlipCosts
        ? `Filtered report: ${options.dateRangeLabel} • ${options.assetLabel}`
        : 'External fuel costs were excluded from this report.',
      'subtitle',
    ), '', '', '', '', '', '', ''],
    [],
    fuelHeaders.map((header) => styled(header, 'tableHeader')),
    ...fuelInvoices.map((invoice) => [
      styled(invoiceDateForExcel(invoice.invoiceDate), 'date'),
      styled(invoice.assetTitle || NOT_RECORDED, 'text'),
      styled(invoice.supplierName || NOT_RECORDED, 'text'),
      styled(invoice.invoiceNumber || NOT_RECORDED, 'text'),
      styled(invoice.totalIncVat, 'currency'),
      styled(invoice.usageReading === null ? NOT_RECORDED : `${invoice.usageReading.toLocaleString('en-ZA')} ${invoice.usageMetric === 'none' ? '' : invoice.usageMetric}`.trim(), 'text'),
      styled(invoice.notes || NOT_RECORDED, 'note'),
      linked(invoice.document?.fileName || 'No attachment', invoice.document?.uploadUrl),
    ]),
  ];

  const supplierRows = buildSupplierSpendRows(options.invoices);
  const accountingRows: XlsxCellValue[][] = [
    ACCOUNTING_HEADERS.map((header) => styled(header, 'tableHeader')),
    ...options.invoices.map((invoice) => accountingValues(invoice).map((value, index) => {
      if (index === 0) return styled(invoiceDateForExcel(String(value)), 'date');
      if (index >= 6 && index <= 8) return styled(value, 'currency');
      if (index === 4) return styled(value, 'note');
      return styled(value, 'text');
    })),
  ];

  return [
    {
      name: 'Summary',
      rows: summaryRows,
      columns: [28, 30, 22, 22, 20, 20, 18],
      merges: [
        { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 7 },
        { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 7 },
        { fromRow: assetSectionRow, fromColumn: 1, toRow: assetSectionRow, toColumn: 7 },
      ],
      orientation: 'portrait',
      tabColor: '10382F',
    },
    {
      name: 'Accounting',
      rows: accountingRows,
      columns: [16, 14, 28, 22, 52, 14, 18, 16, 18, 36],
      freezeRow: 1,
      autoFilter: {
        fromRow: 1,
        fromColumn: 1,
        toRow: Math.max(1, 1 + options.invoices.length),
        toColumn: ACCOUNTING_HEADERS.length,
      },
      tabColor: '2E7D5B',
    },
    {
      name: 'Invoices',
      rows: invoiceRows,
      columns: [16, 28, 26, 22, 18, 16, 18, 16, 14, 14, 42, 42, 42, 42, 30],
      merges: [
        { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 15 },
        { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 15 },
      ],
      freezeRow: 4,
      autoFilter: {
        fromRow: 4,
        fromColumn: 1,
        toRow: Math.max(4, 4 + options.invoices.length),
        toColumn: invoiceHeader.length,
      },
      tabColor: '176B4F',
    },
    {
      name: 'Fuel Costs',
      rows: fuelRows,
      columns: [16, 28, 26, 22, 18, 20, 42, 30],
      merges: [
        { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: fuelHeaders.length },
        { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: fuelHeaders.length },
      ],
      freezeRow: 4,
      autoFilter: {
        fromRow: 4,
        fromColumn: 1,
        toRow: Math.max(4, 4 + fuelInvoices.length),
        toColumn: fuelHeaders.length,
      },
      tabColor: 'C68A1B',
    },
    {
      name: 'Maintenance',
      rows: blockRows(options.invoices, 'maintenance'),
      columns: [16, 28, 26, 22, 52, 18],
      freezeRow: 1,
      tabColor: '5D7F6B',
    },
    {
      name: 'Parts',
      rows: blockRows(options.invoices, 'parts'),
      columns: [16, 28, 26, 22, 52, 18],
      freezeRow: 1,
      tabColor: '6C8EA4',
    },
    {
      name: 'Repairs',
      rows: blockRows(options.invoices, 'repair'),
      columns: [16, 28, 26, 22, 52, 18],
      freezeRow: 1,
      tabColor: '8A704C',
    },
    {
      name: 'Supplier Spend',
      rows: supplierRows,
      columns: [32, 16, 20, 18],
      freezeRow: 1,
      tabColor: '10382F',
    },
  ];
}
