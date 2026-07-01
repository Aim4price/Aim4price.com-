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

const MAX_EXTRACTED_TEXT_LENGTH = 20000;
const TECHNICAL_NUMBER_LINE = /\b(?:UTI|AID|IAD|CTQ|TVR|AC|RRN|TSN|terminal\s*(?:id|number|no|nr)?|merchant\s*(?:id|number|no|nr)?|batch\s*(?:number|no|nr)?|auth(?:orisation|orization)?\s*(?:code|number|no|nr)?|trace\s*(?:number|no|nr)?|card\s*(?:number|no|nr)?)\b/i;
const TECHNICAL_CARD_AMOUNT_LINE = /\b(?:UTI|AID|IAD|CTQ|TVR|AC|RRN|TSN|terminal|merchant|batch|auth|trace)\b/i;
const CARD_CONTEXT = /\b(?:card|pan|account|visa|master\s*card|mastercard|debit|credit|kaart)\b/i;
const CARD_EXCLUDED_CONTEXT = /\b(?:UTI|AID|IAD|CTQ|TVR|RRN|TSN|terminal|merchant|batch|auth|trace)\b/i;
const BANK_OR_ACQUIRER_LINE = /\b(?:fnb|first\s+national\s+bank|firstrand|nedbank|absa|standard\s+bank|capitec|discovery\s+bank|investec|african\s+bank|bidvest\s+bank|tyme\s*bank|bank\s+zero|visa|master\s*card|mastercard|card\s+division|acquirer|payment\s+terminal|forecourt\s+eft)\b/i;
const NON_SUPPLIER_LINE = /\b(?:south\s+africa|customer\s+copy|merchant\s+copy|approved|authorised|authorized|declined|receipt|tax\s+invoice|invoice|cashier|attendant|pump|thank\s+you|welcome|call\s+centre|balance|change|date|time|trace|uti|aid|iad|ctq|tvr|rrn|tsn|terminal|merchant|batch|auth|approval|card|pan|debit|credit|amount|amnt|purchase|sale|subtotal|total\s+(?:amount|due)|litres?|ltrs?|price\s*per|per\s*litre)\b/i;
const ADDRESS_LINE = /\b(?:street|straat|road|rd|avenue|ave|drive|dr|singel|lane|ln|crescent|cresc|close|park|industrial|province)\b/i;
const FUEL_MERCHANT_WORDS = /\b(?:engen|shell|bp|totalenergies|total|astron|caltex|sasol|puma|gulf|fuel|motors?|garage|service\s+station|filling\s+station|truck\s+stop|stop|depot|energy|petroleum)\b/i;
const FUEL_SLIP_NUMBER_PATTERN = String.raw`\d(?:[\d ,.:]*\d)?`;

type Candidate<T> = {
  raw: string;
  value: T;
  score: number;
  lineIndex: number;
  reason: string;
};

type FuelSlipCandidateSet = {
  supplier: Candidate<string>[];
  documentDate: Candidate<string>[];
  fuelType: Candidate<string>[];
  litres: Candidate<number>[];
  pricePerLitre: Candidate<number>[];
  totalAmount: Candidate<number>[];
  card: Candidate<{ masked: string; last4: string }>[];
};

type FuelTypeRule = {
  label: string;
  pattern: RegExp;
  score: number;
};

