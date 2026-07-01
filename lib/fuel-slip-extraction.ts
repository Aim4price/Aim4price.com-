import { extractDigitalPdfText } from './my-invoices-extraction';
import { extractFuelSlipImageText, isSupportedFuelSlipImage } from './fuel-slip-ocr';
import { parseFuelSlipDecimal, reconcileFuelSlipNumbers } from './fuel-slip-number';

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
  return parseFuelSlipDecimal(value, decimals);
}

const FUEL_SLIP_NUMBER_PATTERN = String.raw`\d(?:[\d ,.:]*\d)?`;

function moneyPattern(): string {
  return String.raw`(?:ZAR\s*)?R\s*${FUEL_SLIP_NUMBER_PATTERN}|(?:ZAR\s*)?${FUEL_SLIP_NUMBER_PATTERN}(?:[.,:]\d{2,4})`;
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
    .replace(/\bbp\b/i, 'BP')
    .replace(/\bulp\b/i, 'ULP')
    .trim();
}

type FuelTypeRule = {
  label: string;
  pattern: RegExp;
};

const FUEL_TYPE_RULES: FuelTypeRule[] = [
  { label: 'Diesel 50ppm', pattern: /\b(?:diesel\s*50\s*ppm|50\s*ppm\s*diesel|d\s*[- ]?50|diesel\s*0[,.]005\s*%)\b/i },
  { label: 'Diesel 500ppm', pattern: /\b(?:diesel\s*500\s*ppm|500\s*ppm\s*diesel|diesel\s*0[,.]05\s*%)\b/i },
  { label: 'Excellium Diesel', pattern: /\bexcellium\s+diesel\b/i },
  { label: 'Excellium D10', pattern: /\bexcellium\s*d\s*10\b/i },
  { label: 'Shell V-Power Diesel', pattern: /\bshell\s+v[- ]?power\s+diesel\b/i },
  { label: 'Shell FuelSave Diesel', pattern: /\bshell\s+fuel\s*save\s+diesel\b/i },
  { label: 'Engen Dynamic Diesel', pattern: /\bengen\s+dynamic\s+diesel\b/i },
  { label: 'Astron Diesel', pattern: /\bastron\s+diesel\b/i },
  { label: 'Quartech D', pattern: /\bquartech\s*d\b/i },
  { label: 'Sasol Turbodiesel', pattern: /\bsasol\s+turbo\s*diesel\b/i },
  { label: 'bp Ultimate Diesel', pattern: /\bbp\s+ultimate\s+diesel\b/i },
  { label: 'Ultimate Diesel', pattern: /\bultimate\s+diesel\b/i },
  { label: 'Diesel', pattern: /\bdiesel\b/i },
  { label: 'Unleaded 93', pattern: /\b(?:unleaded|ulp|petrol)\s*93\b/i },
  { label: 'Unleaded 95', pattern: /\b(?:unleaded|ulp|petrol)\s*95\b/i },
  { label: 'Shell V-Power', pattern: /\bshell\s+v[- ]?power\b/i },
  { label: 'bp Ultimate Unleaded', pattern: /\bbp\s+ultimate\s+unleaded\b/i },
  { label: 'Engen Primax', pattern: /\bengen\s+primax\b/i },
  { label: 'Sasol ULP', pattern: /\bsasol\s+ulp\b/i },
  { label: 'Excellium Petrol', pattern: /\bexcellium\s+petrol\b/i },
  { label: 'Unleaded', pattern: /\bunleaded\b|\bulp\b/i },
  { label: 'Petrol', pattern: /\bpetrol\b/i },
  { label: 'AdBlue', pattern: /\bad\s*blue\b/i },
  { label: 'Paraffin', pattern: /\bparaffin\b/i },
];

function normaliseFuelType(value: string): string {
  const text = cleanText(value).replace(/\s+/g, ' ');
  if (!text) return '';

  for (const rule of FUEL_TYPE_RULES) {
    if (rule.pattern.test(text)) return rule.label;
  }

  return text.slice(0, 80);
}

const BANK_OR_ACQUIRER_LINE = /\b(?:fnb|first\s+national\s+bank|firstrand|nedbank|absa|standard\s+bank|capitec|discovery\s+bank|investec|african\s+bank|bidvest\s+bank|tyme\s*bank|bank\s+zero|visa|master\s*card|mastercard|card\s+division|acquirer|payment\s+terminal|forecourt\s+eft)\b/i;
const NON_SUPPLIER_LINE = /\b(?:south\s+africa|customer\s+copy|merchant\s+copy|approved|authorised|authorized|declined|receipt|tax\s+invoice|invoice|cashier|attendant|pump|thank\s+you|welcome|call\s+centre|balance|change|date|time|trace|uti|aid|iad|ctq|tvr|rrn|tsn|terminal|merchant|batch|auth|approval|card|pan|debit|credit|amount|amnt|purchase|sale|subtotal|total\s+(?:amount|due)|litres?|ltrs?|price\s*per|per\s*litre)\b/i;
const ADDRESS_LINE = /\b(?:street|straat|road|rd|avenue|ave|drive|dr|singel|lane|ln|crescent|cresc|close|park|industrial|oudtshoorn|george|western\s+cape|cape|province|south\s+africa)\b/i;
const FUEL_MERCHANT_WORDS = /\b(?:engen|shell|bp|totalenergies|total|astron|caltex|sasol|puma|gulf|fuel|motors?|garage|service\s+station|filling\s+station|truck\s+stop|stop|depot|energy|petroleum)\b/i;

