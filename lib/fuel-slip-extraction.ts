import { extractDigitalPdfText } from './my-invoices-extraction';
import { extractFuelSlipImageText, isSupportedFuelSlipImage } from './fuel-slip-ocr';
import { parseFuelSlipDecimal } from './fuel-slip-number';

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
const TECHNICAL_NUMBER_LINE = /\b(?:UTI|UTL|UIL|URL|UTIL|AID|IAD|CTQ|TVR|AC|RRN|TSN|terminal\s*(?:id|number|no|nr)?|merchant\s*(?:id|number|no|nr)?|batch\s*(?:number|no|nr)?|auth(?:orisation|orization)?\s*(?:code|number|no|nr)?|trace\s*(?:number|no|nr)?|card\s*(?:number|no|nr)?)\b/i;
const TECHNICAL_CARD_AMOUNT_LINE = /\b(?:UTI|UTL|UIL|URL|UTIL|AID|IAD|CTQ|TVR|AC|RRN|TSN|terminal|merchant|batch|auth|trace)\b/i;
const CARD_CONTEXT = /\b(?:card|pan|account|acc|visa|master\s*card|mastercard|debit|credit|kaart|eft|ending|last\s*4|last\s*four)\b/i;
const CARD_EXCLUDED_CONTEXT = /\b(?:UTI|UTL|UIL|URL|UTIL|AID|IAD|CTQ|TVR|RRN|TSN|terminal|merchant|batch|auth|trace)\b/i;
const BANK_OR_ACQUIRER_LINE = /\b(?:fnb|first\s+national\s+bank|firstrand|nedbank|absa|standard\s+bank|capitec|discovery\s+bank|investec|african\s+bank|bidvest\s+bank|tyme\s*bank|bank\s+zero|visa|master\s*card|mastercard|card\s+division|acquirer|payment\s+terminal|forecourt\s+eft)\b/i;
const NON_SUPPLIER_LINE = /\b(?:south\s+africa|customer\s+copy|merchant\s+copy|approved|authorised|authorized|declined|receipt|tax\s+invoice|invoice|cashier|attendant|pump|thank\s+you|welcome|call\s+centre|balance|change|date|time|trace|uti|utl|uil|url|util|aid|iad|ctq|tvr|rrn|tsn|terminal|merchant|batch|auth|approval|card|pan|debit|credit|amount|amnt|purchase|sale|subtotal|total\s+(?:amount|due)|litres?|ltrs?|price\s*per|per\s*litre)\b/i;
const ADDRESS_LINE = /\b(?:street|straat|road|rd|avenue|ave|drive|dr|singel|lane|ln|crescent|cresc|close|park|industrial|province)\b/i;
const FUEL_MERCHANT_WORDS = /\b(?:engen|shell|bp|totalenergies|total|astron|caltex|sasol|puma|gulf|fuel|motors?|garage|service\s+station|filling\s+station|truck\s+stop|stop|depot|energy|petroleum)\b/i;
const FUEL_PRODUCT_LINE = /\b(?:diesel|d[i1l|]e[s5]el|unleaded|ulp|petrol|excellium|ad\s*blue|paraffin|primax|dynamic\s+(?:diesel|d[i1l|]e[s5]el)|v[- ]?power|fuel\s*save|quartech|turbo\s*(?:diesel|d[i1l|]e[s5]el)|turbodiesel|ultimate\s+(?:diesel|d[i1l|]e[s5]el)|d\s*[- ]?50|50\s*ppm|500\s*ppm|(?:ulp|unleaded|petrol)\s*9[35])\b/i;
const FUEL_SLIP_NUMBER_PATTERN = String.raw`\d(?:[\d ,.:]*\d)?`;
const CARD_MASK_CLASS = String.raw`[*xX#•·●∙]`;
const LOOKAHEAD_LABEL_LINES = 2;
const LITRES_LABEL_OCR = /\b(?:l\s*[i1|]\s*t\s*r\s*e\s*s+|l\s*[i1|]{2}\s*r\s*e\s*s+|l\s*[i1|]{2}\s*k\s*e\s*s+|c\s*[i1|]\s*l\s*[i1|]\s*r\s*e\s*s+|e\s*[i1|]\s*t\s*r?\s*e\s*s+|e\s*l\s*[i1|]\s*r?\s*e\s*s+|litre5|l1tres|liires|lires|litres?|llikes|lliikes|cilires)\b\s*[:;|]?/i;
const AMOUNT_LABEL_OCR = /\b(?:amnt|amn[ti1|]?|amin[ti1|]?|amount|amt)\b\s*[:;|]?/i;

type Candidate<T> = {
  raw: string;
  value: T;
  score: number;
  lineIndex: number;
  reason: string;
};

