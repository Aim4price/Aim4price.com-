import { extractDigitalPdfText } from './my-invoices-extraction';
import { extractFuelSlipImageText, isSupportedFuelSlipImage } from './fuel-slip-ocr';

export type FuelSlipExtractionStatus = 'manual' | 'extracted' | 'needs_review';
export type FuelSlipExtractionQuality = 'none' | 'weak' | 'good';

export type FuelSlipExtractionDraft = {
  supplierName: string;
  supplierVatNumber: string;
  slipNumber: string;
  transactionNumber: string;
  documentDate: string;
  documentTime: string;
  fuelType: string;
  litres: number | null;
  pricePerLitre: number | null;
  totalAmount: number | null;
  vatAmount: number | null;
  vatIncluded: boolean | null;
  vatRate: number | null;
  paymentMethod: string;
  cardType: string;
  cardNumberMasked: string;
  cardLast4: string;
  merchantNumber: string;
  terminalNumber: string;
  siteNumber: string;
  extractionStatus: FuelSlipExtractionStatus;
  ocrConfidence: number | null;
  reviewRequired: boolean;
};

export type FuelSlipExtractionResult = {
  draft: FuelSlipExtractionDraft;
  rawText: string;
  warnings: string[];
  quality: FuelSlipExtractionQuality;
};

const EMPTY_DRAFT: FuelSlipExtractionDraft = {
  supplierName: '',
  supplierVatNumber: '',
  slipNumber: '',
  transactionNumber: '',
  documentDate: '',
  documentTime: '',
  fuelType: '',
  litres: null,
  pricePerLitre: null,
  totalAmount: null,
  vatAmount: null,
  vatIncluded: null,
  vatRate: null,
  paymentMethod: '',
  cardType: '',
  cardNumberMasked: '',
  cardLast4: '',
  merchantNumber: '',
  terminalNumber: '',
  siteNumber: '',
  extractionStatus: 'needs_review',
  ocrConfidence: null,
  reviewRequired: true,
};

function cloneEmptyDraft(): FuelSlipExtractionDraft {
  return { ...EMPTY_DRAFT };
}

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function normalizeLines(rawText: string): string[] {
  return String(rawText ?? '')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => cleanText(line))
    .filter(Boolean)
    .slice(0, 300);
}

function compact(rawText: string): string {
  return normalizeLines(rawText).join('\n');
}


function maskDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return value;
  const last4 = digits.slice(-4);
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${last4}`;
}

export function maskFuelSlipSensitiveText(value: string): string {
  return String(value ?? '').replace(/\b(?:\d[\s-]?){13,19}\b/g, (match) => maskDigits(match));
}

function parseDecimal(value: unknown, decimals = 2): number | null {
  let text = cleanText(value)
    .replace(/zar/gi, '')
    .replace(/rand/gi, '')
    .replace(/litres?|liter|l\b/gi, '')
    .replace(/\br\b/gi, '')
    .replace(/^r/i, '')
    .replace(/[^0-9, .-]/g, '')
    .replace(/\s+/g, '');

  if (!/[0-9]/.test(text)) return null;

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');

  if (hasComma && hasDot) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '');
  } else if (hasComma) {
    const parts = text.split(',');
    const last = parts[parts.length - 1] ?? '';
    text = last.length <= 2 ? `${parts.slice(0, -1).join('')}.${last}` : text.replace(/,/g, '');
  } else if ((text.match(/\./g) ?? []).length > 1) {
    const parts = text.split('.');
    const last = parts.pop() ?? '';
    text = `${parts.join('')}.${last}`;
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  const factor = 10 ** decimals;
  return Math.round(parsed * factor) / factor;
}

function moneyPattern(): string {
  return '(?:ZAR\\s*)?(?:R\\s*)?\\d(?:[\\d\\s,.]*\\d)?(?:[.,]\\d{2,4})?';
}

function firstGroup(pattern: RegExp, text: string): string {
  const match = pattern.exec(text);
  return cleanText(match?.[1] ?? '');
}

function normaliseFuelType(value: string): string {
  const text = cleanText(value).replace(/\s+/g, ' ');
  if (!text) return '';

  if (/diesel/i.test(text)) {
    if (/50\s*(?:ppm)?/i.test(text)) return 'Diesel 50ppm';
    if (/500\s*(?:ppm)?/i.test(text)) return 'Diesel 500ppm';
    return 'Diesel';
  }

  const unleaded = /unleaded\s*(93|95)/i.exec(text);
  if (unleaded) return `Unleaded ${unleaded[1]}`;

  const petrol = /petrol\s*(93|95)?/i.exec(text);
  if (petrol) return petrol[1] ? `Petrol ${petrol[1]}` : 'Petrol';

  return text.slice(0, 80);
}

function extractSupplier(lines: string[]): string {
  const ignored = /(?:tax\s+invoice|customer\s+receipt|receipt|slip|invoice|vat\s*(?:no|number)|terminal|merchant|card|total|litres?|diesel|unleaded|petrol|date|time|copy|thank|visit|cashier|attendant)/i;
  const candidate = lines.find((line) => /[A-Za-z]/.test(line) && line.length >= 3 && line.length <= 80 && !ignored.test(line));
  return cleanText(candidate ?? '').slice(0, 180);
}

function extractVatNumber(text: string): string {
  return firstGroup(/\bvat\s*(?:no|nr|number|reg(?:istration)?\s*(?:no|number)?)\s*[:#-]?\s*([0-9][0-9\s-]{6,20})/i, text).replace(/[^0-9]/g, '').slice(0, 20);
}

function extractDate(text: string): string {
  const iso = /(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (iso) {
    const year = iso[1];
    const month = iso[2].padStart(2, '0');
    const day = iso[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const local = /\b(\d{1,2})[-/.](\d{1,2})[-/.]((?:20|19)?\d{2})\b/.exec(text);
  if (!local) return '';

  const day = local[1].padStart(2, '0');
  const month = local[2].padStart(2, '0');
  const year = local[3].length === 2 ? `20${local[3]}` : local[3];
  return `${year}-${month}-${day}`;
}

function extractTime(text: string): string {
  const match = /\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/.exec(text);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}${match[3] ? `:${match[3]}` : ''}`;
}

