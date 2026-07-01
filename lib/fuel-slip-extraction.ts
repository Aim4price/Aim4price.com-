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

const TECHNICAL_NUMBER_LINE = /\b(?:UTI|AID|IAD|CTQ|TVR|AC|RRN|TSN|terminal\s*(?:id|number|no|nr)?|merchant\s*(?:id|number|no|nr)?|batch\s*(?:number|no|nr)?|auth(?:orisation|orization)?\s*(?:code|number|no|nr)?|trace\s*(?:number|no|nr)?|card\s*(?:number|no|nr)?)\b/i;
const CARD_CONTEXT = /\b(?:card|pan|account|visa|master\s*card|mastercard|debit|credit|kaart)\b/i;
const CARD_EXCLUDED_CONTEXT = /\b(?:UTI|AID|IAD|CTQ|TVR|RRN|TSN|terminal|merchant|batch|auth|trace)\b/i;

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

function safeCardMask(last4: string): string {
  return /^\d{4}$/.test(last4) ? `************${last4}` : '';
}

function extractLast4FromCardLikeValue(value: unknown, options: { requireContext?: boolean } = {}): string {
  const text = cleanText(value);
  if (!text) return '';

  const hasContext = CARD_CONTEXT.test(text);
  if (options.requireContext && !hasContext) return '';
  if (CARD_EXCLUDED_CONTEXT.test(text) && !hasContext) return '';

  const masked = /(?:\b\d{4,6}[\s-]*)?(?:[*xX]{2,}[\s-]*){1,4}(\d{4})\b/.exec(text);
  if (masked) return masked[1];

  const firstMasked = /\b\d{4,6}[\s-]*(?:[*xX]{2,}[\s-]*){1,3}(\d{4})\b/.exec(text);
  if (firstMasked) return firstMasked[1];

  const compactDigits = text.replace(/\D/g, '');
  if (compactDigits.length >= 13 && compactDigits.length <= 19 && (hasContext || !TECHNICAL_NUMBER_LINE.test(text))) {
    return compactDigits.slice(-4);
  }

  if (hasContext) {
    const tailDigits = /(?:ending|last\s*4|last\s*four|card|pan)[^\d]{0,24}(\d{4})\b/i.exec(text);
    if (tailDigits) return tailDigits[1];
  }

  return '';
}

function maskCardLikeMatch(value: string): string {
  const last4 = extractLast4FromCardLikeValue(value);
  return last4 ? safeCardMask(last4) : value;
}

export function maskFuelSlipSensitiveText(value: string): string {
  return String(value ?? '')
    .replace(/\b\d{4,6}[\s-]*(?:[*xX]{2,}[\s-]*){1,3}\d{4}\b/g, (match) => maskCardLikeMatch(match))
    .replace(/\b(?:[*xX]{2,}[\s-]*){1,4}\d{4}\b/g, (match) => maskCardLikeMatch(match))
    .replace(/\b(?:\d[\s-]?){13,19}\b/g, (match) => maskCardLikeMatch(match));
}

function parseDecimal(value: unknown, decimals = 2): number | null {
  let text = cleanText(value)
    .replace(/zar/gi, '')
    .replace(/rand/gi, '')
    .replace(/litres?|liters?|l\b/gi, '')
    .replace(/per/gi, '')
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
    text = last.length <= 3 ? `${parts.slice(0, -1).join('')}.${last}` : text.replace(/,/g, '');
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
  return String.raw`(?:ZAR\s*)?R\s*\d(?:[\d ,.]*\d)?(?:[.,]\d{2,4})?|(?:ZAR\s*)?\d(?:[\d ,]*\d)?[.,]\d{2,4}`;
}

function firstGroup(pattern: RegExp, text: string): string {
  const match = pattern.exec(text);
  return cleanText(match?.[1] ?? '');
}

function titleCaseWords(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\bfc\b/i, 'FC')
    .replace(/\bae\b/i, 'AE')
    .trim();
}