const FUEL_TYPE_RULES: FuelTypeRule[] = [
  { label: 'Diesel 50ppm', pattern: /\b(?:diesel\s*50\s*ppm|50\s*ppm\s*diesel|d\s*[- ]?50|diesel\s*0[,.]005\s*%)\b/i, score: 110 },
  { label: 'Diesel 500ppm', pattern: /\b(?:diesel\s*500\s*ppm|500\s*ppm\s*diesel|diesel\s*0[,.]05\s*%)\b/i, score: 108 },
  { label: 'Excellium Diesel', pattern: /\bexcellium\s+diesel\b/i, score: 105 },
  { label: 'Excellium D10', pattern: /\bexcellium\s*d\s*10\b/i, score: 105 },
  { label: 'Shell V-Power Diesel', pattern: /\bshell\s+v[- ]?power\s+diesel\b/i, score: 104 },
  { label: 'Shell FuelSave Diesel', pattern: /\bshell\s+fuel\s*save\s+diesel\b/i, score: 104 },
  { label: 'Engen Dynamic Diesel', pattern: /\bengen\s+dynamic\s+diesel\b/i, score: 104 },
  { label: 'Astron Diesel', pattern: /\bastron\s+diesel\b/i, score: 102 },
  { label: 'Quartech D', pattern: /\bquartech\s*d\b/i, score: 101 },
  { label: 'Sasol Turbodiesel', pattern: /\bsasol\s+turbo\s*diesel\b/i, score: 102 },
  { label: 'bp Ultimate Diesel', pattern: /\bbp\s+ultimate\s+diesel\b/i, score: 102 },
  { label: 'Ultimate Diesel', pattern: /\bultimate\s+diesel\b/i, score: 101 },
  { label: 'Diesel', pattern: /\bdiesel\b/i, score: 80 },
  { label: 'Unleaded 93', pattern: /\b(?:unleaded|ulp|petrol)\s*93\b/i, score: 100 },
  { label: 'Unleaded 95', pattern: /\b(?:unleaded|ulp|petrol)\s*95\b/i, score: 100 },
  { label: 'Shell V-Power', pattern: /\bshell\s+v[- ]?power\b/i, score: 95 },
  { label: 'bp Ultimate Unleaded', pattern: /\bbp\s+ultimate\s+unleaded\b/i, score: 96 },
  { label: 'Engen Primax', pattern: /\bengen\s+primax\b/i, score: 94 },
  { label: 'Sasol ULP', pattern: /\bsasol\s+ulp\b/i, score: 94 },
  { label: 'Excellium Petrol', pattern: /\bexcellium\s+petrol\b/i, score: 94 },
  { label: 'Unleaded', pattern: /\bunleaded\b|\bulp\b/i, score: 70 },
  { label: 'Petrol', pattern: /\bpetrol\b/i, score: 70 },
  { label: 'AdBlue', pattern: /\bad\s*blue\b/i, score: 80 },
  { label: 'Paraffin', pattern: /\bparaffin\b/i, score: 75 },
];

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