function normalizedSupplierCandidate(line: string): string {
  return cleanText(line)
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    .replace(/\s{2,}/g, ' ');
}

function isBankOrAcquirerLine(line: string): boolean {
  const text = normalizedSupplierCandidate(line);
  if (!text) return false;
  const compactLine = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return BANK_OR_ACQUIRER_LINE.test(compactLine);
}

function supplierLineScore(line: string, index: number): number {
  const text = normalizedSupplierCandidate(line);
  if (!/[A-Za-z]/.test(text) || text.length < 3 || text.length > 90) return -100;
  if (/^[-:\d\s.,/]+$/.test(text)) return -100;
  if (isBankOrAcquirerLine(text)) return -100;
  if (TECHNICAL_NUMBER_LINE.test(text)) return -100;
  if (NON_SUPPLIER_LINE.test(text)) return -100;
  if (/^total$/i.test(text) || (/\btotal\b/i.test(text) && /(?:\d|amount|due|zar|r\s*\d)/i.test(text))) return -100;
  if (ADDRESS_LINE.test(text) && !FUEL_MERCHANT_WORDS.test(text)) return -80;
  if (/\b(?:diesel|unleaded|petrol|ad\s*blue|paraffin)\b/i.test(text)) return -100;
  if (/\b(?:r\s*\d|zar|\d+[,.]\d{2})\b/i.test(text)) return -80;

  let score = 0;
  if (FUEL_MERCHANT_WORDS.test(text)) score += 12;
  if (/\b(?:pty|ltd|cc|co\.?|inc)\b/i.test(text)) score += 2;
  if (/^[A-Z0-9 .&'/-]{3,}$/.test(text) && /[A-Z]{2}/.test(text)) score += 2;
  if (text.split(/\s+/).length >= 2) score += 3;
  if (index <= 12) score += Math.max(0, 6 - Math.floor(index / 2));
  if (/\d{4,}/.test(text)) score -= 5;

  return score;
}

function extractSupplier(lines: string[]): string {
  const ranked = lines
    .map((line, index) => ({ line: normalizedSupplierCandidate(line), index, score: supplierLineScore(line, index) }))
    .filter((candidate) => candidate.score > -100)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return titleCaseWords(cleanText(ranked[0]?.line ?? '')).slice(0, 180);
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
    if (/\b(?:total|amount|amnt|purchase|sale|vat|rrn|trace|terminal|merchant|card|visa|mastercard)\b/i.test(line)) continue;

    for (const rule of FUEL_TYPE_RULES) {
      const match = rule.pattern.exec(line);
      if (match) return normaliseFuelType(match[0]);
    }
  }

  return '';
}

function extractLitres(text: string): number | null {
  const patterns = [
    new RegExp(String.raw`\b(?:litres?|liters?|ltrs?|qty|quantity)\s*[:=]?\s*(${FUEL_SLIP_NUMBER_PATTERN})\b`, 'i'),
    new RegExp(String.raw`\b(${FUEL_SLIP_NUMBER_PATTERN})\s*(?:l|litres?|liters?|ltrs?)\b`, 'i'),
    new RegExp(String.raw`\b(?:diesel|unleaded|petrol|excellium|ad\s*blue|paraffin)[^\n]{0,80}?(${FUEL_SLIP_NUMBER_PATTERN})\s*(?:l|litres?|liters?|ltrs?)\b`, 'i'),
  ];

  for (const pattern of patterns) {
    const parsed = parseDecimal(firstGroup(pattern, text), 3);
    if (parsed !== null && parsed > 0 && parsed < 100000) return parsed;
  }

  return null;
}

function extractPricePerLitre(text: string): number | null {
  const amountPattern = String.raw`(?:ZAR\s*)?(?:R\s*)?${FUEL_SLIP_NUMBER_PATTERN}`;
  const patterns = [
    new RegExp(String.raw`@\s*(${amountPattern})\s*(?:per\s*(?:litre|liter|l))?`, 'i'),
    new RegExp(String.raw`(?:price|rate)\s*(?:per|/)?\s*(?:litre|liter|l)\s*[:=]?\s*(${amountPattern})`, 'i'),
    new RegExp(String.raw`\b(?:per\s*(?:litre|liter|l))\s*[:=]?\s*(${amountPattern})`, 'i'),
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
  const excludedTotalLine = /@|\b(?:subtotal|sub\s+total|vat\s*(?:no|number|reg)|change|balance|litres?|ltrs?|price\s*per|per\s*litre|rate\s*\/\s*l|pump|uti|aid|rrn|tsn|trace|tvr|terminal|merchant)\b/i;
  const candidates: number[] = [];

  for (const line of lines) {
    if (!amountLinePattern.test(line) || excludedTotalLine.test(line)) continue;
    candidates.push(...moneyValuesFromLine(line, true));
  }

  if (candidates.length) return candidates[candidates.length - 1];

  const currencyCandidates: number[] = [];
  for (const line of lines) {
    if (/@|\b(?:litres?|ltrs?|price\s*per|per\s*litre|rate\s*\/\s*l|vat\s*(?:no|number|reg)|uti|aid|rrn|tsn|trace|tvr|terminal|merchant)\b/i.test(line)) continue;
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
  return firstGroup(/\b(?:transaction|trans|txn|trace|sequence|seq|rrn|approval|auth(?:orisation|orization)\s*(?:code|number)?|auth\s*(?:code|no|nr|number))\s*(?:no|nr|number|#)?\s*[:#-]\s*([A-Z0-9][A-Z0-9\/-]{2,40})/i, text).slice(0, 120);
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

  if (!text || (text.length < 20 && !/\b(?:total|amnt|amount|purchase|sale|zar|r\s*\d)\b/i.test(text))) {
    return {
      draft,
      rawText: '',
      warnings: ['No readable text was found. Complete the fuel slip manually.'],
      quality: 'none',
    };
  }

  draft.supplierName = maskFuelSlipSensitiveText(extractSupplier(lines));
  draft.supplierVatNumber = extractVatNumber(text);
  draft.slipNumber = maskFuelSlipSensitiveText(extractSlipNumber(text));
  draft.transactionNumber = maskFuelSlipSensitiveText(extractTransactionNumber(text));
  draft.documentDate = extractDate(text);
  draft.documentTime = '';
  draft.fuelType = extractFuelType(lines);
  draft.litres = extractLitres(text);
  draft.pricePerLitre = extractPricePerLitre(text);
  draft.totalAmount = extractTotal(lines);

  const reconciledNumbers = reconcileFuelSlipNumbers({
    litres: draft.litres,
    pricePerLitre: draft.pricePerLitre,
    totalAmount: draft.totalAmount,
  });
  draft.litres = reconciledNumbers.fields.litres;
  draft.pricePerLitre = reconciledNumbers.fields.pricePerLitre;
  draft.totalAmount = reconciledNumbers.fields.totalAmount;
  warnings.push(...reconciledNumbers.warnings);

  draft.vatAmount = extractVatAmount(lines);
  draft.vatIncluded = draft.vatAmount !== null || /\bvat\s*(?:inclusive|incl|included)|tax\s*(?:inclusive|incl|included)\b/i.test(text) ? true : null;
  draft.vatRate = /\b15\s*%|vat\s*@\s*15/i.test(text) ? 15 : null;
  draft.paymentMethod = maskFuelSlipSensitiveText(detectPaymentMethod(text));
  draft.cardType = maskFuelSlipSensitiveText(detectCardType(text));
  const card = extractCardDetails(text);
  draft.cardNumberMasked = card.masked;
  draft.cardLast4 = card.last4;
  draft.merchantNumber = maskFuelSlipSensitiveText(extractNumberByLabel(text, 'merchant|merch'));
  draft.terminalNumber = maskFuelSlipSensitiveText(extractNumberByLabel(text, 'terminal|term'));
  draft.siteNumber = maskFuelSlipSensitiveText(extractNumberByLabel(text, 'site|station'));

  if (!draft.fuelType) warnings.push('Fuel type could not be read confidently.');
  if (draft.litres === null) warnings.push('Litres could not be read confidently.');
  if (draft.pricePerLitre === null) warnings.push('Price per litre could not be read confidently.');
  if (draft.totalAmount === null) warnings.push('Total amount could not be read confidently.');
  if (!draft.documentDate) warnings.push('Slip date could not be read confidently.');
  if (!draft.cardLast4 && /\bcard|visa|master|credit|debit/i.test(text)) warnings.push('Card payment was detected, but the last 4 card digits could not be read confidently.');

  const confidence = confidenceForDraft(draft);
  const completeFuelDetails = Boolean(draft.documentDate && draft.fuelType && draft.litres !== null && draft.litres > 0 && draft.totalAmount !== null);
  if (!completeFuelDetails && (draft.litres === null || !draft.fuelType) && (draft.totalAmount !== null || draft.cardLast4 || draft.supplierName || draft.documentDate)) {
    warnings.push('Fuel slip saved for review. Litres or fuel type missing.');
  }

  const uniqueWarnings = [...new Set(warnings.map((warning) => cleanText(warning)).filter(Boolean))];
  draft.ocrConfidence = confidence;
  draft.reviewRequired = !completeFuelDetails || reconciledNumbers.mismatch || confidence < 0.72 || uniqueWarnings.length > 0;
  draft.extractionStatus = draft.reviewRequired ? 'needs_review' : 'extracted';

  return {
    draft,
    rawText: maskFuelSlipSensitiveText(text).slice(0, 20000),
    warnings: uniqueWarnings.slice(0, 12),
    quality: completeFuelDetails && confidence >= 0.72 && !reconciledNumbers.mismatch ? 'good' : 'weak',
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