function extractFuelType(lines: string[]): string {
  for (const line of lines) {
    const match = /(diesel\s*(?:50|500)?\s*(?:ppm)?|unleaded\s*(?:93|95)|petrol\s*(?:93|95)?)/i.exec(line);
    if (match) return normaliseFuelType(match[1]);
  }
  return '';
}

function extractLitres(text: string): number | null {
  const patterns = [
    /\b(\d[\d\s,.]*\d|\d)\s*(?:l|litres?|liter)\b/i,
    /\b(?:qty|quantity)\s*[:=]?\s*(\d[\d\s,.]*\d|\d)\b/i,
    /\b(?:diesel|unleaded|petrol)[^\n]{0,60}?(\d[\d\s,.]*\d|\d)\s*(?:l|litres?|liter)\b/i,
  ];

  for (const pattern of patterns) {
    const parsed = parseDecimal(firstGroup(pattern, text), 2);
    if (parsed !== null && parsed > 0) return parsed;
  }

  return null;
}

function extractPricePerLitre(text: string): number | null {
  const patterns = [
    /@\s*((?:ZAR\s*)?(?:R\s*)?\d[\d\s,.]*(?:[.,]\d{2,4})?)/i,
    /(?:price|rate)\s*(?:per|\/)?\s*(?:litre|liter|l)\s*[:=]?\s*((?:ZAR\s*)?(?:R\s*)?\d[\d\s,.]*(?:[.,]\d{2,4})?)/i,
  ];

  for (const pattern of patterns) {
    const parsed = parseDecimal(firstGroup(pattern, text), 4);
    if (parsed !== null && parsed > 0) return parsed;
  }

  return null;
}

function extractTotal(lines: string[]): number | null {
  const totalLines = lines.filter((line) => /\b(?:grand\s+total|total\s+due|amount\s+due|total|card\s+tender|tendered)\b/i.test(line) && !/subtotal|sub\s+total|vat\s*(?:no|number)|change/i.test(line));
  const money = new RegExp(`(${moneyPattern()})`, 'ig');
  const candidates: number[] = [];

  for (const line of totalLines) {
    const matches = [...line.matchAll(money)].map((match) => parseDecimal(match[1], 2)).filter((value): value is number => value !== null && value > 0);
    candidates.push(...matches);
  }

  if (candidates.length) return Math.max(...candidates);

  const allMoney = lines
    .flatMap((line) => [...line.matchAll(money)].map((match) => parseDecimal(match[1], 2)))
    .filter((value): value is number => value !== null && value > 0);

  return allMoney.length ? Math.max(...allMoney) : null;
}

