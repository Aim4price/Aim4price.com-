import type { FuelSlipTransaction } from './fuel-ledger';
import { createXlsxWorkbook, reportExcelDate, type XlsxCellValue } from './simple-xlsx.ts';
import { REPORT_THEME_CSS } from './report-theme.ts';

// Apply to free text too: payment details can occur in supplier notes or references.
export function safeSlipExportText(value: unknown, preserveReference = false): string {
  const text = String(value ?? '');
  if (preserveReference) return text;
  return text.replace(/\b\d{4,6}[\s-]*(?:[*xX#•·●∙]+[\s-]*)+\d{4}\b/g, (match) => `Card ending ${match.replace(/\D/g, '').slice(-4)}`)
    .replace(/\b(?:\d[ \t-]?){13,19}\b/g, (match) => `Card ending ${match.replace(/\D/g, '').slice(-4)}`);
}
const escapeHtml = (value: unknown, preserveReference = false) => safeSlipExportText(value, preserveReference).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const target = (slip: FuelSlipTransaction) => slip.targetType === 'storage_tank' ? slip.storageName || 'Storage tank' : slip.assetTitle || 'Asset';
const status = (slip: FuelSlipTransaction) => slip.reviewRequired || slip.extractionStatus === 'needs_review' ? 'Not completed' : slip.extractionStatus === 'extracted' ? 'Aim4price captured' : 'Manual';
const number = (value: number | null) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const money = (value: number | null) => value === null ? '—' : `R ${value.toFixed(2)}`;

export function buildFuelSlipWorkbook(slips: FuelSlipTransaction[]): Buffer {
  const headers = ['Date', 'Supplier', 'Supplier VAT number', 'Target type', 'Target', 'Slip number', 'Transaction number', 'Fuel type', 'Litres', 'Price per litre', 'Total incl. VAT', 'VAT amount', 'VAT included', 'VAT rate', 'Payment method', 'Card type', 'Card last 4', 'Merchant number', 'Terminal number', 'Site number', 'Odometer reading', 'Hour-meter reading', 'Operator / manager', 'Activity / reason', 'Work area / direction', 'Asset fuel % before', 'Asset fuel % after', 'Note', 'Capture status', 'Review required', 'Original filename', 'Document URL', 'Created at (SAST)', 'Updated at (SAST)'];
  const rows: XlsxCellValue[][] = slips.map((s) => [s.documentDate, s.supplierName, s.supplierVatNumber, s.targetType === 'storage_tank' ? 'Storage tank' : 'Asset', target(s), s.slipNumber, s.transactionNumber, s.fuelType,
    number(s.litres), number(s.pricePerLitre), number(s.totalAmount), number(s.vatAmount), s.vatIncluded === null ? '' : s.vatIncluded ? 'Yes' : 'No', number(s.vatRate), s.paymentMethod, s.cardType, (s.cardLast4 || s.cardNumberMasked || '').replace(/\D/g, '').slice(-4), s.merchantNumber, s.terminalNumber, s.siteNumber,
    number(s.odometerReading), number(s.hourMeterReading), s.operatorName, s.activityText, s.workAreaText, number(s.assetFuelPercentBefore), number(s.assetFuelPercentAfter), s.note, status(s), s.reviewRequired ? 'Yes' : 'No', s.originalFilename, s.documentFileUrl, s.createdAtIso, s.updatedAtIso,
  ].map((value, index) => [0, 32, 33].includes(index) ? { value: reportExcelDate(String(value ?? '')), style: index === 0 ? 'date' : 'dateTime' } : typeof value === 'number' ? { value, style: [9, 10, 11].includes(index) ? 'currency' : 'decimal' } : { value: safeSlipExportText(value, [2, 5, 6, 17, 18, 19, 31].includes(index)), style: 'text' }));
  const summary: XlsxCellValue[][] = [
    [{ value: 'Fuel slip summary', style: 'title' }],
    [{ value: 'Full references and evidence are in the Fuel slips sheet. Amounts in rand.', style: 'subtitle' }],
    [],
    ['Date', 'Supplier', 'Asset / storage', 'Litres', 'Price / litre', 'Total incl. VAT', 'VAT'].map(value => ({ value, style: 'tableHeader' })),
    ...slips.map(s => [
      { value: reportExcelDate(s.documentDate), style: 'date' },
      { value: safeSlipExportText(s.supplierName), style: 'text' },
      { value: safeSlipExportText(target(s)), style: 'text' },
      { value: number(s.litres), style: 'decimal' },
      ...[s.pricePerLitre, s.totalAmount, s.vatAmount].map(value => ({ value: number(value), style: 'currency' as const })),
    ] as XlsxCellValue[]),
  ];
  return createXlsxWorkbook([{ name: 'Summary', rows: summary, columns: [16, 25, 28, 12, 16, 18, 16], freezeRow: 4,
    merges: [{ fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 7 }, { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 7 }],
    autoFilter: { fromRow: 4, fromColumn: 1, toRow: summary.length, toColumn: 7 }, orientation: 'landscape' }, { name: 'Fuel slips', rows: [headers.map((value) => ({ value, style: 'tableHeader' })), ...rows], columns: headers.map((_, index) => [1, 4, 27].includes(index) ? 36 : 21), freezeRow: 1, autoFilter: { fromRow: 1, fromColumn: 1, toRow: rows.length + 1, toColumn: headers.length }, orientation: 'landscape' }]);
}

export function buildFuelSlipReportHtml(slips: FuelSlipTransaction[], context: { accountName?: string; logoUrl?: string } = {}): string {
  const litres = slips.reduce((sum, s) => sum + (number(s.litres) ?? 0), 0);
  const total = slips.reduce((sum, s) => sum + (number(s.totalAmount) ?? 0), 0);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fuel slip report</title><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet"><style>
    * { box-sizing: border-box; } @page { size: A4 landscape; margin: 12mm; } body { margin: 0; font: 11px/1.5 Arial,sans-serif; } h1 { font-size: 26px; margin: 0; } header { border-bottom: 2px solid #197454; padding-bottom: 14px; margin-bottom: 18px; } .summary { display: flex; flex-wrap: wrap; gap: 12px 28px; padding: 14px; background: #eaf5ef; margin-bottom: 20px; } table { width: 100%; border-collapse: collapse; table-layout: fixed; } th { text-align: left; background: #eaf5ef; } th, td { padding: 8px; border-bottom: 1px solid #d6e4dd; overflow-wrap: anywhere; vertical-align: top; } thead { display: table-header-group; } tr { break-inside: avoid; } .note { color: #60756d; } ${REPORT_THEME_CSS}
    </style></head><body><main class="reportPage"><header>${context.logoUrl ? `<img src="${escapeHtml(context.logoUrl, true)}" alt="Aim4price" style="width:85px;height:55px;object-fit:contain"/>` : '<div>Aim4price.com</div>'}<div>${escapeHtml(context.accountName || '')}</div><h1>Fuel slip report</h1><div>Selected fuel slip records · Generated ${new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</div></header>
    <div class="summary"><strong>${slips.length} slips</strong><strong>${litres.toFixed(3)} litres</strong><strong>${money(total)} incl. VAT</strong></div>
    <p class="note">Includes the selected loaded records. Missing amounts are shown as — and omitted from totals. Records marked “Not completed” may need review. This report summarises slips; original receipt images are not attached.</p>
    <table><thead><tr>${['Date / slip', 'Supplier / target', 'Fuel / status', 'Litres', 'Price / litre', 'Total incl. VAT', 'VAT'].map((v) => `<th>${v}</th>`).join('')}</tr></thead><tbody>${slips.map((s) => `<tr><td>${escapeHtml(s.documentDate || 'Not set')}<br>${escapeHtml(s.slipNumber, true)}</td><td>${escapeHtml(s.supplierName || 'Not set')}<br>${escapeHtml(target(s))}</td><td>${escapeHtml(s.fuelType)}<br>${escapeHtml(status(s))}</td><td>${number(s.litres)?.toFixed(3) ?? '—'}</td><td>${money(number(s.pricePerLitre))}</td><td>${money(number(s.totalAmount))}</td><td>${money(number(s.vatAmount))}</td></tr>`).join('')}</tbody></table><footer style="margin-top:18px;border-top:1px solid #d6e4dd;padding-top:8px">Powered by Aim4price.com</footer></main></body></html>`;
}