type NumericLineToken = {
  raw: string;
  value: number;
  start: number;
  end: number;
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

type NumericSelection = {
  litres: Candidate<number> | null;
  pricePerLitre: Candidate<number> | null;
  totalAmount: Candidate<number> | null;
  reason: string;
};

type FuelTypeRule = {
  label: string;
  pattern: RegExp;
  score: number;
};

const FUEL_TYPE_RULES: FuelTypeRule[] = [
  { label: 'Diesel 50ppm', pattern: /\b(?:(?:diesel|d[i1l|]e[s5]el)\s*50\s*ppm|50\s*ppm\s*(?:diesel|d[i1l|]e[s5]el)|d\s*[- ]?50|(?:diesel|d[i1l|]e[s5]el)\s*0[,.]005\s*%)\b/i, score: 110 },
  { label: 'Diesel 500ppm', pattern: /\b(?:(?:diesel|d[i1l|]e[s5]el)\s*500\s*ppm|500\s*ppm\s*(?:diesel|d[i1l|]e[s5]el)|(?:diesel|d[i1l|]e[s5]el)\s*0[,.]05\s*%)\b/i, score: 108 },
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
  { label: 'Diesel', pattern: /\b(?:diesel|d[i1l|]e[s5]el)\b/i, score: 80 },
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
    .replace(/[，]/g, ',')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function repairFuelSlipOcrLine(line: string): string {
  let text = cleanText(line)
    .replace(/\bR\s*[kK](?=\s*\d)/g, 'R ')
    .replace(/\b(?:UTI|UTL|UIL|URL|UTIL|U\s*[TtI1l|]{1,3})\b\s*[:;|]/gi, 'UTI:')
    .replace(/\bTRAC[EF]\b/gi, 'TRACE');

  text = text.replace(LITRES_LABEL_OCR, 'LITRES: ');
  text = text.replace(AMOUNT_LABEL_OCR, 'AMNT ');

  return cleanText(text)
    .replace(/\s+:/g, ':')
    .replace(/\s{2,}/g, ' ');
}

function repairFuelSlipNumericOcrText(value: string): string {
  return repairFuelSlipOcrLine(value)
    .replace(/(\d)\s*[;；]\s*(?=[\doOlI|!sSgGqQbBcCkKzZ])/g, '$1.')
    .replace(/([,.:])\s*[cC]\s*(?=\d)/g, '$1')
    .replace(/([,.:]\d{1,3})[kK]\b/g, (_match, prefix: string) => `${prefix}1`)
    .replace(/([,.:])\s*[oO]\s*(?=\d)/g, (_match, prefix: string) => `${prefix}0`)
    .replace(/([,.:])\s*[lI|!]\s*(?=\d)/g, (_match, prefix: string) => `${prefix}1`);
}

function normalizeTextForExtraction(rawText: string): string {
  return String(rawText ?? '')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[，]/g, ',')
    .replace(/[‐‑‒–—]/g, '-')
    .split('\n')
    .map((line) => repairFuelSlipOcrLine(line)
      .replace(/(\d)\s*([.,:])\s*(\d)/g, '$1$2$3')
      .replace(/\s{2,}/g, ' '))
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_EXTRACTED_TEXT_LENGTH);
}

function normalizeLines(rawText: string): string[] {
  return String(rawText ?? '')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => repairFuelSlipOcrLine(line))
    .filter(Boolean)
    .slice(0, 420);
}

function compact(rawText: string): string {
  return normalizeLines(rawText).join('\n');
}

function safeCardMask(last4: string): string {
  return /^\d{4}$/.test(last4) ? `************${last4}` : '';
}

function hasCardMask(text: string): boolean {
  return (text.match(new RegExp(CARD_MASK_CLASS, 'g')) ?? []).length >= 2;
}