function normalizeTextForExtraction(rawText: string): string {
  return String(rawText ?? '')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => cleanText(line)
      .replace(/(\d)\s*([.,])\s*(\d)/g, '$1$2$3')
      .replace(/\s{2,}/g, ' '))
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_EXTRACTED_TEXT_LENGTH);
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
  const hasMask = /[*xX]{2,}/.test(text);
  if (options.requireContext && !hasContext) return '';
  if (CARD_EXCLUDED_CONTEXT.test(text) && !hasContext && !hasMask) return '';

  const masked = /(?:\b\d{4,6}[\s-]*)?(?:[*xX]{2,}[\s-]*){1,4}(\d{4})\b/.exec(text);
  if (masked) return masked[1];

  const firstMasked = /\b\d{4,6}[\s-]*(?:[*xX]{2,}[\s-]*){1,3}(\d{4})\b/.exec(text);
  if (firstMasked) return firstMasked[1];

  if (hasContext) {
    const tailDigits = /(?:ending|last\s*4|last\s*four|card|pan)[^\d]{0,24}(\d{4})\b/i.exec(text);
    if (tailDigits) return tailDigits[1];
  }

  const compactDigits = text.replace(/\D/g, '');
  if (compactDigits.length >= 13 && compactDigits.length <= 19 && (hasContext || !TECHNICAL_NUMBER_LINE.test(text))) {
    return compactDigits.slice(-4);
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

function moneyPattern(): string {
  return String.raw`(?:ZAR\s*)?R\s*${FUEL_SLIP_NUMBER_PATTERN}|(?:ZAR\s*)?${FUEL_SLIP_NUMBER_PATTERN}(?:[.,:]\d{2,4})`;
}

function firstGroup(pattern: RegExp, text: string): string {
  const match = pattern.exec(text);
  return cleanText(match?.[1] ?? '');
}

function bestCandidate<T>(candidates: Candidate<T>[]): Candidate<T> | null {
  return candidates
    .slice()
    .sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex || b.raw.length - a.raw.length)[0] ?? null;
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

function isDateLikeLine(line: string): boolean {
  return /\b(?:20\d{2}|19\d{2})[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(line)
    || /\b(?:D\s*[:=]\s*)?\d{1,2}[-/.]\d{1,2}[-/.](?:\d{2}|20\d{2}|19\d{2})\b/i.test(line)
    || /^\s*(?:T\s*[:=]\s*)?\d{1,2}:\d{2}(?::\d{2})?\s*$/i.test(line);
}

function supplierLineScore(line: string, index: number): number {
  const text = normalizedSupplierCandidate(line);
  if (!/[A-Za-z]/.test(text) || text.length < 3 || text.length > 90) return -100;
  if (/^[-:\d\s.,/]+$/.test(text)) return -100;
  if (isDateLikeLine(text)) return -100;
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

function collectSupplierCandidates(lines: string[]): Candidate<string>[] {
  return lines
    .map((line, index) => {
      const normalized = normalizedSupplierCandidate(line);
      return {
        raw: line,
        value: titleCaseWords(normalized),
        score: supplierLineScore(line, index),
        lineIndex: index,
        reason: 'supplier-line',
      };
    })
    .filter((candidate) => candidate.score > -100 && Boolean(candidate.value));
}

function extractVatNumber(text: string): string {
  return firstGroup(/\bvat\s*(?:no|nr|number|reg(?:istration)?\s*(?:no|number)?)\s*[:#-]?\s*([0-9][0-9\s-]{6,20})/i, text).replace(/[^0-9]/g, '').slice(0, 20);
}

function toFourDigitYear(value: string): string {
  if (value.length !== 2) return value;
  const year = Number(value);
  if (!Number.isFinite(year)) return `20${value}`;
  return year <= 79 ? `20${value.padStart(2, '0')}` : `19${value.padStart(2, '0')}`;
}

function validDateValue(year: string, month: string, day: string): string {
  const yyyy = Number(year);
  const mm = Number(month);
  const dd = Number(day);
  if (!Number.isInteger(yyyy) || !Number.isInteger(mm) || !Number.isInteger(dd)) return '';
  if (yyyy < 1900 || yyyy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';

  const normalized = `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  if (parsed.getUTCFullYear() !== yyyy || parsed.getUTCMonth() + 1 !== mm || parsed.getUTCDate() !== dd) return '';
  return normalized;
}

function collectDateCandidates(text: string): Candidate<string>[] {
  const candidates: Candidate<string>[] = [];
  const lines = normalizeLines(text);

  for (const [lineIndex, line] of lines.entries()) {
    for (const match of line.matchAll(/\b((?:20|19)\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
      const value = validDateValue(match[1], match[2], match[3]);
      if (value) {
        candidates.push({ raw: match[0], value, score: 120, lineIndex, reason: 'yyyy-mm-dd' });
      }
    }

    for (const match of line.matchAll(/\bD\s*[:=]\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})\b/gi)) {
      const value = validDateValue(toFourDigitYear(match[3]), match[2], match[1]);
      if (value) {
        candidates.push({ raw: match[0], value, score: 116, lineIndex, reason: 'd-prefix-dd-mm-yy' });
      }
    }

    for (const match of line.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.]((?:20|19)?\d{2})\b/g)) {
      if (/^(?:20|19)\d{2}/.test(match[0])) continue;
      const value = validDateValue(toFourDigitYear(match[3]), match[2], match[1]);
      if (value) {
        candidates.push({ raw: match[0], value, score: 96, lineIndex, reason: 'dd-mm-yy' });
      }
    }
  }

  return candidates;
}

function normaliseFuelType(value: string): string {
  const text = cleanText(value).replace(/\s+/g, ' ');
  if (!text) return '';

  for (const rule of FUEL_TYPE_RULES) {
    if (rule.pattern.test(text)) return rule.label;
  }

  return text.slice(0, 80);
}

function collectFuelTypeCandidates(lines: string[]): Candidate<string>[] {
  const candidates: Candidate<string>[] = [];

  for (const [lineIndex, line] of lines.entries()) {
    if (/\b(?:total|amount|amnt|purchase|sale|vat|rrn|trace|terminal|merchant|card|visa|mastercard)\b/i.test(line)) continue;

    for (const rule of FUEL_TYPE_RULES) {
      const match = rule.pattern.exec(line);
      if (!match) continue;
      candidates.push({
        raw: match[0],
        value: normaliseFuelType(match[0]),
        score: rule.score + (/@/.test(line) ? 8 : 0) + (lineIndex <= 40 ? Math.max(0, 4 - Math.floor(lineIndex / 10)) : 0),
        lineIndex,
        reason: 'fuel-type',
      });
      break;
    }
  }

  return candidates;
}

function addNumericCandidate(candidates: Candidate<number>[], raw: string, decimals: number, score: number, lineIndex: number, reason: string, maxValue: number): void {
  const parsed = parseDecimal(raw, decimals);
  if (parsed !== null && parsed > 0 && parsed < maxValue) {
    candidates.push({ raw: cleanText(raw), value: parsed, score, lineIndex, reason });
  }
}

function collectLitresCandidates(lines: string[]): Candidate<number>[] {
  const candidates: Candidate<number>[] = [];

  for (const [lineIndex, line] of lines.entries()) {
    if (TECHNICAL_CARD_AMOUNT_LINE.test(line) || CARD_CONTEXT.test(line) || isDateLikeLine(line)) continue;

    const labelled = new RegExp(String.raw`\b(?:litres?|liters?|ltrs?|qty|quantity)\s*[:=]?\s*(${FUEL_SLIP_NUMBER_PATTERN})\b`, 'ig');
    for (const match of line.matchAll(labelled)) {
      addNumericCandidate(candidates, match[1], 3, 120, lineIndex, 'litres-label-before-number', 100000);
    }

    const trailing = new RegExp(String.raw`\b(${FUEL_SLIP_NUMBER_PATTERN})\s*(?:l|litres?|liters?|ltrs?)\b`, 'ig');
    for (const match of line.matchAll(trailing)) {
      addNumericCandidate(candidates, match[1], 3, 95, lineIndex, 'litres-number-before-label', 100000);
    }

    const fuelLine = new RegExp(String.raw`\b(?:diesel|unleaded|petrol|excellium|ad\s*blue|paraffin)[^\n]{0,80}?(${FUEL_SLIP_NUMBER_PATTERN})\s*(?:l|litres?|liters?|ltrs?)\b`, 'ig');
    for (const match of line.matchAll(fuelLine)) {
      addNumericCandidate(candidates, match[1], 3, 85, lineIndex, 'fuel-line-litres', 100000);
    }
  }

  return candidates;
}

function collectPricePerLitreCandidates(lines: string[]): Candidate<number>[] {
  const candidates: Candidate<number>[] = [];
  const amountPattern = String.raw`(?:ZAR\s*)?(?:R\s*)?${FUEL_SLIP_NUMBER_PATTERN}`;

  for (const [lineIndex, line] of lines.entries()) {
    if (TECHNICAL_CARD_AMOUNT_LINE.test(line) || isDateLikeLine(line)) continue;

    const atPattern = new RegExp(String.raw`@\s*(${amountPattern})\s*(?:per\s*(?:litre|liter|l))?`, 'ig');
    for (const match of line.matchAll(atPattern)) {
      addNumericCandidate(candidates, match[1], 4, 130, lineIndex, 'at-price-per-litre', 1000);
    }

    const labelled = new RegExp(String.raw`(?:price|rate)\s*(?:per|/)?\s*(?:litre|liter|l)\s*[:=]?\s*(${amountPattern})`, 'ig');
    for (const match of line.matchAll(labelled)) {
      addNumericCandidate(candidates, match[1], 4, 116, lineIndex, 'price-label', 1000);
    }

    const perLitre = new RegExp(String.raw`\b(?:per\s*(?:litre|liter|l))\s*[:=]?\s*(${amountPattern})`, 'ig');
    for (const match of line.matchAll(perLitre)) {
      addNumericCandidate(candidates, match[1], 4, 100, lineIndex, 'per-litre-label', 1000);
    }
  }

  return candidates;
}

function hasCurrencyMarker(line: string): boolean {
  return /(?:\bZAR\b|\bR\s*\d)/i.test(line);
}

function moneyValuesFromLine(line: string, allowUnmarkedAmount: boolean): Array<{ raw: string; value: number }> {
  if (TECHNICAL_NUMBER_LINE.test(line) && !hasCurrencyMarker(line)) return [];

  const money = new RegExp(`(${moneyPattern()})`, 'ig');
  return [...line.matchAll(money)]
    .filter((match) => allowUnmarkedAmount || /(?:ZAR|R\s*\d)/i.test(match[1]))
    .map((match) => ({ raw: cleanText(match[1]), value: parseDecimal(match[1], 2) }))
    .filter((entry): entry is { raw: string; value: number } => entry.value !== null && entry.value > 0 && entry.value < 10000000);
}

function collectTotalCandidates(lines: string[]): Candidate<number>[] {
  const amountLinePattern = /\b(?:grand\s+total|total\s+amount|amount\s+due|total\s+due|card\s+tender|amnt|amount|purchase|sale|total)\b/i;
  const excludedTotalLine = /@|\b(?:subtotal|sub\s+total|vat\s*(?:no|number|reg)|change|balance|litres?|ltrs?|price\s*per|per\s*litre|rate\s*\/\s*l|pump|uti|aid|rrn|tsn|trace|tvr|terminal|merchant)\b/i;
  const candidates: Candidate<number>[] = [];

  for (const [lineIndex, line] of lines.entries()) {
    if (!amountLinePattern.test(line) || excludedTotalLine.test(line)) continue;

    let score = 95;
    if (/\b(?:grand\s+total|total\s+amount|amount\s+due|total\s+due|total|amnt)\b/i.test(line)) score += 25;
    if (/\b(?:purchase|sale|card\s+tender)\b/i.test(line)) score += 12;
    if (hasCurrencyMarker(line)) score += 8;

    for (const entry of moneyValuesFromLine(line, true)) {
      candidates.push({ raw: entry.raw, value: entry.value, score, lineIndex, reason: 'labelled-total' });
    }
  }

  for (const [lineIndex, line] of lines.entries()) {
    if (/@|\b(?:litres?|ltrs?|price\s*per|per\s*litre|rate\s*\/\s*l|vat\s*(?:no|number|reg)|uti|aid|rrn|tsn|trace|tvr|terminal|merchant)\b/i.test(line)) continue;

    for (const entry of moneyValuesFromLine(line, false)) {
      candidates.push({ raw: entry.raw, value: entry.value, score: 45 + (hasCurrencyMarker(line) ? 10 : 0), lineIndex, reason: 'fallback-currency' });
    }
  }

  return candidates;
}

function collectCardCandidates(lines: string[]): Candidate<{ masked: string; last4: string }>[] {
  const candidates: Candidate<{ masked: string; last4: string }>[] = [];

  for (const [lineIndex, line] of lines.entries()) {
    const last4 = extractLast4FromCardLikeValue(line, { requireContext: false });
    if (!last4) continue;

    const hasMask = /[*xX]{2,}/.test(line);
    const hasContext = CARD_CONTEXT.test(line);
    if (!hasMask && !hasContext) continue;

    candidates.push({
      raw: line,
      value: { masked: safeCardMask(last4), last4 },
      score: (hasMask ? 120 : 90) + (hasContext ? 10 : 0),
      lineIndex,
      reason: hasMask ? 'masked-card' : 'card-context',
    });
  }

  return candidates;
}

function collectFuelSlipCandidates(text: string, lines: string[]): FuelSlipCandidateSet {
  return {
    supplier: collectSupplierCandidates(lines),
    documentDate: collectDateCandidates(text),
    fuelType: collectFuelTypeCandidates(lines),
    litres: collectLitresCandidates(lines),
    pricePerLitre: collectPricePerLitreCandidates(lines),
    totalAmount: collectTotalCandidates(lines),
    card: collectCardCandidates(lines),
  };
}

function extractSupplier(lines: string[]): string {
  return bestCandidate(collectSupplierCandidates(lines))?.value.slice(0, 180) ?? '';
}

function extractDate(text: string): string {
  return bestCandidate(collectDateCandidates(text))?.value ?? '';
}

function extractFuelType(lines: string[]): string {
  return bestCandidate(collectFuelTypeCandidates(lines))?.value ?? '';
}

function extractLitres(lines: string[]): number | null {
  return bestCandidate(collectLitresCandidates(lines))?.value ?? null;
}

function extractPricePerLitre(lines: string[]): number | null {
  return bestCandidate(collectPricePerLitreCandidates(lines))?.value ?? null;
}

function extractTotal(lines: string[]): number | null {
  return bestCandidate(collectTotalCandidates(lines))?.value ?? null;
}

function extractVatAmount(lines: string[]): number | null {
  const vatLines = lines.filter((line) => /\b(?:vat|tax)\b/i.test(line) && !/vat\s*(?:no|nr|number|reg)/i.test(line));

  for (const line of vatLines) {
    const values = moneyValuesFromLine(line, true).filter((entry) => entry.value >= 0);
    if (values.length) return values[values.length - 1].value;
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

function extractCardDetails(lines: string[]): { masked: string; last4: string } {
  return bestCandidate(collectCardCandidates(lines))?.value ?? { masked: '', last4: '' };
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
  const rawTranscript = compact(rawText);
  const safeTranscript = maskFuelSlipSensitiveText(rawTranscript);
  const text = normalizeTextForExtraction(safeTranscript);
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

  const candidates = collectFuelSlipCandidates(text, lines);

  draft.supplierName = maskFuelSlipSensitiveText(bestCandidate(candidates.supplier)?.value ?? extractSupplier(lines));
  draft.supplierVatNumber = extractVatNumber(text);
  draft.slipNumber = maskFuelSlipSensitiveText(extractSlipNumber(text));
  draft.transactionNumber = maskFuelSlipSensitiveText(extractTransactionNumber(text));
  draft.documentDate = bestCandidate(candidates.documentDate)?.value ?? extractDate(text);
  draft.documentTime = '';
  draft.fuelType = bestCandidate(candidates.fuelType)?.value ?? extractFuelType(lines);
  draft.litres = bestCandidate(candidates.litres)?.value ?? extractLitres(lines);
  draft.pricePerLitre = bestCandidate(candidates.pricePerLitre)?.value ?? extractPricePerLitre(lines);
  draft.totalAmount = bestCandidate(candidates.totalAmount)?.value ?? extractTotal(lines);

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
  const card = bestCandidate(candidates.card)?.value ?? extractCardDetails(lines);
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
    rawText: maskFuelSlipSensitiveText(text).slice(0, MAX_EXTRACTED_TEXT_LENGTH),
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