function extractVatAmount(lines: string[]): number | null {
  const vatLines = lines.filter((line) => /\b(?:vat|tax)\b/i.test(line) && !/vat\s*(?:no|nr|number|reg)/i.test(line));
  const money = new RegExp(`(${moneyPattern()})`, 'ig');

  for (const line of vatLines) {
    const values = [...line.matchAll(money)]
      .map((match) => parseDecimal(match[1], 2))
      .filter((value): value is number => value !== null && value >= 0);
    if (values.length) return values[values.length - 1];
  }

  return null;
}

function extractSlipNumber(text: string): string {
  return firstGroup(/\b(?:slip|receipt|invoice|inv|tax\s+invoice|document|doc)\s*(?:no|nr|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{2,40})/i, text).slice(0, 120);
}

function extractTransactionNumber(text: string): string {
  return firstGroup(/\b(?:transaction|trans|txn|trace|sequence|seq|rrn|auth)\s*(?:no|nr|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{2,40})/i, text).slice(0, 120);
}

function extractNumberByLabel(text: string, labels: string): string {
  const pattern = new RegExp(`\\b(?:${labels})\\s*(?:no|nr|number|#)?\\s*[:#-]?\\s*([A-Z0-9][A-Z0-9\\/-]{1,40})`, 'i');
  return firstGroup(pattern, text).slice(0, 80);
}

function detectPaymentMethod(text: string): string {
  if (/\bcard\s+tender|\bcard\b|\bcredit\b|\bdebit\b|\bvisa\b|\bmaster\s*card|\bmastercard\b/i.test(text)) return 'card';
  if (/\bcash\b/i.test(text)) return 'cash';
  if (/\baccount\b/i.test(text)) return 'account';
  return '';
}

function detectCardType(text: string): string {
  if (/\bvisa\b/i.test(text)) return firstGroup(/\b(Visa[^\n]{0,30})/i, text) || 'Visa';
  if (/\bmaster\s*card|\bmastercard\b/i.test(text)) return 'Mastercard';
  if (/\bamex|american\s+express\b/i.test(text)) return 'American Express';
  return '';
}

export function maskCardNumber(value: unknown): { masked: string; last4: string } {
  const raw = cleanText(value);
  if (!raw) return { masked: '', last4: '' };

  const digits = raw.replace(/\D/g, '');
  const last4 = digits.length >= 4 ? digits.slice(-4) : '';

  if (digits.length >= 13 && digits.length <= 19) {
    return { masked: `${'*'.repeat(Math.max(0, digits.length - 4))}${last4}`, last4 };
  }

  if (/[xX*]{2,}/.test(raw) && last4) {
    const normalized = raw.replace(/[0-9](?=(?:\D*\d){4})/g, '*');
    return { masked: normalized, last4 };
  }

  if (last4 && /(?:card|visa|master|credit|debit)/i.test(raw)) {
    return { masked: `************${last4}`, last4 };
  }

  return { masked: '', last4: '' };
}

function extractCardDetails(text: string): { masked: string; last4: string } {
  const candidates = [
    ...text.matchAll(/(?:card|pan|account|visa|master\s*card|mastercard)[^\n]{0,50}?(\*{2,}|x{2,}|\d{4})[\s-]*(?:\*{2,}|x{2,}|\d{0,4})[\s-]*(?:\*{2,}|x{2,}|\d{0,4})[\s-]*(\d{4})/gi),
    ...text.matchAll(/\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7})\b/g),
    ...text.matchAll(/\b([xX*]{2,}[\s-]?[xX*]{2,}[\s-]?[xX*]{2,}[\s-]?\d{4})\b/g),
  ];

  for (const candidate of candidates) {
    const value = candidate[0] ?? candidate[1] ?? '';
    const masked = maskCardNumber(value);
    if (masked.masked) return masked;
  }

  return { masked: '', last4: '' };
}

function confidenceForDraft(draft: FuelSlipExtractionDraft): number {
  const checks = [
    Boolean(draft.supplierName),
    Boolean(draft.documentDate),
    Boolean(draft.fuelType),
    draft.litres !== null,
    draft.totalAmount !== null,
    Boolean(draft.paymentMethod),
    Boolean(draft.cardNumberMasked || draft.slipNumber || draft.transactionNumber),
  ];
  const score = checks.filter(Boolean).length / checks.length;
  return Math.round(score * 100) / 100;
}

