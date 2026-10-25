import type { FuelSlipTransaction } from './fuel-ledger';
import { createXlsxWorkbook, reportExcelDate, type XlsxCellValue } from './simple-xlsx.ts';
import { buildReportHtml, buildOwnerReportDetails, fuelSlipReportEvent, fuelReportLink, fuelGpsLink } from './fuel-report.ts';

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

export function buildFuelSlipWorkbook(slips: FuelSlipTransaction[], baseUrl?: string): Buffer {
  const headers = ['Date', 'Supplier', 'Supplier VAT number', 'Target type', 'Target', 'Slip number', 'Transaction number', 'Fuel type', 'Litres', 'Price per litre', 'Total incl. VAT', 'VAT amount', 'VAT included', 'VAT rate', 'Payment method', 'Card type', 'Card last 4', 'Merchant number', 'Terminal number', 'Site number', 'Odometer reading', 'Hour-meter reading', 'Operator / manager', 'Activity / reason', 'Work area / direction', 'Asset fuel % before', 'Asset fuel % after', 'Note', 'Capture status', 'Review required', 'Original filename', 'Document URL', 'Created at (SAST)', 'Updated at (SAST)', 'GPS location'];
  const rows: XlsxCellValue[][] = slips.map((s) => [s.documentDate, s.supplierName, s.supplierVatNumber, s.targetType === 'storage_tank' ? 'Storage tank' : 'Asset', target(s), s.slipNumber, s.transactionNumber, s.fuelType,
    number(s.litres), number(s.pricePerLitre), number(s.totalAmount), number(s.vatAmount), s.vatIncluded === null ? '' : s.vatIncluded ? 'Yes' : 'No', number(s.vatRate), s.paymentMethod, s.cardType, (s.cardLast4 || s.cardNumberMasked || '').replace(/\D/g, '').slice(-4), s.merchantNumber, s.terminalNumber, s.siteNumber,
    s.usageNotApplicable ? 'N/A' : number(s.odometerReading), s.usageNotApplicable ? 'N/A' : number(s.hourMeterReading), s.operatorNotApplicable ? 'N/A' : s.operatorName, s.activityText, s.workAreaText, number(s.assetFuelPercentBefore), number(s.assetFuelPercentAfter), s.note, status(s), s.reviewRequired ? 'Yes' : 'No', s.originalFilename, s.documentFileUrl, s.createdAtIso, s.updatedAtIso, fuelGpsLink(s),
  ].map((value, index) => index === 31 || index === 34 ? { value: index === 31 ? (fuelReportLink(value, baseUrl) ? 'Open fuel slip' : '') : (value ? 'View on map' : ''), hyperlink: index === 31 ? fuelReportLink(value, baseUrl) : String(value || ''), style: 'link' } : [0, 32, 33].includes(index) ? { value: reportExcelDate(String(value ?? '')), style: index === 0 ? 'date' : 'dateTime' } : typeof value === 'number' ? { value, style: [9, 10, 11].includes(index) ? 'currency' : 'decimal' } : { value: safeSlipExportText(value, [2, 5, 6, 17, 18, 19, 31].includes(index)), style: 'text' }));
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

export function buildFuelSlipReportHtml(slips: FuelSlipTransaction[], context: { accountName?: string; logoUrl?: string; baseUrl?: string; ownerDetails?: ReturnType<typeof buildOwnerReportDetails> } = {}): string {
  const litres = slips.reduce((sum, s) => sum + (number(s.litres) ?? 0), 0);
  const total = slips.reduce((sum, s) => sum + (number(s.totalAmount) ?? 0), 0);
  return buildReportHtml({
    title: 'Fuel slip report', subtitle: 'Selected fuel slip records',
    generatedAt: new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' }).format(new Date()),
    ownerEmail: context.ownerDetails?.businessEmail || '', ownerDetails: context.ownerDetails || { businessName: context.accountName || '', contactDetails: '', businessEmail: '', locationAddress: '' },
    logoUrl: context.logoUrl || '', baseUrl: context.baseUrl, dateRangeLabel: 'Selected records',
    storageName: 'Selected assets / storage', storageCode: '', storageFuelType: 'Recorded on each slip',
    totalIssued: 0, totalWorkUseIssued: 0, totalExcludedIssued: 0, totalStockIn: 0, currentLitres: 0,
    storageCount: 0, eventCount: slips.length, events: slips.map(fuelSlipReportEvent), xlsxUrl: '',
    slipSummary: { total, litres, count: slips.length },
  });
}
