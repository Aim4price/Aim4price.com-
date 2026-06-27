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
  xlsxUrl: string;
};

type KeyValueRow = {
  label: string;
  value: string;
};

type SummaryCard = {
  label: string;
  value: string;
  subtext: string;
};

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

function formatUsage(asset: MyInvoiceAssetOption | null): string {
  if (!asset || typeof asset.usageReading !== 'number' || !Number.isFinite(asset.usageReading)) return '-';
  return `${asset.usageReading.toLocaleString('en-ZA')} ${asset.usageMetric}`;
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
              <strong>${escapeHtml(row.value || '-')}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function buildOwnerRows(ownerDetails: MyInvoicesOwnerDetails): KeyValueRow[] {
  return [
    { label: 'Business Name', value: ownerDetails.businessName || '-' },
    { label: 'Contact Details', value: ownerDetails.contactDetails || '-' },
    { label: 'Business Email', value: ownerDetails.businessEmail || '-' },
    { label: 'Location / Address', value: ownerDetails.locationAddress || '-' },
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
    { label: 'Category', value: asset.categoryLabel || asset.kind || 'Asset' },
    { label: 'Asset', value: asset.title || '-' },
    { label: 'Year Model', value: asset.yearModel ? String(asset.yearModel) : '-' },
    { label: 'Usage', value: formatUsage(asset) },
    { label: 'Condition', value: asset.condition || '-' },
    { label: 'Current Value', value: formatMoney(asset.value) },
  ];
}

function invoiceBlockText(invoice: MyInvoiceRecord, blockType: 'maintenance' | 'parts' | 'repair'): string {
  const block = invoice.blocks.find((entry) => entry.blockType === blockType);
  return normalizeSpaces(block?.description) || '-';
}

function renderInvoiceRecords(invoices: MyInvoiceRecord[]): string {
  if (!invoices.length) {
    return '<div class="assetReportEmpty">No invoices have been saved for this report period.</div>';
  }

  return invoices
    .map((invoice) => {
      const attachmentLabel = invoice.document ? `${invoice.document.fileName || 'Attached document'} (${invoice.document.contentType || 'file'})` : '-';

      return `
        <article class="assetReportRecord">
          <div class="assetReportRecordTop">
            <div><span>Invoice date</span><strong>${escapeHtml(formatDateOnly(invoice.invoiceDate))}</strong></div>
            <div><span>Supplier</span><strong>${escapeHtml(invoice.supplierName || '-')}</strong></div>
            <div><span>Invoice number</span><strong>${escapeHtml(invoice.invoiceNumber || '-')}</strong></div>
            <div><span>Asset</span><strong>${escapeHtml(invoice.assetTitle || '-')}</strong></div>
            <div><span>Total</span><strong>${escapeHtml(formatMoneyWithCents(invoice.totalIncVat))}</strong></div>
          </div>

          <div class="assetReportRecordRow">
            <span>Maintenance work done</span>
            <strong>${escapeHtml(invoiceBlockText(invoice, 'maintenance'))}</strong>
          </div>
          <div class="assetReportRecordRow">
            <span>Parts supplied</span>
            <strong>${escapeHtml(invoiceBlockText(invoice, 'parts'))}</strong>
          </div>
          <div class="assetReportRecordRow">
            <span>Repair work done</span>
            <strong>${escapeHtml(invoiceBlockText(invoice, 'repair'))}</strong>
          </div>
          <div class="assetReportRecordRow">
            <span>Notes</span>
            <strong>${escapeHtml(invoice.notes || '-')}</strong>
          </div>
          <div class="assetReportRecordRow">
            <span>Attached document / photo</span>
            <strong>${escapeHtml(attachmentLabel)}</strong>
          </div>
        </article>
      `;
    })
    .join('');
}

function buildSummaryRows(options: MyInvoicesReportOptions): KeyValueRow[] {
  return [
    { label: 'Report Period', value: options.dateRangeLabel },
    { label: 'Asset Filter', value: options.assetLabel },
    { label: 'Invoices', value: options.summary.invoiceCount.toLocaleString('en-ZA') },
    { label: 'Total Spend', value: formatMoneyWithCents(options.summary.totalSpent) },
    { label: 'Maintenance Spend', value: formatMoneyWithCents(options.summary.maintenanceSpend) },
    { label: 'Parts Spend', value: formatMoneyWithCents(options.summary.partsSpend) },
    { label: 'Repair Spend', value: formatMoneyWithCents(options.summary.repairSpend) },
    { label: 'VAT Total', value: formatMoneyWithCents(options.summary.vatTotal) },
  ];
}

export function buildMyInvoicesReportHtml(options: MyInvoicesReportOptions): string {
  const cards: SummaryCard[] = [
    { label: 'Total spent', value: formatMoney(options.summary.totalSpent), subtext: 'Approved invoices' },
    { label: 'Maintenance', value: formatMoney(options.summary.maintenanceSpend), subtext: 'Maintenance blocks' },
    { label: 'Parts', value: formatMoney(options.summary.partsSpend), subtext: 'Parts blocks' },
    { label: 'Repairs', value: formatMoney(options.summary.repairSpend), subtext: 'Repair blocks' },
    { label: 'VAT', value: formatMoney(options.summary.vatTotal), subtext: 'VAT captured' },
    { label: 'Invoices', value: String(options.summary.invoiceCount), subtext: 'invoice records' },
  ];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)} - Aim4price</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #111827;
        --strong: #070b12;
        --muted: #5f6b7a;
        --paper: #ffffff;
        --soft: #f5f6f8;
        --soft-2: #fafbfc;
        --line: #d7dde5;
        --line-strong: #b9c2ce;
        --green: #10382f;
      }

      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

      @page { size: A4 portrait; margin: 7mm 7mm 8mm; }

      html, body {
        margin: 0;
        padding: 0;
        background: #eef1f4;
        color: var(--ink);
        font-family: Montserrat, "Segoe UI", Arial, Helvetica, sans-serif;
        font-size: 9.3px;
        line-height: 1.35;
      }

      .screenBar {
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

      .screenBar p { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.4; }
      .screenActions { display: flex; justify-content: flex-end; gap: 8px; }
      .button {
        appearance: none;
        min-height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 16px;
        border: 1px solid #cfd5dd;
        border-radius: 999px;
        background: #ffffff;
        color: var(--ink);
        font: inherit;
        font-size: 12.5px;
        font-weight: 800;
        text-decoration: none;
        cursor: pointer;
      }
      .buttonPrimary { border-color: var(--green); background: var(--green); color: #ffffff; }

      .assetReportPage {
        width: min(100%, 210mm);
        min-height: 297mm;
        margin: 18px auto;
        padding: 8mm 7mm 7mm;
        background: var(--paper);
        box-shadow: 0 16px 44px rgba(17, 24, 39, 0.13);
      }

      .assetReportInner { min-height: calc(297mm - 15mm); display: flex; flex-direction: column; }

      .assetReportHeader {
        display: grid;
        grid-template-columns: 22mm minmax(0, 1fr) 58mm;
        gap: 12px;
        align-items: center;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--line-strong);
      }

      .assetReportLogoWrap { min-height: 18mm; display: flex; align-items: center; }
      .assetReportLogoWrap img { max-width: 18mm; max-height: 18mm; object-fit: contain; }
      .assetReportFallbackLogo { width: 12mm; height: 12mm; border: 2px solid #111827; border-radius: 999px; display: grid; place-items: center; font-weight: 900; }
      .assetReportTitle h1 { margin: 0; color: var(--strong); font-size: 19px; line-height: 1.02; letter-spacing: -0.04em; }
      .assetReportTitle p { margin: 4px 0 0; color: var(--muted); font-size: 10.5px; font-weight: 700; }
      .assetReportMeta { display: grid; gap: 4px; }
      .assetReportMetaLine { display: grid; grid-template-columns: 1fr auto; gap: 8px; color: var(--muted); font-size: 8.6px; }
      .assetReportMetaLine strong { color: var(--strong); }

      .assetReportHero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 56mm;
        margin-top: 10px;
        border: 1px solid var(--line-strong);
      }
      .assetReportHeroMain { padding: 12px 14px; }
      .assetReportKicker { display: block; color: var(--muted); font-size: 8px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 900; }
      .assetReportHeroMain h2 { margin: 6px 0 4px; color: var(--strong); font-size: 21px; letter-spacing: -0.045em; }
      .assetReportHeroMain p { margin: 0; color: var(--ink); font-size: 10.2px; font-weight: 700; }
      .assetReportHeroSide { padding: 12px 14px; border-left: 1px solid var(--line-strong); background: #f8f9fb; }
      .assetReportHeroSide strong { display: block; margin-top: 5px; font-size: 24px; color: var(--strong); line-height: 1; }
      .assetReportHeroSide small { display: block; margin-top: 5px; color: var(--muted); font-size: 8.8px; font-weight: 700; }

      .assetReportCards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin-top: 10px; }
      .assetReportCard { border: 1px solid var(--line); background: #f8f9fb; padding: 9px 10px; min-height: 45px; }
      .assetReportCard span { display: block; color: var(--muted); font-size: 7.6px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
      .assetReportCard strong { display: block; margin-top: 4px; color: var(--strong); font-size: 15px; letter-spacing: -0.04em; }
      .assetReportCard small { display: block; margin-top: 3px; color: var(--muted); font-weight: 700; }

      .assetReportGrid { display: grid; grid-template-columns: minmax(0, 1fr) 62mm; gap: 10px; margin-top: 10px; align-items: start; }
      .assetReportSection, .assetReportSideCard {
        border: 1px solid var(--line-strong);
        background: #ffffff;
        padding: 10px 12px;
      }
      .assetReportSection + .assetReportSection { margin-top: 9px; }
      .assetReportSideCard + .assetReportSideCard { margin-top: 9px; }
      .assetReportSection h2, .assetReportSideCard h2 { margin: 0 0 7px; color: var(--strong); font-size: 12px; letter-spacing: -0.02em; }
      .assetReportRows { border-top: 1px solid var(--line); }
      .assetReportRow { display: grid; grid-template-columns: 38mm minmax(0, 1fr); gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--line); min-height: 17px; }
      .assetReportSideCard .assetReportRow { grid-template-columns: 1fr auto; }
      .assetReportRow span { color: var(--muted); font-weight: 800; }
      .assetReportRow strong { color: var(--strong); font-weight: 850; text-align: left; overflow-wrap: anywhere; }
      .assetReportSideCard .assetReportRow strong { text-align: right; }
      .assetReportEmpty { padding: 10px; border: 1px dashed var(--line); background: #fbfcfd; color: var(--muted); font-weight: 700; }

      .recordsSection { margin-top: 10px; border: 1px solid var(--line-strong); padding: 10px 12px; }
      .recordsHeader { display: flex; justify-content: space-between; align-items: start; gap: 10px; margin-bottom: 9px; }
      .recordsHeader h2 { margin: 0; color: var(--strong); font-size: 12.5px; }
      .recordsHeader p { margin: 3px 0 0; color: var(--muted); max-width: 128mm; font-size: 8.7px; }
      .recordsBadge { min-width: 28mm; padding: 5px 9px; border: 1px solid var(--line); text-align: center; font-weight: 900; background: #f8f9fb; }
      .assetReportRecord { border: 1px solid var(--line); break-inside: avoid; margin-bottom: 9px; }
      .assetReportRecordTop { display: grid; grid-template-columns: 27mm 38mm 33mm 1fr 28mm; border-bottom: 1px solid var(--line); background: #f8f9fb; }
      .assetReportRecordTop div { min-height: 28px; padding: 6px 8px; border-right: 1px solid var(--line); }
      .assetReportRecordTop div:last-child { border-right: 0; }
      .assetReportRecordTop span, .assetReportRecordRow span { display: block; color: var(--muted); font-size: 7.2px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; }
      .assetReportRecordTop strong, .assetReportRecordRow strong { display: block; margin-top: 3px; color: var(--strong); font-size: 8.8px; font-weight: 850; overflow-wrap: anywhere; white-space: pre-wrap; }
      .assetReportRecordRow { padding: 7px 8px; border-bottom: 1px solid var(--line); }
      .assetReportRecordRow:last-child { border-bottom: 0; }

      .assetReportFooter { margin-top: auto; padding-top: 12px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: end; color: var(--muted); font-size: 7.4px; }
      .assetReportFooter strong { display: block; margin-bottom: 4px; color: var(--strong); font-size: 8.7px; }
      .assetReportFooterPage { color: var(--strong); font-weight: 900; white-space: nowrap; }

      @media print {
        html, body { background: #ffffff; }
        .screenBar { display: none; }
        .assetReportPage { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
      }

      @media (max-width: 760px) {
        .screenBar { grid-template-columns: 1fr; }
        .screenActions { justify-content: stretch; flex-wrap: wrap; }
        .button { flex: 1 1 auto; }
        .assetReportPage { width: 100%; margin: 0; }
      }
    </style>
  </head>
  <body>
    <div class="screenBar">
      <p><strong>${escapeHtml(options.title)}</strong> - use Print / Save as PDF for a PDF copy, or download the XLSX workbook.</p>
      <div class="screenActions">
        <a class="button" href="${escapeHtml(options.xlsxUrl)}">Download XLSX</a>
        <button class="button buttonPrimary" type="button" onclick="window.print()">Print / Save PDF</button>
      </div>
    </div>

    <main class="assetReportPage">
      <div class="assetReportInner">
        <header class="assetReportHeader">
          <div class="assetReportLogoWrap">
            ${options.logoUrl ? `<img src="${escapeHtml(options.logoUrl)}" alt="Aim4price account logo" />` : '<span class="assetReportFallbackLogo">A</span>'}
          </div>
          <div class="assetReportTitle">
            <h1>${escapeHtml(options.title)}</h1>
            <p>Aim4price asset register</p>
          </div>
          <div class="assetReportMeta">
            <div class="assetReportMetaLine"><span>Generated</span><strong>${escapeHtml(options.generatedAt)}</strong></div>
            <div class="assetReportMetaLine"><span>Business Email</span><strong>${escapeHtml(options.ownerEmail || '-')}</strong></div>
          </div>
        </header>

        <section class="assetReportHero">
          <div class="assetReportHeroMain">
            <span class="assetReportKicker">${escapeHtml(options.selectedAsset?.categoryLabel || 'Cost of ownership')}</span>
            <h2>${escapeHtml(options.selectedAsset?.title || 'All selected assets')}</h2>
            <p>${escapeHtml(options.selectedAsset ? options.selectedAsset.meta : `${options.summary.invoiceCount} invoice records • ${options.dateRangeLabel}`)}</p>
          </div>
          <div class="assetReportHeroSide">
            <span class="assetReportKicker">Total spent</span>
            <strong>${escapeHtml(formatMoney(options.summary.totalSpent))}</strong>
            <small>${escapeHtml(options.summary.invoiceCount === 1 ? '1 approved invoice' : `${options.summary.invoiceCount} approved invoices`)}</small>
          </div>
        </section>

        <section class="assetReportCards">
          ${cards
            .map(
              (card) => `
                <div class="assetReportCard">
                  <span>${escapeHtml(card.label)}</span>
                  <strong>${escapeHtml(card.value)}</strong>
                  <small>${escapeHtml(card.subtext)}</small>
                </div>
              `,
            )
            .join('')}
        </section>

        <section class="assetReportGrid">
          <div>
            <section class="assetReportSection">
              <h2>Asset Details</h2>
              ${renderRows(buildAssetRows(options.selectedAsset))}
            </section>
            <section class="assetReportSection">
              <h2>Client / Asset Owner</h2>
              ${renderRows(buildOwnerRows(options.ownerDetails))}
            </section>
          </div>
          <aside>
            <section class="assetReportSideCard">
              <h2>Record Summary</h2>
              ${renderRows(buildSummaryRows(options))}
            </section>
          </aside>
        </section>

        <section class="recordsSection">
          <div class="recordsHeader">
            <div>
              <h2>Invoice Records</h2>
              <p>Readable operational cost trail captured from invoices manually entered or uploaded by the account user.</p>
            </div>
            <div class="recordsBadge">${escapeHtml(String(options.summary.invoiceCount))} RECORDS</div>
          </div>
          ${renderInvoiceRecords(options.invoices)}
        </section>

        <footer class="assetReportFooter">
          <div>
            <strong>Powered by Aim4price.com</strong>
            <span>Cost of Ownership records are based on invoices manually entered or uploaded by the account user. This report is an operational ownership-cost summary and not a certified accounting, tax or mechanical audit report.</span>
          </div>
          <div class="assetReportFooterPage">Page 1 of 1</div>
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

function invoiceDateForExcel(value: string | null): string {
  return value ?? '';
}

function invoiceSourceLabel(invoice: MyInvoiceRecord): string {
  return invoice.source === 'automatic' ? 'Automatic' : 'Manual';
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
  const summaryRows: XlsxCellValue[][] = [
    [styled(options.title, 'title'), '', '', '', '', ''],
    [styled(options.subtitle, 'subtitle'), '', '', '', '', ''],
    [],
    [styled('Generated', 'metaLabel'), styled(options.generatedAt, 'metaValue')],
    [styled('Period', 'metaLabel'), styled(options.dateRangeLabel, 'metaValue')],
    [styled('Asset Filter', 'metaLabel'), styled(options.assetLabel, 'metaValue')],
    [styled('Business name', 'metaLabel'), styled(options.ownerDetails.businessName, 'metaValue')],
    [styled('Contact details', 'metaLabel'), styled(options.ownerDetails.contactDetails, 'metaValue')],
    [styled('Business email', 'metaLabel'), styled(options.ownerDetails.businessEmail, 'metaValue')],
    [styled('Location / address', 'metaLabel'), styled(options.ownerDetails.locationAddress, 'metaValue')],
    [],
    [
      styled('Total spent', 'tableHeader'),
      styled('Maintenance', 'tableHeader'),
      styled('Parts', 'tableHeader'),
      styled('Repairs', 'tableHeader'),
      styled('VAT', 'tableHeader'),
      styled('Invoice Count', 'tableHeader'),
    ],
    [
      styled(options.summary.totalSpent, 'currency'),
      styled(options.summary.maintenanceSpend, 'currency'),
      styled(options.summary.partsSpend, 'currency'),
      styled(options.summary.repairSpend, 'currency'),
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
      styled(invoice.document?.fileName ?? '', 'text'),
    ]),
  ];

  const supplierRows = buildSupplierSpendRows(options.invoices);

  return [
    {
      name: 'Summary',
      rows: summaryRows,
      columns: [24, 28, 22, 22, 22, 18],
      merges: [
        { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 6 },
        { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 6 },
      ],
      tabColor: '10382F',
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