export function parseFuelSlipText(rawText: string): FuelSlipExtractionResult {
  const warnings: string[] = [];
  const text = compact(rawText);
  const lines = normalizeLines(text);
  const draft = cloneEmptyDraft();

  if (!text || text.length < 20) {
    return {
      draft,
      rawText: '',
      warnings: ['No readable text was found. Complete the fuel slip manually.'],
      quality: 'none',
    };
  }

  draft.supplierName = extractSupplier(lines);
  draft.supplierVatNumber = extractVatNumber(text);
  draft.slipNumber = extractSlipNumber(text);
  draft.transactionNumber = extractTransactionNumber(text);
  draft.documentDate = extractDate(text);
  draft.documentTime = extractTime(text);
  draft.fuelType = extractFuelType(lines);
  draft.litres = extractLitres(text);
  draft.pricePerLitre = extractPricePerLitre(text);
  draft.totalAmount = extractTotal(lines);
  draft.vatAmount = extractVatAmount(lines);
  draft.vatIncluded = draft.vatAmount !== null || /\bvat\s*(?:inclusive|incl|included)|tax\s*(?:inclusive|incl|included)\b/i.test(text) ? true : null;
  draft.vatRate = /\b15\s*%|vat\s*@\s*15/i.test(text) ? 15 : null;
  draft.paymentMethod = detectPaymentMethod(text);
  draft.cardType = detectCardType(text);
  const card = extractCardDetails(text);
  draft.cardNumberMasked = card.masked;
  draft.cardLast4 = card.last4;
  draft.merchantNumber = extractNumberByLabel(text, 'merchant|merch');
  draft.terminalNumber = extractNumberByLabel(text, 'terminal|term');
  draft.siteNumber = extractNumberByLabel(text, 'site|station');

  if (draft.litres === null) warnings.push('Litres could not be read confidently.');
  if (draft.totalAmount === null) warnings.push('Total amount could not be read confidently.');
  if (!draft.documentDate) warnings.push('Slip date could not be read confidently.');
  if (!draft.cardNumberMasked && /\bcard|visa|master|credit|debit/i.test(text)) warnings.push('Card payment was detected, but the masked card number could not be read confidently.');

  const confidence = confidenceForDraft(draft);
  const requiredFound = Boolean(draft.documentDate && draft.litres !== null && draft.totalAmount !== null);
  draft.ocrConfidence = confidence;
  draft.reviewRequired = !requiredFound || confidence < 0.72 || warnings.length > 0;
  draft.extractionStatus = draft.reviewRequired ? 'needs_review' : 'extracted';

  return {
    draft,
    rawText: maskFuelSlipSensitiveText(text).slice(0, 20000),
    warnings: warnings.slice(0, 12),
    quality: requiredFound && confidence >= 0.72 ? 'good' : 'weak',
  };
}

export async function extractFuelSlipFromUpload(input: { data: Buffer; contentType: string; fileName: string }): Promise<FuelSlipExtractionResult> {
  const contentType = cleanText(input.contentType).toLowerCase();
  const fileName = cleanText(input.fileName).toLowerCase();

  if (contentType === 'application/pdf' || fileName.endsWith('.pdf')) {
    const text = extractDigitalPdfText(input.data);
    const compactText = compact(text);

    if (!compactText || compactText.length < 20) {
      return {
        draft: cloneEmptyDraft(),
        rawText: '',
        warnings: ['This PDF appears to be scanned or image-based. Fuel slip photo OCR currently supports JPG, JPEG, PNG and WEBP uploads. Complete the fields manually before saving.'],
        quality: 'none',
      };
    }

    return parseFuelSlipText(text);
  }

  if (isSupportedFuelSlipImage({ contentType, fileName })) {
    const ocr = await extractFuelSlipImageText(input);

    if (!ocr.rawText.trim()) {
      return {
        draft: cloneEmptyDraft(),
        rawText: '',
        warnings: ocr.warnings.length ? ocr.warnings.slice(0, 12) : ['No readable text was found. Complete the fuel slip manually.'],
        quality: 'none',
      };
    }

    const parsed = parseFuelSlipText(ocr.rawText);
    return {
      ...parsed,
      rawText: maskFuelSlipSensitiveText(parsed.rawText),
      warnings: [...ocr.warnings, ...parsed.warnings].slice(0, 12),
    };
  }

  if (contentType.startsWith('text/') || fileName.endsWith('.txt')) {
    return parseFuelSlipText(input.data.toString('utf8'));
  }

  return {
    draft: cloneEmptyDraft(),
    rawText: '',
    warnings: ['This file type could not be read automatically. Complete the fuel slip manually.'],
    quality: 'none',
  };
}