function normaliseFuelType(value: string): string {
  const text = cleanText(value).replace(/\s+/g, ' ');
  if (!text) return '';

  if (/excellium\s*d\s*50/i.test(text)) return 'Excellium D50';

  if (/diesel|\bd\s*50\b/i.test(text)) {
    if (/500\s*(?:ppm)?/i.test(text)) return 'Diesel 500ppm';
    if (/50\s*(?:ppm|a)?\b|\bd\s*50\b/i.test(text)) return 'Diesel 50ppm';
    return 'Diesel';
  }

  const unleaded = /unleaded\s*(93|95)/i.exec(text);
  if (unleaded) return `Unleaded ${unleaded[1]}`;

  const petrol = /petrol\s*(93|95)?/i.exec(text);
  if (petrol) return petrol[1] ? `Petrol ${petrol[1]}` : 'Petrol';

  return text.slice(0, 80);
}

function supplierLineScore(line: string, index: number): number {
  const text = cleanText(line).replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
  if (!/[A-Za-z]/.test(text) || text.length < 3 || text.length > 80) return -100;

  const lower = text.toLowerCase();
  const ignored = /(?:nedbank|first\s+national\s+bank|\bfnb\b|payment24|customer\s+copy|merchant\s+copy|receipt\s+print|tax\s+invoice|forecourt\s+eft|acquirer|approved|declined|terminal|merchant|card|pan|visa|mastercard|debit|credit|rrn|uti|aid|iad|ctq|tvr|batch|auth|trace|vat\s*(?:no|number|reg)?|total|amount|purchase|litres?|diesel|unleaded|petrol|date|time|cashier|attendant|pump|price|thank|visit|welcome|call\s+centre|balance|change|invoice)/i;
  if (ignored.test(text)) return -100;
  if (/^[-:\d\s.,/]+$/.test(text)) return -100;

  let score = 0;
  if (/\b(?:engen|astron|total|caltex|shell|bp|sasol|puma|gulf|fuel|motors?|garage|service\s+station|central|courtenay|bodorp|rainbow|al\s+bodorp|ae\s+george)\b/i.test(text)) score += 8;
  if (/\b(?:pty|ltd|cc|fc)\b/i.test(text)) score += 2;
  if (/^[A-Z0-9 .&'/-]{3,}$/.test(text) && /[A-Z]{2}/.test(text)) score += 1;
  if (text.split(/\s+/).length >= 2) score += 2;
  if (index <= 14) score += Math.max(0, 4 - Math.floor(index / 4));
  if (/\d{4,}/.test(text)) score -= 3;

  return score;
}

function extractSupplier(lines: string[]): string {
  const cleaned = lines.map((line) => cleanText(line));

  const explicitPatterns = [
    /\b(AL\s+BODORP\s+FC)\b/i,
    /\b(AE\s+GEORGE\s+CENTRAL)\b/i,
    /\b(TOTAL\s+COURTENAY)\b/i,
    /\b(ENGEN\s+MULTI\s+MOTORS)\b/i,
    /\b(RAINBOW\s+MOTORS)\b/i,
    /\b(ASTRON\s+ENERGY)\b/i,
  ];

  for (const pattern of explicitPatterns) {
    for (const line of cleaned) {
      const match = pattern.exec(line);
      if (match) return titleCaseWords(match[1]).slice(0, 180);
    }
  }

  const ranked = cleaned
    .map((line, index) => ({ line, score: supplierLineScore(line, index) }))
    .filter((candidate) => candidate.score > -100)
    .sort((a, b) => b.score - a.score);

  return cleanText(ranked[0]?.line ?? '').slice(0, 180);
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

  const local = /\b(?:D\s*[:=]\s*)?(\d{1,2})[-/.](\d{1,2})[-/.]((?:20|19)?\d{2})\b/i.exec(text);
  if (!local) return '';

  const day = local[1].padStart(2, '0');
  const month = local[2].padStart(2, '0');
  const year = local[3].length === 2 ? `20${local[3]}` : local[3];
  return `${year}-${month}-${day}`;
}

function extractTime(text: string): string {
  const match = /\b(?:T\s*[:=]\s*)?([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/i.exec(text);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}${match[3] ? `:${match[3]}` : ''}`;
}

function extractFuelType(lines: string[]): string {
  for (const line of lines) {
    const match = /(excellium\s*d\s*50|diesel\s*(?:50|500)?\s*(?:ppm|a)?|\bd\s*50\b|unleaded\s*(?:93|95)|petrol\s*(?:93|95)?)/i.exec(line);
    if (match) return normaliseFuelType(match[1]);
  }
  return '';
}

function extractLitres(text: string): number | null {
  const patterns = [
    /\b(?:litres?|liters?|ltrs?|qty|quantity)\s*[:=]?\s*(\d[\d ,.]*\d|\d)\b/i,
    /\b(\d[\d ,.]*\d|\d)\s*(?:l|litres?|liters?)\b/i,
    /\b(?:diesel|unleaded|petrol|excellium)[^\n]{0,80}?(\d[\d ,.]*\d|\d)\s*(?:l|litres?|liters?)\b/i,
  ];

  for (const pattern of patterns) {
    const parsed = parseDecimal(firstGroup(pattern, text), 3);
    if (parsed !== null && parsed > 0 && parsed < 100000) return parsed;
  }

  return null;
}

function extractPricePerLitre(text: string): number | null {
  const patterns = [
    /@\s*((?:ZAR\s*)?(?:R\s*)?\d[\d ,.]*(?:[.,]\d{2,4})?)\s*(?:per\s*(?:litre|liter|l))?/i,
    /(?:price|rate)\s*(?:per|\/)?\s*(?:litre|liter|l)\s*[:=]?\s*((?:ZAR\s*)?(?:R\s*)?\d[\d ,.]*(?:[.,]\d{2,4})?)/i,
    /\b(?:per\s*(?:litre|liter|l))\s*[:=]?\s*((?:ZAR\s*)?(?:R\s*)?\d[\d ,.]*(?:[.,]\d{2,4})?)/i,
  ];

  for (const pattern of patterns) {
    const parsed = parseDecimal(firstGroup(pattern, text), 4);
    if (parsed !== null && parsed > 0 && parsed < 1000) return parsed;
  }

  return null;
}

function hasCurrencyMarker(line: string): boolean {
  return /(?:\bZAR\b|\bR\s*\d)/i.test(line);
}

function moneyValuesFromLine(line: string, allowUnmarkedAmount: boolean): number[] {
  if (TECHNICAL_NUMBER_LINE.test(line) && !hasCurrencyMarker(line)) return [];

  const money = new RegExp(`(${moneyPattern()})`, 'ig');
  return [...line.matchAll(money)]
    .filter((match) => allowUnmarkedAmount || /(?:ZAR|R\s*\d)/i.test(match[1]))
    .map((match) => parseDecimal(match[1], 2))
    .filter((value): value is number => value !== null && value > 0 && value < 10000000);
}

function extractTotal(lines: string[]): number | null {
  const amountLinePattern = /\b(?:grand\s+total|total\s+amount|amount\s+due|total\s+due|amnt|amount|purchase|sale|total)\b/i;
  const excludedTotalLine = /\b(?:subtotal|sub\s+total|vat\s*(?:no|number|reg)|change|balance|litres?|price\s*per|per\s*litre|pump)\b/i;
  const candidates: number[] = [];

  for (const line of lines) {
    if (!amountLinePattern.test(line) || excludedTotalLine.test(line)) continue;
    candidates.push(...moneyValuesFromLine(line, true));
  }

  if (candidates.length) return candidates[candidates.length - 1];

  const currencyCandidates: number[] = [];
  for (const line of lines) {
    if (/\b(?:litres?|price\s*per|per\s*litre|vat\s*(?:no|number|reg))\b/i.test(line)) continue;
    currencyCandidates.push(...moneyValuesFromLine(line, false));
  }

  return currencyCandidates.length ? Math.max(...currencyCandidates) : null;
}

function extractVatAmount(lines: string[]): number | null {
  const vatLines = lines.filter((line) => /\b(?:vat|tax)\b/i.test(line) && !/vat\s*(?:no|nr|number|reg)/i.test(line));

  for (const line of vatLines) {
    const values = moneyValuesFromLine(line, true).filter((value) => value >= 0);
    if (values.length) return values[values.length - 1];
  }

  return null;
}

function extractSlipNumber(text: string): string {
  return firstGroup(/\b(?:slip|receipt|invoice|inv|tax\s+invoice|document|doc)\s*(?:no|nr|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{2,40})/i, text).slice(0, 120);
}

function extractTransactionNumber(text: string): string {
  return firstGroup(/\b(?:transaction|trans|txn|trace|sequence|seq|rrn|auth(?:orisation|orization)?(?:\s*code)?|approval)\s*(?:no|nr|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{2,40})/i, text).slice(0, 120);
}

function extractNumberByLabel(text: string, labels: string): string {
  const pattern = new RegExp(`\\b(?:${labels})\\s*(?:no|nr|number|#|id)?\\s*[:#-]?\\s*([A-Z0-9][A-Z0-9\\/-]{1,40})`, 'i');
  return firstGroup(pattern, text).slice(0, 80);
}

function detectPaymentMethod(text: string): string {
  if (/\bcard\s+tender|\bcard\b|\bcredit\b|\bdebit\b|\bvisa\b|\bmaster\s*card|\bmastercard\b/i.test(text)) return 'card';
  if (/\bcash\b/i.test(text)) return 'cash';
  if (/\baccount\b/i.test(text)) return 'account';
  return '';
}

function detectCardType(text: string): string {
  if (/\bvisa\b/i.test(text)) return 'Visa';
  if (/\bmaster\s*card|\bmastercard\b/i.test(text)) return 'Mastercard';
  if (/\bamex|american\s+express\b/i.test(text)) return 'American Express';
  return '';
}

export function maskCardNumber(value: unknown): { masked: string; last4: string } {
  const last4 = extractLast4FromCardLikeValue(value);
  return { masked: safeCardMask(last4), last4 };
}

function extractCardDetails(text: string): { masked: string; last4: string } {
  const lines = normalizeLines(text);

  for (const line of lines) {
    if (!CARD_CONTEXT.test(line)) continue;
    const last4 = extractLast4FromCardLikeValue(line);
    if (last4) return { masked: safeCardMask(last4), last4 };
  }

  for (const line of lines) {
    const last4 = extractLast4FromCardLikeValue(line, { requireContext: false });
    if (last4 && /[*xX]/.test(line)) return { masked: safeCardMask(last4), last4 };
  }

  return { masked: '', last4: '' };
}

function confidenceForDraft(draft: FuelSlipExtractionDraft): number {
  const checks = [
    Boolean(draft.supplierName),
    Boolean(draft.documentDate),
    Boolean(draft.fuelType),
    draft.litres !== null,
    draft.pricePerLitre !== null,
    draft.totalAmount !== null,
    Boolean(draft.cardLast4 || draft.slipNumber || draft.transactionNumber),
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

  if (draft.pricePerLitre === null && draft.totalAmount !== null && draft.litres !== null && draft.litres > 0) {
    const calculatedRate = draft.totalAmount / draft.litres;
    if (Number.isFinite(calculatedRate) && calculatedRate > 0 && calculatedRate < 1000) {
      draft.pricePerLitre = Math.round(calculatedRate * 10000) / 10000;
    }
  }

  if (draft.litres === null) warnings.push('Litres could not be read confidently.');
  if (draft.totalAmount === null) warnings.push('Total amount could not be read confidently.');
  if (!draft.documentDate) warnings.push('Slip date could not be read confidently.');
  if (!draft.cardLast4 && /\bcard|visa|master|credit|debit/i.test(text)) warnings.push('Card payment was detected, but the last 4 card digits could not be read confidently.');

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