function extractLast4FromCardLikeValue(value: unknown, options: { requireContext?: boolean } = {}): string {
  const text = cleanText(value);
  if (!text) return '';

  const hasContext = CARD_CONTEXT.test(text);
  const hasMask = hasCardMask(text);
  if (options.requireContext && !hasContext) return '';
  if (CARD_EXCLUDED_CONTEXT.test(text) && !hasContext && !hasMask) return '';

  const masked = new RegExp(String.raw`(?:\b\d{4,6}[\s-]*)?(?:${CARD_MASK_CLASS}{1,}[\s-]*){1,8}(\d{4})\b`).exec(text);
  if (masked) return masked[1];

  const firstMasked = new RegExp(String.raw`\b\d{4,6}[\s-]*(?:${CARD_MASK_CLASS}{1,}[\s-]*){1,6}(\d{4})\b`).exec(text);
  if (firstMasked) return firstMasked[1];

  if (hasMask) {
    const maskedTail = new RegExp(String.raw`(?:${CARD_MASK_CLASS}\s*){2,}.{0,48}?(\d{4})\b`).exec(text);
    if (maskedTail) return maskedTail[1];
  }

  if (hasContext) {
    const tailDigits = /(?:ending|last\s*4|last\s*four|card|kaart|pan|acc(?:ount)?)[^\d]{0,32}(\d{4})\b/i.exec(text);
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

function isTechnicalOnlyNumberLine(line: string): boolean {
  const text = cleanText(line);
  return TECHNICAL_NUMBER_LINE.test(text) && !CARD_CONTEXT.test(text);
}

function maskFuelSlipSensitiveLine(line: string): string {
  if (isTechnicalOnlyNumberLine(line)) return line;

  return line
    .replace(new RegExp(String.raw`\b\d{4,6}[\s-]*(?:${CARD_MASK_CLASS}{1,}[\s-]*){1,6}\d{4}\b`, 'g'), (match) => maskCardLikeMatch(match))
    .replace(new RegExp(String.raw`\b(?:${CARD_MASK_CLASS}{1,}[\s-]*){1,8}\d{4}\b`, 'g'), (match) => maskCardLikeMatch(match))
    .replace(/\b(?:\d[ \t-]?){13,19}\b/g, (match) => maskCardLikeMatch(match));
}

export function maskFuelSlipSensitiveText(value: string): string {
  return String(value ?? '')
    .split(/(\r?\n)/)
    .map((part) => (/^\r?\n$/.test(part) ? part : maskFuelSlipSensitiveLine(part)))
    .join('');
}

function parseDecimal(value: unknown, decimals = 2): number | null {
  return parseFuelSlipDecimal(value, decimals);
}

function roundDecimal(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
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

function normalizeDateSearchLine(line: string): string {
  return cleanText(line)
    .replace(/[\\|]/g, '/')
    .replace(/[oO](?=\d)|(?<=\d)[oO]/g, '0')
    .replace(/[lI](?=\d)|(?<=\d)[lI]/g, '1')
    .replace(/(\d)\s*([-/.])\s*(\d)/g, '$1$2$3')
    .replace(/\s+/g, ' ');
}

function isDateLikeLine(line: string): boolean {
  const normalized = normalizeDateSearchLine(line);
  return /\b(?:20\d{2}|19\d{2})[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(normalized)
    || /\b(?:D\s*[:=]\s*)?\d{1,2}[-/.]\d{1,2}[-/.](?:\d{2}|20\d{2}|19\d{2})\b/i.test(normalized)
    || /^\s*(?:T\s*[:=]\s*)?\d{1,2}:\d{2}(?::\d{2})?\s*$/i.test(normalized);
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
  if (index <= 14) score += Math.max(0, 7 - Math.floor(index / 2));
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

function dateCandidateScore(line: string, base: number): number {
  let score = base;
  if (/\b(?:date|datum|trans(?:action)?\s*date|purchase\s*date)\b/i.test(line)) score += 12;
  if (/\b(?:time|terminal|merchant|trace|rrn|batch|auth)\b/i.test(line)) score -= 4;
  return score;
}

function collectDateCandidates(text: string): Candidate<string>[] {
  const candidates: Candidate<string>[] = [];
  const lines = normalizeLines(text);

  for (const [lineIndex, originalLine] of lines.entries()) {
    const line = normalizeDateSearchLine(originalLine);

    for (const match of line.matchAll(/\b((?:20|19)\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
      const value = validDateValue(match[1], match[2], match[3]);
      if (value) candidates.push({ raw: match[0], value, score: dateCandidateScore(originalLine, 122), lineIndex, reason: 'yyyy-mm-dd' });
    }

    for (const match of line.matchAll(/\bD\s*[:=]\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})\b/gi)) {
      const value = validDateValue(toFourDigitYear(match[3]), match[2], match[1]);
      if (value) candidates.push({ raw: match[0], value, score: dateCandidateScore(originalLine, 118), lineIndex, reason: 'd-prefix-dd-mm-yy' });
    }

    for (const match of line.matchAll(/\b(?:date|datum|purchase\s*date|trans(?:action)?\s*date)\s*[:#-]?\s*(\d{1,2})[-/.](\d{1,2})[-/.]((?:20|19)?\d{2})\b/gi)) {
      const value = validDateValue(toFourDigitYear(match[3]), match[2], match[1]);
      if (value) candidates.push({ raw: match[0], value, score: 118, lineIndex, reason: 'labelled-dd-mm-yyyy' });
    }

    for (const match of line.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.]((?:20|19)?\d{2})\b/g)) {
      if (/^(?:20|19)\d{2}/.test(match[0])) continue;
      const value = validDateValue(toFourDigitYear(match[3]), match[2], match[1]);
      if (value) candidates.push({ raw: match[0], value, score: dateCandidateScore(originalLine, 98), lineIndex, reason: 'dd-mm-yy' });
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
        score: rule.score + (/@|\b(?:qty|litres?|volume|rate|price)\b/i.test(line) ? 8 : 0) + (lineIndex <= 40 ? Math.max(0, 4 - Math.floor(lineIndex / 10)) : 0),
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

function addRateCandidate(candidates: Candidate<number>[], raw: string, line: string, score: number, lineIndex: number, reason: string): void {
  const parsed = parseDecimal(raw, 4);
  if (parsed === null || parsed <= 0) return;

  let value = parsed;
  if ((/\b(?:c\s*\/\s*l|cents?\s*(?:per|\/)?\s*l(?:itre)?)\b/i.test(line) && value >= 100) || (value >= 100 && value < 10000 && !/(?:R\s*\d|ZAR)/i.test(raw))) {
    value = roundDecimal(value / 100, 4);
  }

  if (value > 0 && value < 1000) {
    candidates.push({ raw: cleanText(raw), value, score, lineIndex, reason });
  }
}

function normalizeNumberSearchLine(line: string): string {
  return repairFuelSlipNumericOcrText(line)
    .replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0')
    .replace(/[lI](?=\d)|(?<=\d)[lI]/g, '1')
    .replace(/(\d)\s*([,.:])\s*(\d)/g, '$1$2$3')
    .replace(/\s+/g, ' ');
}

function isLikelyProductNumber(line: string, token: NumericLineToken): boolean {
  const window = line.slice(Math.max(0, token.start - 18), Math.min(line.length, token.end + 18));
  const rounded = Math.round(token.value);
  if ((rounded === 50 || rounded === 500) && /ppm\b|\bd\s*[- ]?50\b/i.test(window)) return true;
  if ((rounded === 93 || rounded === 95) && /\b(?:ulp|unleaded|petrol)\b/i.test(window)) return true;
  if (/\b(?:pump|hose|nozzle)\b/i.test(window) && token.value < 100) return true;
  return false;
}

function numericTokensFromLine(line: string, decimals = 4): NumericLineToken[] {
  const normalized = normalizeNumberSearchLine(line);
  const pattern = /(?:ZAR\s*)?R\s*(?:\d{1,3}(?: \d{3})+(?:[,.:]\d{1,4}|\s\d{2})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,4})?|\d{1,3}(?:,\d{3})+(?:\.\d{1,4})?|\d+(?:[,.:]\d{1,4}|\s\d{2})?)|\d{1,3}(?: \d{3})+(?:[,.:]\d{1,4})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,4})?|\d{1,3}(?:,\d{3})+(?:\.\d{1,4})?|\d+(?:[,.:]\d{1,4})?/gi;
  const tokens: NumericLineToken[] = [];

  for (const match of normalized.matchAll(pattern)) {
    const raw = cleanText(match[0]);
    const start = match.index ?? 0;
    const end = start + raw.length;
    if (!/\d/.test(raw)) continue;
    if (/^\d{4}$/.test(raw) && Number(raw) >= 1900 && Number(raw) <= 2100) continue;

    const value = parseDecimal(raw, decimals);
    if (value === null || value <= 0 || !Number.isFinite(value)) continue;

    const token = { raw, value, start, end };
    if (isLikelyProductNumber(normalized, token)) continue;
    tokens.push(token);
  }

  return tokens;
}

function firstFollowingNumericToken(
  lines: string[],
  lineIndex: number,
  decimals: number,
  predicate: (token: NumericLineToken, line: string) => boolean,
): { token: NumericLineToken; line: string; lineIndex: number } | null {
  for (let offset = 1; offset <= LOOKAHEAD_LABEL_LINES; offset += 1) {
    const nextLineIndex = lineIndex + offset;
    const nextLine = lines[nextLineIndex] ?? '';
    if (!nextLine) continue;
    if (TECHNICAL_CARD_AMOUNT_LINE.test(nextLine) || CARD_CONTEXT.test(nextLine) || isDateLikeLine(nextLine)) continue;

    const token = numericTokensFromLine(nextLine, decimals).find((entry) => predicate(entry, nextLine));
    if (token) return { token, line: nextLine, lineIndex: nextLineIndex };
  }

  return null;
}

function isPlausibleLitres(value: number): boolean {
  return Number.isFinite(value) && value > 0.02 && value < 100000;
}

function isPlausibleRate(value: number): boolean {
  return Number.isFinite(value) && value > 0.1 && value < 1000;
}

function isPlausibleTotal(value: number): boolean {
  return Number.isFinite(value) && value > 0.5 && value < 10000000;
}

function normalizedRateFromToken(token: NumericLineToken, line: string): number {
  let value = token.value;
  const tokenHasCurrency = /(?:R\s*\d|ZAR)/i.test(token.raw);
  if ((/\b(?:c\s*\/\s*l|cents?\s*(?:per|\/)?\s*l(?:itre)?)\b/i.test(line) && value >= 100) || (value >= 100 && value < 10000 && !tokenHasCurrency)) {
    value = value / 100;
  }
  return roundDecimal(value, 4);
}

function tokenDistanceScore(line: string, a: NumericLineToken, b: NumericLineToken, c?: NumericLineToken): number {
  const start = Math.min(a.start, b.start, c?.start ?? b.start);
  const end = Math.max(a.end, b.end, c?.end ?? b.end);
  const span = Math.max(1, end - start);
  return Math.max(0, 14 - Math.floor(span / 18)) + (FUEL_PRODUCT_LINE.test(line) ? 12 : 0) + (/@/.test(line) ? 8 : 0);
}

function collectFuelRowNumericCandidates(lines: string[]): Pick<FuelSlipCandidateSet, 'litres' | 'pricePerLitre' | 'totalAmount'> {
  const litres: Candidate<number>[] = [];
  const pricePerLitre: Candidate<number>[] = [];
  const totalAmount: Candidate<number>[] = [];

  for (const [lineIndex, originalLine] of lines.entries()) {
    const line = normalizeNumberSearchLine(originalLine);
    if (TECHNICAL_CARD_AMOUNT_LINE.test(line) || CARD_CONTEXT.test(line) || isDateLikeLine(line)) continue;

    const hasFuelContext = FUEL_PRODUCT_LINE.test(line) || /@\s*(?:ZAR\s*)?(?:R\s*)?\d/i.test(line) || /\b(?:qty|quantity|volume|litres?|ltrs?)\b/i.test(line);
    if (!hasFuelContext) continue;

    const tokens = numericTokensFromLine(line, 4);
    if (tokens.length < 2) continue;

    const atIndex = line.indexOf('@');
    if (atIndex >= 0) {
      const beforeAt = tokens.filter((token) => token.end <= atIndex + 1 && isPlausibleLitres(token.value));
      const afterAt = tokens.filter((token) => token.start >= atIndex);
      const litreToken = beforeAt.slice().reverse().find((token) => !isLikelyProductNumber(line, token));
      const rateToken = afterAt.find((token) => isPlausibleRate(normalizedRateFromToken(token, line)));
      const totalToken = afterAt.find((token) => rateToken && token.start !== rateToken.start && isPlausibleTotal(token.value) && token.value > normalizedRateFromToken(rateToken, line));

      if (litreToken) litres.push({ raw: litreToken.raw, value: roundDecimal(litreToken.value, 3), score: 132, lineIndex, reason: 'fuel-row-before-at' });
      if (rateToken) pricePerLitre.push({ raw: rateToken.raw, value: normalizedRateFromToken(rateToken, line), score: 138, lineIndex, reason: 'fuel-row-after-at' });
      if (totalToken) totalAmount.push({ raw: totalToken.raw, value: roundDecimal(totalToken.value, 2), score: 126, lineIndex, reason: 'fuel-row-after-rate-total' });
    }

    let bestLineCombo: { litreToken: NumericLineToken; rateToken: NumericLineToken; totalToken: NumericLineToken; rate: number; total: number; score: number } | null = null;

    for (const litreToken of tokens) {
      if (!isPlausibleLitres(litreToken.value)) continue;

      for (const rateToken of tokens) {
        if (rateToken.start === litreToken.start || rateToken.end === litreToken.end) continue;
        const rate = normalizedRateFromToken(rateToken, line);
        if (!isPlausibleRate(rate)) continue;

        for (const totalToken of tokens) {
          if (totalToken.start === litreToken.start || totalToken.start === rateToken.start) continue;
          const total = roundDecimal(totalToken.value, 2);
          if (!isPlausibleTotal(total)) continue;

          const expectedTotal = roundDecimal(litreToken.value * rate, 2);
          const difference = Math.abs(expectedTotal - total);
          const tolerance = Math.max(1.25, Math.abs(total) * 0.035);
          if (difference > tolerance) continue;

          const fitScore = Math.max(0, 52 - Math.round((difference / tolerance) * 22));
          const contextScore = tokenDistanceScore(line, litreToken, rateToken, totalToken);
          const score = 126 + fitScore + contextScore;
          if (!bestLineCombo || score > bestLineCombo.score) {
            bestLineCombo = { litreToken, rateToken, totalToken, rate, total, score };
          }
        }
      }
    }

    if (bestLineCombo) {
      litres.push({ raw: bestLineCombo.litreToken.raw, value: roundDecimal(bestLineCombo.litreToken.value, 3), score: bestLineCombo.score, lineIndex, reason: 'fuel-row-matched-litres' });
      pricePerLitre.push({ raw: bestLineCombo.rateToken.raw, value: bestLineCombo.rate, score: bestLineCombo.score, lineIndex, reason: 'fuel-row-matched-rate' });
      totalAmount.push({ raw: bestLineCombo.totalToken.raw, value: bestLineCombo.total, score: bestLineCombo.score, lineIndex, reason: 'fuel-row-matched-total' });
    }
  }

  return { litres, pricePerLitre, totalAmount };
}

function collectLitresCandidates(lines: string[]): Candidate<number>[] {
  const candidates: Candidate<number>[] = [];

  for (const [lineIndex, line] of lines.entries()) {
    if (TECHNICAL_CARD_AMOUNT_LINE.test(line) || CARD_CONTEXT.test(line) || isDateLikeLine(line)) continue;
    if (/\b(?:price|rate|unit\s*price|per\s*(?:litre|liter|l)|r\s*\/\s*l|c\s*\/\s*l)\b/i.test(line)) continue;

    const labelled = new RegExp(String.raw`\b(?:litres?|liters?|ltrs?|qty|quantity|volume|vol)\s*[:=]?\s*(${FUEL_SLIP_NUMBER_PATTERN})\b`, 'ig');
    for (const match of line.matchAll(labelled)) {
      addNumericCandidate(candidates, match[1], 3, 122, lineIndex, 'litres-label-before-number', 100000);
    }

    const trailing = new RegExp(String.raw`\b(${FUEL_SLIP_NUMBER_PATTERN})\s*(?:l|litres?|liters?|ltrs?)\b`, 'ig');
    for (const match of line.matchAll(trailing)) {
      addNumericCandidate(candidates, match[1], 3, 98, lineIndex, 'litres-number-before-label', 100000);
    }

    const fuelLine = new RegExp(String.raw`\b(?:diesel|unleaded|petrol|excellium|ad\s*blue|paraffin)[^\n]{0,90}?(${FUEL_SLIP_NUMBER_PATTERN})\s*(?:l|litres?|liters?|ltrs?)\b`, 'ig');
    for (const match of line.matchAll(fuelLine)) {
      addNumericCandidate(candidates, match[1], 3, 92, lineIndex, 'fuel-line-litres', 100000);
    }

    if (/\b(?:litres?|liters?|ltrs?)\b/i.test(line)) {
      const inlineToken = numericTokensFromLine(line, 3).find((token) => isPlausibleLitres(token.value));
      if (inlineToken) {
        candidates.push({
          raw: inlineToken.raw,
          value: roundDecimal(inlineToken.value, 3),
          score: 118,
          lineIndex,
          reason: 'litres-label-inline-ocr',
        });
      } else {
        const following = firstFollowingNumericToken(lines, lineIndex, 3, (token) => isPlausibleLitres(token.value));
        if (following) {
          candidates.push({
            raw: following.token.raw,
            value: roundDecimal(following.token.value, 3),
            score: 116 - Math.max(0, following.lineIndex - lineIndex - 1) * 8,
            lineIndex: following.lineIndex,
            reason: 'litres-label-next-line',
          });
        }
      }
    }
  }

  return candidates;
}

function collectPricePerLitreCandidates(lines: string[]): Candidate<number>[] {
  const candidates: Candidate<number>[] = [];
  const amountPattern = String.raw`(?:ZAR\s*)?(?:R\s*)?${FUEL_SLIP_NUMBER_PATTERN}`;

  for (const [lineIndex, line] of lines.entries()) {
    if (TECHNICAL_CARD_AMOUNT_LINE.test(line) || isDateLikeLine(line)) continue;

    const atPattern = new RegExp(String.raw`@\s*(${amountPattern})\s*(?:per\s*(?:litre|liter|l)|/\s*l|r\s*/\s*l|c\s*/\s*l)?`, 'ig');
    for (const match of line.matchAll(atPattern)) {
      addRateCandidate(candidates, match[1], line, 134, lineIndex, 'at-price-per-litre');
    }

    const labelled = new RegExp(String.raw`(?:price|rate|unit\s*price|ppu)\s*(?:per|/)?\s*(?:litre|liter|l)?\s*[:=]?\s*(${amountPattern})`, 'ig');
    for (const match of line.matchAll(labelled)) {
      addRateCandidate(candidates, match[1], line, 118, lineIndex, 'price-label');
    }

    const perLitre = new RegExp(String.raw`\b(?:per\s*(?:litre|liter|l)|/\s*l|r\s*/\s*l)\s*[:=]?\s*(${amountPattern})`, 'ig');
    for (const match of line.matchAll(perLitre)) {
      addRateCandidate(candidates, match[1], line, 106, lineIndex, 'per-litre-label');
    }

    const trailingRate = new RegExp(String.raw`\b(${amountPattern})\s*(?:/\s*l|r\s*/\s*l|c\s*/\s*l|cents?\s*(?:per|/)?\s*l)\b`, 'ig');
    for (const match of line.matchAll(trailingRate)) {
      addRateCandidate(candidates, match[1], line, 108, lineIndex, 'price-before-per-litre-label');
    }

    const nextLine = lines[lineIndex + 1] ?? '';
    const splitRateCue = /@\s*$/i.test(line) || (FUEL_PRODUCT_LINE.test(line) && /^@\s*$/i.test(nextLine));
    if (splitRateCue) {
      const following = firstFollowingNumericToken(
        lines,
        lineIndex,
        4,
        (token, candidateLine) => !/\b(?:litres?|ltrs?|total|amount|amnt|vat|trace|auth)\b/i.test(candidateLine) && isPlausibleRate(normalizedRateFromToken(token, candidateLine)),
      );
      if (following) {
        candidates.push({
          raw: following.token.raw,
          value: normalizedRateFromToken(following.token, following.line),
          score: 116 - Math.max(0, following.lineIndex - lineIndex - 1) * 6,
          lineIndex: following.lineIndex,
          reason: 'split-at-price-per-litre',
        });
      }
    }
  }

  return candidates;
}

function hasCurrencyMarker(line: string): boolean {
  return /(?:\bZAR\b|\bR\s*\d)/i.test(line);
}

function moneyValuesFromLine(line: string, allowUnmarkedAmount: boolean): Array<{ raw: string; value: number }> {
  if (TECHNICAL_NUMBER_LINE.test(line) && !hasCurrencyMarker(line)) return [];

  return numericTokensFromLine(line, 2)
    .filter((token) => allowUnmarkedAmount || /(?:ZAR|R\s*\d)/i.test(token.raw))
    .map((token) => ({ raw: cleanText(token.raw), value: token.value }))
    .filter((entry): entry is { raw: string; value: number } => entry.value !== null && entry.value > 0 && entry.value < 10000000);
}

function collectTotalCandidates(lines: string[]): Candidate<number>[] {
  const amountLinePattern = /\b(?:grand\s+total|total\s+amount|amount\s+due|total\s+due|amount\s+paid|paid|card\s+tender|bank\s*card|amnt|amount|purchase|sale|total|tendered)\b/i;
  const excludedTotalLine = /@|\b(?:subtotal|sub\s+total|vat\s*(?:no|number|reg)|change|balance|litres?|ltrs?|price\s*per|per\s*litre|rate\s*\/\s*l|pump|uti|aid|rrn|tsn|trace|tvr|terminal|merchant)\b/i;
  const candidates: Candidate<number>[] = [];

  for (const [lineIndex, line] of lines.entries()) {
    if (!amountLinePattern.test(line) || excludedTotalLine.test(line)) continue;

    let score = 96;
    if (/\b(?:grand\s+total|total\s+amount|amount\s+due|total\s+due|total|amnt)\b/i.test(line)) score += 27;
    if (/\b(?:purchase|sale|card\s+tender|amount\s+paid|paid|tendered)\b/i.test(line)) score += 12;
    if (hasCurrencyMarker(line)) score += 8;

    const moneyEntries = moneyValuesFromLine(line, true);
    for (const entry of moneyEntries) {
      candidates.push({ raw: entry.raw, value: entry.value, score, lineIndex, reason: 'labelled-total' });
    }

    if (!moneyEntries.length) {
      const following = firstFollowingNumericToken(
        lines,
        lineIndex,
        2,
        (token, candidateLine) => !/@|\b(?:litres?|ltrs?|price\s*per|per\s*litre|rate\s*\/\s*l|vat\s*(?:no|number|reg)|uti|aid|rrn|tsn|trace|tvr|terminal|merchant)\b/i.test(candidateLine)
          && isPlausibleTotal(token.value),
      );
      if (following) {
        candidates.push({
          raw: following.token.raw,
          value: roundDecimal(following.token.value, 2),
          score: score - Math.max(0, following.lineIndex - lineIndex - 1) * 8,
          lineIndex: following.lineIndex,
          reason: 'total-label-next-line',
        });
      }
    }
  }

  for (const [lineIndex, line] of lines.entries()) {
    if (/@|\b(?:litres?|ltrs?|price\s*per|per\s*litre|rate\s*\/\s*l|vat\s*(?:no|number|reg)|uti|aid|rrn|tsn|trace|tvr|terminal|merchant)\b/i.test(line)) continue;

    for (const entry of moneyValuesFromLine(line, false)) {
      candidates.push({ raw: entry.raw, value: entry.value, score: 46 + (hasCurrencyMarker(line) ? 10 : 0), lineIndex, reason: 'fallback-currency' });
    }
  }

  return candidates;
}

function collectCardCandidates(lines: string[]): Candidate<{ masked: string; last4: string }>[] {
  const candidates: Candidate<{ masked: string; last4: string }>[] = [];

  for (const [lineIndex, line] of lines.entries()) {
    const hasContext = CARD_CONTEXT.test(line);
    if (isDateLikeLine(line) && !hasContext) continue;

    const last4 = extractLast4FromCardLikeValue(line, { requireContext: false });
    if (!last4) continue;

    const hasMask = hasCardMask(line);
    const hasAnyMask = new RegExp(CARD_MASK_CLASS).test(line);
    if (isTechnicalOnlyNumberLine(line)) continue;

    const previousLine = lines[lineIndex - 1] ?? '';
    const nextLine = lines[lineIndex + 1] ?? '';
    const nearbyContext = CARD_CONTEXT.test(lines[lineIndex - 1] ?? '')
      || CARD_CONTEXT.test(lines[lineIndex + 1] ?? '')
      || /\bsingle\s+product\b/i.test(previousLine)
      || /\bsingle\s+product\b/i.test(nextLine);
    const technicalNearby = CARD_EXCLUDED_CONTEXT.test(line) || CARD_EXCLUDED_CONTEXT.test(previousLine) || CARD_EXCLUDED_CONTEXT.test(nextLine);
    const compactDigits = line.replace(/\D/g, '');
    const loosePanLine = compactDigits.length >= 13
      && compactDigits.length <= 19
      && !TECHNICAL_NUMBER_LINE.test(line)
      && !isDateLikeLine(line)
      && !FUEL_PRODUCT_LINE.test(line)
      && !/\b(?:total|amount|amnt|litres?|ltrs?|price|rate|trace|auth|terminal|merchant|uti|rrn|tsn|vat|reg\s*no)\b/i.test(line);
    if (!hasMask && !hasAnyMask && !hasContext && !nearbyContext && !loosePanLine) continue;
    if (technicalNearby && !hasContext && !nearbyContext && !loosePanLine) continue;

    candidates.push({
      raw: line,
      value: { masked: safeCardMask(last4), last4 },
      score: (hasMask ? 124 : hasAnyMask ? 116 : loosePanLine ? 108 : 92)
        + (hasContext ? 12 : 0)
        + (nearbyContext ? 8 : 0)
        - (technicalNearby && !hasContext ? 35 : 0),
      lineIndex,
      reason: hasMask || hasAnyMask ? 'masked-card' : loosePanLine ? 'card-pan-line' : 'card-context',
    });
  }

  return candidates;
}

function collectFuelSlipCandidates(text: string, lines: string[]): FuelSlipCandidateSet {
  const fuelRow = collectFuelRowNumericCandidates(lines);

  return {
    supplier: collectSupplierCandidates(lines),
    documentDate: collectDateCandidates(text),
    fuelType: collectFuelTypeCandidates(lines),
    litres: [...fuelRow.litres, ...collectLitresCandidates(lines)],
    pricePerLitre: [...fuelRow.pricePerLitre, ...collectPricePerLitreCandidates(lines)],
    totalAmount: [...fuelRow.totalAmount, ...collectTotalCandidates(lines)],
    card: collectCardCandidates(lines),
  };
}

function hasExplicitDecimalMarker(raw: string): boolean {
  return /[,.:]|\d\s+\d{1,4}\b/.test(raw);
}

function decimalRestoredLitresCandidates(candidates: Candidate<number>[]): Candidate<number>[] {
  const restored: Candidate<number>[] = [];

  for (const candidate of candidates) {
    const digitText = cleanText(candidate.raw).replace(/\D/g, '');
    if (hasExplicitDecimalMarker(candidate.raw) || !/^\d{3,6}$/.test(digitText)) continue;
    if (candidate.value < 100 || candidate.value >= 100000) continue;

    const decimalPlaces = digitText.length <= 4 ? [2, 1, 3] : [2, 3, 1];
    for (const places of decimalPlaces) {
      if (digitText.length <= places) continue;
      const value = roundDecimal(Number(digitText) / (10 ** places), 3);
      if (!isPlausibleLitres(value) || value === candidate.value) continue;
      restored.push({
        raw: candidate.raw,
        value,
        score: candidate.score - (places === 2 ? 2 : 10),
        lineIndex: candidate.lineIndex,
        reason: `${candidate.reason}-decimal-restored-${places}`,
      });
    }
  }

  return restored;
}

function uniqueNumberCandidates(candidates: Candidate<number>[], decimals: number, limit = 12): Candidate<number>[] {
  const seen = new Set<string>();
  const unique: Candidate<number>[] = [];

  for (const candidate of candidates.slice().sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex)) {
    const key = roundDecimal(candidate.value, decimals).toFixed(decimals);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
    if (unique.length >= limit) break;
  }

  return unique;
}

function selectBestNumericCandidates(candidates: FuelSlipCandidateSet): NumericSelection {
  const litres = uniqueNumberCandidates([...candidates.litres, ...decimalRestoredLitresCandidates(candidates.litres)], 3);
  const rates = uniqueNumberCandidates(candidates.pricePerLitre, 4);
  const totals = uniqueNumberCandidates(candidates.totalAmount, 2);

  let bestMatched: { litres: Candidate<number>; pricePerLitre: Candidate<number>; totalAmount: Candidate<number>; score: number } | null = null;

  for (const litre of litres) {
    if (!isPlausibleLitres(litre.value)) continue;

    for (const rate of rates) {
      if (!isPlausibleRate(rate.value)) continue;

      for (const total of totals) {
        if (!isPlausibleTotal(total.value)) continue;

        const expectedTotal = roundDecimal(litre.value * rate.value, 2);
        const difference = Math.abs(expectedTotal - total.value);
        const tolerance = Math.max(1.25, Math.abs(total.value) * 0.035);
        if (difference > tolerance) continue;

        const sameLineBonus = litre.lineIndex === rate.lineIndex && rate.lineIndex === total.lineIndex ? 35 : 0;
        const fitBonus = Math.max(0, 70 - Math.round((difference / tolerance) * 35));
        const score = litre.score + rate.score + total.score + sameLineBonus + fitBonus;
        if (!bestMatched || score > bestMatched.score) {
          bestMatched = { litres: litre, pricePerLitre: rate, totalAmount: total, score };
        }
      }
    }
  }

  if (bestMatched) {
    return {
      litres: bestMatched.litres,
      pricePerLitre: bestMatched.pricePerLitre,
      totalAmount: bestMatched.totalAmount,
      reason: 'matched-litres-rate-total',
    };
  }

  return {
    litres: bestCandidate(candidates.litres),
    pricePerLitre: bestCandidate(candidates.pricePerLitre),
    totalAmount: bestCandidate(candidates.totalAmount),
    reason: 'best-individual-candidates',
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
  if (/\bcard\s+tender|\bcard\b|\bcredit\b|\bdebit\b|\bvisa\b|\bmaster\s*card|\bmastercard\b|\bkaart\b|\beft\b/i.test(text)) return 'card';
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

function formatDebugValue(value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return cleanText(value);
}

function candidateDebugLine<T>(candidate: Candidate<T> | null, formatter: (value: T) => string): string {
  if (!candidate) return 'not found';
  const raw = maskFuelSlipSensitiveText(cleanText(candidate.raw));
  return `${formatter(candidate.value)} | ${candidate.reason}, line ${candidate.lineIndex + 1}, score ${Math.round(candidate.score)} | ${raw}`;
}

function topCandidateDebug<T>(label: string, candidates: Candidate<T>[], formatter: (value: T) => string, limit = 4): string[] {
  const lines = [`${label}:`];
  const top = candidates.slice().sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex).slice(0, limit);
  if (!top.length) return [...lines, '  - none'];

  for (const candidate of top) {
    lines.push(`  - ${candidateDebugLine(candidate, formatter)}`);
  }

  return lines;
}

function buildExtractionDebugPreview(sourceText: string, draft: FuelSlipExtractionDraft, warnings: string[], candidates: FuelSlipCandidateSet, numericSelection: NumericSelection): string {
  const cardCandidate = bestCandidate(candidates.card);
  const supplierCandidate = bestCandidate(candidates.supplier);
  const dateCandidate = bestCandidate(candidates.documentDate);
  const fuelTypeCandidate = bestCandidate(candidates.fuelType);

  const lines = [
    'Aim4price fuel slip extraction debug',
    '',
    'Selected fields:',
    `Supplier: ${formatDebugValue(draft.supplierName) || 'not found'}`,
    `Date: ${formatDebugValue(draft.documentDate) || 'not found'}`,
    `Fuel type: ${formatDebugValue(draft.fuelType) || 'not found'}`,
    `Litres: ${formatDebugValue(draft.litres) || 'not found'}`,
    `Price per litre: ${formatDebugValue(draft.pricePerLitre) || 'not found'}`,
    `Total amount: ${formatDebugValue(draft.totalAmount) || 'not found'}`,
    `Card last 4: ${formatDebugValue(draft.cardLast4) || 'not found'}`,
    `Numeric selection: ${numericSelection.reason}`,
    '',
    'Selected candidate evidence:',
    `Supplier: ${candidateDebugLine(supplierCandidate, (value) => value)}`,
    `Date: ${candidateDebugLine(dateCandidate, (value) => value)}`,
    `Fuel type: ${candidateDebugLine(fuelTypeCandidate, (value) => value)}`,
    `Litres: ${candidateDebugLine(numericSelection.litres, (value) => String(value))}`,
    `Price per litre: ${candidateDebugLine(numericSelection.pricePerLitre, (value) => String(value))}`,
    `Total amount: ${candidateDebugLine(numericSelection.totalAmount, (value) => String(value))}`,
    `Card: ${candidateDebugLine(cardCandidate, (value) => value.last4 ? `ending ${value.last4}` : 'not found')}`,
    '',
    'Top alternate candidates:',
    ...topCandidateDebug('Litres', candidates.litres, (value) => String(value)),
    ...topCandidateDebug('Price per litre', candidates.pricePerLitre, (value) => String(value)),
    ...topCandidateDebug('Total amount', candidates.totalAmount, (value) => String(value)),
    ...topCandidateDebug('Dates', candidates.documentDate, (value) => value, 3),
    ...topCandidateDebug('Cards', candidates.card, (value) => value.last4 ? `ending ${value.last4}` : 'not found', 3),
    '',
    warnings.length ? `Warnings: ${warnings.join(' | ')}` : 'Warnings: none',
    '',
    'Raw OCR / PDF text:',
    sourceText,
  ];

  return maskFuelSlipSensitiveText(lines.join('\n')).slice(0, MAX_EXTRACTED_TEXT_LENGTH);
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
  const numericSelection = selectBestNumericCandidates(candidates);

  draft.supplierName = maskFuelSlipSensitiveText(bestCandidate(candidates.supplier)?.value ?? extractSupplier(lines));
  draft.supplierVatNumber = extractVatNumber(text);
  draft.slipNumber = maskFuelSlipSensitiveText(extractSlipNumber(text));
  draft.transactionNumber = maskFuelSlipSensitiveText(extractTransactionNumber(text));
  draft.documentDate = bestCandidate(candidates.documentDate)?.value ?? extractDate(text);
  draft.documentTime = '';
  draft.fuelType = bestCandidate(candidates.fuelType)?.value ?? extractFuelType(lines);
  draft.litres = numericSelection.litres?.value ?? null;
  draft.pricePerLitre = numericSelection.pricePerLitre?.value ?? null;
  draft.totalAmount = numericSelection.totalAmount?.value ?? null;

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
  if (!draft.cardLast4 && /\bcard|visa|master|credit|debit|kaart|eft/i.test(text)) warnings.push('Card payment was detected, but the last 4 card digits could not be read confidently.');

  const confidence = confidenceForDraft(draft);
  const completeFuelDetails = Boolean(draft.documentDate && draft.fuelType && draft.litres !== null && draft.litres > 0 && draft.totalAmount !== null);
  if (!completeFuelDetails && (draft.litres === null || !draft.fuelType) && (draft.totalAmount !== null || draft.cardLast4 || draft.supplierName || draft.documentDate)) {
    warnings.push('Fuel slip saved for review. Litres or fuel type missing.');
  }

  const uniqueWarnings = [...new Set(warnings.map((warning) => cleanText(warning)).filter(Boolean))];
  draft.ocrConfidence = confidence;
  draft.reviewRequired = !completeFuelDetails || confidence < 0.72 || uniqueWarnings.length > 0;
  draft.extractionStatus = draft.reviewRequired ? 'needs_review' : 'extracted';

  return {
    draft,
    rawText: buildExtractionDebugPreview(text, draft, uniqueWarnings, candidates, numericSelection),
    warnings: uniqueWarnings.slice(0, 12),
    quality: completeFuelDetails && confidence >= 0.72 ? 'good' : 'weak',
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
