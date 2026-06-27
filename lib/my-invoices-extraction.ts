import { inflateSync } from 'node:zlib';

export type InvoiceExtractionQuality = 'none' | 'weak' | 'good';
export type InvoiceExtractionUsageMetric = 'none' | 'hours' | 'km';

export type InvoiceExtractionDraft = {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  subtotalExVat: number | null;
  vatAmount: number | null;
  totalIncVat: number | null;
  usageReading: number | null;
  usageMetric: InvoiceExtractionUsageMetric;
  maintenanceWorkDone: string;
  partsSupplied: string;
  repairWorkDone: string;
  notes: string;
};

export type InvoiceExtractionResult = {
  draft: InvoiceExtractionDraft;
  rawText: string;
  warnings: string[];
  quality: InvoiceExtractionQuality;
};

type TextClassification = {
  maintenanceWorkDone: string;
  partsSupplied: string;
  repairWorkDone: string;
  notes: string;
};

type PdfToken =
  | { type: 'string'; value: string }
  | { type: 'word'; value: string }
  | { type: 'openArray'; value: '[' }
  | { type: 'closeArray'; value: ']' };

type MoneyCandidate = {
  raw: string;
  value: number;
};

type UsageExtraction = {
  usageMetric: InvoiceExtractionUsageMetric;
  usageReading: number | null;
};

const EMPTY_DRAFT: InvoiceExtractionDraft = {
  supplierName: '',
  invoiceNumber: '',
  invoiceDate: '',
  subtotalExVat: null,
  vatAmount: null,
  totalIncVat: null,
  usageReading: null,
  usageMetric: 'none',
  maintenanceWorkDone: '',
  partsSupplied: '',
  repairWorkDone: '',
  notes: '',
};

const MAINTENANCE_KEYWORDS = [
  'service',
  'maintenance',
  'inspection',
  'oil change',
  'filter change',
  'grease',
  'greasing',
  'lubrication',
  'diagnostic',
  'diagnostics',
  'coolant',
  'check',
  'scheduled service',
  'minor service',
  'major service',
];

const PARTS_KEYWORDS = [
  'filter',
  'oil',
  'belt',
  'hose',
  'bearing',
  'seal',
  'blade',
  'tyre',
  'tire',
  'track',
  'pump',
  'injector',
  'starter',
  'alternator',
  'battery',
  'kit',
  'spare',
  'part',
  'hydraulic oil',
  'engine oil',
  'fuel filter',
  'air filter',
  'oil filter',
  'bearing kit',
  'blade set',
];

const REPAIR_KEYWORDS = [
  'repair',
  'replace',
  'replaced',
  'fixed',
  'fix',
  'weld',
  'welding',
  'rebuild',
  'leak',
  'broken',
  'damage',
  'damaged',
  'labour',
  'labor',
  'remove and fit',
  'fitment',
  'installed',
  'installation',
];

const BUSINESS_NAME_KEYWORDS = [
  'pty',
  'ltd',
  'limited',
  'cc',
  'services',
  'service',
  'repairs',
  'repair',
  'tractors',
  'tractor',
  'agri',
  'mechanical',
  'parts',
  'workshop',
  'diesel',
  'engineering',
  'motors',
  'farm',
];

const PDF_INTERNAL_LINE_PATTERNS = [
  /^%?PDF-\d/i,
  /^%%EOF$/i,
  /^\d+\s+\d+\s+obj\b/i,
  /^endobj$/i,
  /^xref$/i,
  /^trailer$/i,
  /^startxref$/i,
  /^stream$/i,
  /^endstream$/i,
  /^\d{6,}\s+\d{5}\s+[fn]\b/i,
  /^\/\s*(?:Author|Creator|Producer|Keywords|Subject|Title|CreationDate|ModDate|Type|Catalog|Page|Pages|Outlines|Font|XObject|ProcSet|Resources|MediaBox|Parent|Contents|Annots|Root|Info|Size|ID|Length|Filter|DecodeParms|Subtype)\b/i,
  /\bReportLab\s+Generated\s+PDF\s+document\b/i,
  /\b(?:Creator|Producer|Author|Keywords)\s*\([^)]*\)/i,
  /\b(?:FlateDecode|ASCII85Decode|ASCIIHexDecode|DCTDecode|JPXDecode)\b/i,
];

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    const key = normalized.toLowerCase();

    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function normalizeText(value: string): string {
  return String(value ?? '')
    .replace(/\u0000/g, ' ')
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function collapseText(value: string): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f' || char === '\u0000';
}

function stripPdfStringEscapes(value: string): string {
  let output = '';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char !== '\\') {
      output += char;
      continue;
    }

    const next = value[index + 1];
    if (typeof next === 'undefined') break;

    if (next === 'n') output += '\n';
    else if (next === 'r') output += '\n';
    else if (next === 't') output += '\t';
    else if (next === 'b') output += '\b';
    else if (next === 'f') output += '\f';
    else if (next === '(' || next === ')' || next === '\\') output += next;
    else if (next === '\r' || next === '\n') {
      if (next === '\r' && value[index + 2] === '\n') index += 1;
    } else if (/^[0-7]$/.test(next)) {
      const octal = value.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] ?? next;
      output += String.fromCharCode(parseInt(octal, 8));
      index += octal.length - 1;
    } else {
      output += next;
    }

    index += 1;
  }

  return output;
}

function decodeUtf16Be(bytes: number[], offset = 0): string {
  let output = '';

  for (let index = offset; index + 1 < bytes.length; index += 2) {
    const codePoint = (bytes[index] << 8) | bytes[index + 1];
    if (codePoint) output += String.fromCharCode(codePoint);
  }

  return output;
}

function decodeHexPdfString(value: string): string {
  let hex = value.replace(/[^0-9a-f]/gi, '');
  if (hex.length < 2) return '';
  if (hex.length % 2 === 1) hex += '0';

  const bytes: number[] = [];
  for (let index = 0; index < hex.length; index += 2) {
    bytes.push(parseInt(hex.slice(index, index + 2), 16));
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeUtf16Be(bytes, 2);
  }

  const evenNulls = bytes.filter((byte, index) => index % 2 === 0 && byte === 0).length;
  if (bytes.length >= 4 && evenNulls >= Math.floor(bytes.length / 4)) {
    return decodeUtf16Be(bytes);
  }

  return Buffer.from(bytes).toString('latin1').replace(/\u0000/g, '');
}

function cleanExtractedFragment(value: string): string {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .trim();
}

function extractLiteralPdfStrings(value: string): string[] {
  const strings: string[] = [];
  const literalPattern = /\((?:\\.|[^\\)]){2,}\)/g;
  const hexPattern = /<([0-9a-fA-F\s]{6,})>/g;
  let match: RegExpExecArray | null;

  while ((match = literalPattern.exec(value))) {
    const raw = match[0].slice(1, -1);
    const decoded = cleanExtractedFragment(stripPdfStringEscapes(raw));
    if (decoded && /[A-Za-z0-9]/.test(decoded)) {
      strings.push(decoded);
    }
  }

  while ((match = hexPattern.exec(value))) {
    const decoded = cleanExtractedFragment(decodeHexPdfString(match[1] ?? ''));
    if (decoded && /[A-Za-z0-9]/.test(decoded)) {
      strings.push(decoded);
    }
  }

  return strings;
}

function isPdfDelimiter(char: string): boolean {
  return char === '(' || char === ')' || char === '<' || char === '>' || char === '[' || char === ']' || char === '/' || char === '%';
}

function readLiteralString(input: string, startIndex: number): { value: string; nextIndex: number } {
  let raw = '';
  let depth = 1;
  let index = startIndex + 1;

  while (index < input.length) {
    const char = input[index];

    if (char === '\\') {
      raw += char;
      const next = input[index + 1];
      if (typeof next !== 'undefined') {
        raw += next;
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }

    if (char === '(') {
      depth += 1;
      raw += char;
      index += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      if (depth <= 0) {
        index += 1;
        break;
      }
      raw += char;
      index += 1;
      continue;
    }

    raw += char;
    index += 1;
  }

  return { value: cleanExtractedFragment(stripPdfStringEscapes(raw)), nextIndex: index };
}

function readHexString(input: string, startIndex: number): { value: string; nextIndex: number } | null {
  if (input[startIndex + 1] === '<') return null;

  const endIndex = input.indexOf('>', startIndex + 1);
  if (endIndex === -1) return null;

  return {
    value: cleanExtractedFragment(decodeHexPdfString(input.slice(startIndex + 1, endIndex))),
    nextIndex: endIndex + 1,
  };
}

function tokenizePdfContent(input: string): PdfToken[] {
  const tokens: PdfToken[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (isWhitespace(char)) {
      index += 1;
      continue;
    }

    if (char === '%') {
      while (index < input.length && input[index] !== '\n' && input[index] !== '\r') index += 1;
      continue;
    }

    if (char === '(') {
      const literal = readLiteralString(input, index);
      if (literal.value && /[A-Za-z0-9]/.test(literal.value)) tokens.push({ type: 'string', value: literal.value });
      index = literal.nextIndex;
      continue;
    }

    if (char === '<') {
      const hex = readHexString(input, index);
      if (hex) {
        if (hex.value && /[A-Za-z0-9]/.test(hex.value)) tokens.push({ type: 'string', value: hex.value });
        index = hex.nextIndex;
        continue;
      }
    }

    if (char === '[') {
      tokens.push({ type: 'openArray', value: '[' });
      index += 1;
      continue;
    }

    if (char === ']') {
      tokens.push({ type: 'closeArray', value: ']' });
      index += 1;
      continue;
    }

    let endIndex = index;
    while (endIndex < input.length && !isWhitespace(input[endIndex]) && !isPdfDelimiter(input[endIndex])) {
      endIndex += 1;
    }

    if (endIndex === index && char === '/') {
      endIndex += 1;
      while (endIndex < input.length && !isWhitespace(input[endIndex]) && !isPdfDelimiter(input[endIndex])) {
        endIndex += 1;
      }
    }

    if (endIndex === index) {
      index += 1;
      continue;
    }

    tokens.push({ type: 'word', value: input.slice(index, endIndex) });
    index = endIndex;
  }

  return tokens;
}

function tokenText(token: PdfToken | undefined): string {
  return token?.type === 'string' ? token.value : '';
}

function shouldInsertSpace(left: string, right: string): boolean {
  if (!left || !right) return false;
  const leftChar = left[left.length - 1];
  const rightChar = right[0];

  if (/\s/.test(leftChar) || /\s/.test(rightChar)) return false;
  if (/[-–—\/]/.test(leftChar)) return false;
  if (/^[,.;:!?%)\]]$/.test(rightChar)) return false;
  if (/^[(\[]$/.test(rightChar)) return true;
  if (/[a-z]$/.test(leftChar) && /^[a-z]/.test(rightChar)) return false;

  return /[A-Za-z0-9)]$/.test(leftChar) && /^[A-Za-z0-9(]/.test(rightChar);
}

function collectTextFromArray(tokens: PdfToken[], closeIndex: number): string {
  const fragments: string[] = [];
  let depth = 0;

  for (let index = closeIndex; index >= 0; index -= 1) {
    const token = tokens[index];
    if (!token) continue;

    if (token.type === 'closeArray') {
      depth += 1;
      continue;
    }

    if (token.type === 'openArray') {
      depth -= 1;
      if (depth <= 0) break;
      continue;
    }

    if (depth === 1 && token.type === 'string') {
      fragments.unshift(token.value);
    }
  }

  return cleanExtractedFragment(fragments.join(''));
}

function parsePdfTextContent(streamText: string): string[] {
  const tokens = tokenizePdfContent(streamText);
  const lines: string[] = [];
  let currentLine = '';

  const flushLine = () => {
    const normalized = cleanExtractedFragment(currentLine);
    if (normalized) lines.push(normalized);
    currentLine = '';
  };

  const appendText = (value: string) => {
    const normalized = cleanExtractedFragment(value);
    if (!normalized) return;
    currentLine += shouldInsertSpace(currentLine, normalized) ? ` ${normalized}` : normalized;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'word') continue;

    if (token.value === 'Tj') {
      appendText(tokenText(tokens[index - 1]));
      continue;
    }

    if (token.value === 'TJ') {
      appendText(collectTextFromArray(tokens, index - 1));
      continue;
    }

    if (token.value === "'") {
      flushLine();
      appendText(tokenText(tokens[index - 1]));
      continue;
    }

    if (token.value === '"') {
      flushLine();
      appendText(tokenText(tokens[index - 1]));
      continue;
    }

    if (token.value === 'Td' || token.value === 'TD' || token.value === 'Tm' || token.value === 'T*' || token.value === 'ET') {
      flushLine();
    }
  }

  flushLine();
  return lines;
}

function isPdfInternalLine(line: string): boolean {
  const normalized = collapseText(line);
  if (!normalized) return true;

  if (PDF_INTERNAL_LINE_PATTERNS.some((pattern) => pattern.test(normalized))) return true;

  const slashNameCount = normalized.match(/\/[A-Za-z][A-Za-z0-9]*/g)?.length ?? 0;
  if (slashNameCount >= 3 && !/(invoice|vat|total|amount|supplier|service|repair|filter|part)/i.test(normalized)) {
    return true;
  }

  const symbolCount = normalized.replace(/[A-Za-z0-9\s.,:;#/@()&+\-'%]/g, '').length;
  return symbolCount > Math.max(6, normalized.length / 5);
}

function sanitizeExtractedText(value: string, maxLines = 400): string {
  const lines = normalizeText(value)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !isPdfInternalLine(line));

  return normalizeText(uniqueStrings(lines).slice(0, maxLines).join('\n'));
}

function looksLikePdfTextStream(value: string): boolean {
  return /\b(?:TJ|Tj|BT|ET|Tf|Td|TD|Tm)\b/.test(value) || /(?:^|\s)(?:'|")(?:\s|$)/.test(value);
}

function normalizePdfFilterName(value: string): string {
  const normalized = value.replace(/^\//, '').trim().toLowerCase();
  if (normalized === 'fl' || normalized === 'flatedecode') return 'FlateDecode';
  if (normalized === 'a85' || normalized === 'ascii85decode') return 'ASCII85Decode';
  if (normalized === 'ahx' || normalized === 'asciihexdecode') return 'ASCIIHexDecode';
  return value.replace(/^\//, '').trim();
}

function extractPdfFilters(dictionary: string): string[] {
  const arrayMatch = dictionary.match(/\/Filter\s*\[([\s\S]*?)\]/i);
  if (arrayMatch?.[1]) {
    return (arrayMatch[1].match(/\/[A-Za-z0-9]+/g) ?? []).map(normalizePdfFilterName).filter(Boolean);
  }

  const singleMatch = dictionary.match(/\/Filter\s*\/([A-Za-z0-9]+)/i);
  return singleMatch?.[1] ? [normalizePdfFilterName(singleMatch[1])] : [];
}

function decodeAscii85(buffer: Buffer): Buffer {
  let text = buffer.toString('latin1');
  const start = text.indexOf('<~');
  if (start >= 0) text = text.slice(start + 2);
  const end = text.indexOf('~>');
  if (end >= 0) text = text.slice(0, end);

  const output: number[] = [];
  let tuple = 0;
  let count = 0;

  const pushTuple = (byteCount = 4) => {
    output.push((tuple >>> 24) & 0xff);
    if (byteCount > 1) output.push((tuple >>> 16) & 0xff);
    if (byteCount > 2) output.push((tuple >>> 8) & 0xff);
    if (byteCount > 3) output.push(tuple & 0xff);
    tuple = 0;
    count = 0;
  };

  for (const char of text) {
    if (/\s/.test(char)) continue;
    if (char === '~') break;

    if (char === 'z' && count === 0) {
      output.push(0, 0, 0, 0);
      continue;
    }

    const code = char.charCodeAt(0);
    if (code < 33 || code > 117) continue;

    tuple = tuple * 85 + (code - 33);
    count += 1;

    if (count === 5) pushTuple();
  }

  if (count > 0) {
    const originalCount = count;
    while (count < 5) {
      tuple = tuple * 85 + 84;
      count += 1;
    }
    pushTuple(originalCount - 1);
  }

  return Buffer.from(output);
}

function decodeAsciiHex(buffer: Buffer): Buffer {
  let hex = '';

  for (const char of buffer.toString('latin1')) {
    if (char === '>') break;
    if (/[0-9a-f]/i.test(char)) hex += char;
  }

  if (hex.length % 2 === 1) hex += '0';
  return Buffer.from(hex, 'hex');
}

function decodePdfStream(buffer: Buffer, dictionary: string): Buffer | null {
  let decoded = buffer;
  const filters = extractPdfFilters(dictionary);

  try {
    for (const filter of filters) {
      if (filter === 'ASCII85Decode') {
        decoded = decodeAscii85(decoded);
      } else if (filter === 'ASCIIHexDecode') {
        decoded = decodeAsciiHex(decoded);
      } else if (filter === 'FlateDecode') {
        decoded = inflateSync(decoded);
      } else {
        return null;
      }
    }

    return decoded;
  } catch {
    return null;
  }
}

function trimPdfStreamBoundaries(streamBody: string): Buffer {
  let body = streamBody;

  if (body.startsWith('\r\n')) body = body.slice(2);
  else if (body.startsWith('\n') || body.startsWith('\r')) body = body.slice(1);

  if (body.endsWith('\r\n')) body = body.slice(0, -2);
  else if (body.endsWith('\n') || body.endsWith('\r')) body = body.slice(0, -1);

  return Buffer.from(body, 'latin1');
}

function extractPdfStreamText(buffer: Buffer): string {
  const binary = buffer.toString('latin1');
  const streamPattern = /<<(.*?)>>\s*stream([\s\S]*?)endstream/g;
  const fragments: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = streamPattern.exec(binary))) {
    const dictionary = match[1] ?? '';
    const streamBody = match[2] ?? '';
    const decodedBuffer = decodePdfStream(trimPdfStreamBoundaries(streamBody), dictionary);
    if (!decodedBuffer) continue;

    const streamText = decodedBuffer.toString('latin1');
    if (looksLikePdfTextStream(streamText)) {
      const lines = parsePdfTextContent(streamText);
      fragments.push(...lines);
      continue;
    }

    fragments.push(...extractLiteralPdfStrings(streamText));
  }

  return sanitizeExtractedText(fragments.join('\n'));
}

function hasInvoiceSignals(value: string): boolean {
  const text = collapseText(value).toLowerCase();
  if (!text) return false;

  const hasInvoiceLabel = /\b(?:tax\s+invoice|invoice|inv\s*(?:no|#|number)|document\s*(?:no|number)|doc\s*(?:no|number))\b/i.test(text);
  const hasAmountLabel = /\b(?:grand\s+total|amount\s+due|amount\s+payable|balance\s+due|total\s+due|subtotal|sub\s+total|vat\s*(?:@|amount)|output\s+vat|tax\s+amount)\b/i.test(text);
  const hasMoney = /(?:\bZAR\s*\d|\bR\s*\d|\d[\d\s,.]*(?:[.,]\d{2}))/.test(text);

  return (hasInvoiceLabel && (hasAmountLabel || hasMoney)) || (hasAmountLabel && hasMoney);
}

function extractPrintablePdfFallback(buffer: Buffer): string {
  const printable = buffer
    .toString('latin1')
    .replace(/[^\x09\x0a\x0d\x20-\x7e]+/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 4 && /[A-Za-z]/.test(line));

  const sanitized = sanitizeExtractedText(uniqueStrings(printable).slice(0, 300).join('\n'));
  return hasInvoiceSignals(sanitized) ? sanitized : '';
}

function extractDigitalPdfText(buffer: Buffer): string {
  const streamText = extractPdfStreamText(buffer);
  if (collapseText(streamText).length >= 30) {
    return streamText;
  }

  return extractPrintablePdfFallback(buffer);
}

function parseMoney(value: string): number | null {
  let text = String(value ?? '')
    .replace(/zar/gi, '')
    .replace(/rand/gi, '')
    .replace(/\br\b/gi, '')
    .replace(/^r/gi, '')
    .replace(/\u00a0/g, ' ')
    .trim();

  if (!text) return null;

  text = text.replace(/[^0-9, .-]/g, '').replace(/\s+/g, '');
  if (!/[0-9]/.test(text)) return null;

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');

  if (hasComma && hasDot) {
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');

    if (lastComma > lastDot) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    const commaParts = text.split(',');
    const last = commaParts[commaParts.length - 1] ?? '';

    if (last.length === 2) {
      text = commaParts.slice(0, -1).join('').replace(/,/g, '') + `.${last}`;
    } else {
      text = text.replace(/,/g, '');
    }
  } else {
    const parts = text.split('.');
    if (parts.length > 2) {
      const last = parts.pop() ?? '';
      text = `${parts.join('')}.${last}`;
    }
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed * 100) / 100;
}

function moneyPatternSource(): string {
  return '(?:ZAR\\s*)?(?:R\\s*)?-?\\d(?:[\\d\\s,.]*\\d)?(?:[.,]\\d{2})?';
}

function findMoneyCandidates(line: string): MoneyCandidate[] {
  const pattern = new RegExp(moneyPatternSource(), 'gi');
  const candidates: MoneyCandidate[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line))) {
    const raw = match[0];
    const value = parseMoney(raw);
    if (value !== null) {
      candidates.push({ raw, value });
    }
  }

  return candidates;
}

function candidateLooksLikeAmount(candidate: MoneyCandidate): boolean {
  if (/[Rr]|ZAR/i.test(candidate.raw)) return true;
  if (/[,.]\d{2}\b/.test(candidate.raw)) return true;
  return Math.abs(candidate.value) >= 100;
}

function bestMoneyOnLine(line: string): number | null {
  const lineText = line.toLowerCase();
  const values = findMoneyCandidates(line)
    .filter((candidate) => Number.isFinite(candidate.value))
    .filter((candidate) => {
      if (candidate.value < 0) return false;
      if (/\b(?:vat|tax)\s*(?:no|nr|number|reg|registration)\b/i.test(lineText)) return false;
      if (/\b(?:account|branch|phone|tel|mobile|cell|fax|page|serial)\b/i.test(lineText)) return false;
      if (/%/.test(lineText) && candidate.value <= 100 && !/[Rr]|ZAR/i.test(candidate.raw) && !/[,.]\d{2}\b/.test(candidate.raw)) return false;
      return candidateLooksLikeAmount(candidate);
    });

  return values.length ? values[values.length - 1].value : null;
}

function isSubtotalLabel(line: string): boolean {
  const text = line.toLowerCase().replace(/[._-]+/g, ' ');
  if (/\b(?:total\s+incl|total\s+including|total\s+inc|grand\s+total|amount\s+due|amount\s+payable|balance\s+due|total\s+due)\b/.test(text)) return false;
  return /\b(?:subtotal|sub\s+total|total\s+excl|total\s+excluding|excl\s+vat|excl\.\s+vat)\b/.test(text);
}

function isVatAmountLabel(line: string): boolean {
  const text = line.toLowerCase().replace(/[._-]+/g, ' ');
  if (/\b(?:vat|tax)\s*(?:no|nr|number|reg|registration)\b/.test(text)) return false;
  if (/\b(?:subtotal|sub\s+total|total\s+incl|total\s+including|total\s+inc|grand\s+total|amount\s+due|amount\s+payable|balance\s+due|total\s+due|total\s+payable|total\s+excl|total\s+excluding|excl\s+vat)\b/.test(text)) return false;
  return /\b(?:vat\s+amount|vat\s*@\s*15|output\s+vat|tax\s+amount|vat)\b/.test(text);
}

function isTotalLabel(line: string): boolean {
  const text = line.toLowerCase().replace(/[._-]+/g, ' ');
  if (/\b(?:subtotal|sub\s+total|vat\s+amount|output\s+vat|tax\s+amount|total\s+excl|total\s+excluding|excl\s+vat)\b/.test(text)) return false;
  return /\b(?:total\s+incl|total\s+including|total\s+inc|grand\s+total|amount\s+due|amount\s+payable|balance\s+due|total\s+due|total\s+payable|total)\b/.test(text);
}

function findMoneyByLabel(lines: string[], matchesLabel: (line: string) => boolean): number | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? '';
    if (!matchesLabel(line)) continue;

    const sameLine = bestMoneyOnLine(line);
    if (sameLine !== null) return sameLine;

    const nextLine = lines[index + 1] ?? '';
    if (nextLine && !isSubtotalLabel(nextLine) && !isVatAmountLabel(nextLine) && !isTotalLabel(nextLine)) {
      const nextValue = bestMoneyOnLine(nextLine);
      if (nextValue !== null) return nextValue;
    }
  }

  return null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function hasVat15Indicator(text: string): boolean {
  return /\b(?:vat\s*(?:@|at)?\s*15\s*%|15\s*%\s*vat|vat\s+15\s*%)\b/i.test(text);
}

function deriveMoneyValues(input: {
  subtotalExVat: number | null;
  vatAmount: number | null;
  totalIncVat: number | null;
  text: string;
}): { subtotalExVat: number | null; vatAmount: number | null; totalIncVat: number | null } {
  let { subtotalExVat, vatAmount, totalIncVat } = input;

  if (totalIncVat === null && subtotalExVat !== null && vatAmount !== null) {
    totalIncVat = roundMoney(subtotalExVat + vatAmount);
  }

  if (vatAmount === null && subtotalExVat !== null && totalIncVat !== null && totalIncVat >= subtotalExVat) {
    vatAmount = roundMoney(totalIncVat - subtotalExVat);
  }

  if (subtotalExVat === null && vatAmount !== null && totalIncVat !== null && totalIncVat >= vatAmount) {
    subtotalExVat = roundMoney(totalIncVat - vatAmount);
  }

  if (hasVat15Indicator(input.text) && totalIncVat !== null) {
    if (subtotalExVat === null) {
      subtotalExVat = roundMoney(totalIncVat / 1.15);
    }
    if (vatAmount === null && subtotalExVat !== null) {
      vatAmount = roundMoney(totalIncVat - subtotalExVat);
    }
  }

  return { subtotalExVat, vatAmount, totalIncVat };
}

function labelValueFromLine(line: string, labelPattern: RegExp): string {
  const match = line.match(labelPattern);
  if (!match || typeof match.index !== 'number') return '';

  const endIndex = match.index + match[0].length;
  return collapseText(line.slice(endIndex).replace(/^\s*[:#.-]?\s*/, ''));
}

function parseDateValue(value: string): string {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const isoMatch = text.match(/\b(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return toIsoDate(year, month, day);
  }

  const localMatch = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})\b/);
  if (localMatch) {
    const day = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const year = Number(localMatch[3]);
    return toIsoDate(year, month, day);
  }

  const monthMatch = text.match(/\b(\d{1,2})\s+(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s*,?\s+(20\d{2}|19\d{2})\b/i);
  if (monthMatch) {
    const day = Number(monthMatch[1]);
    const month = monthNameToNumber(monthMatch[2] ?? '');
    const year = Number(monthMatch[3]);
    return toIsoDate(year, month, day);
  }

  const monthFirstMatch = text.match(/\b(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+(\d{1,2}),?\s+(20\d{2}|19\d{2})\b/i);
  if (monthFirstMatch) {
    const month = monthNameToNumber(monthFirstMatch[1] ?? '');
    const day = Number(monthFirstMatch[2]);
    const year = Number(monthFirstMatch[3]);
    return toIsoDate(year, month, day);
  }

  return '';
}

function monthNameToNumber(value: string): number {
  const normalized = value.toLowerCase().slice(0, 3);
  return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(normalized) + 1;
}

function toIsoDate(year: number, month: number, day: number): string {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return '';
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return '';

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';

  return date.toISOString().slice(0, 10);
}

function isInvoiceDateLabel(line: string): boolean {
  const text = line.toLowerCase().replace(/[._-]+/g, ' ');
  if (/\bdue\s+date\b/.test(text) && !/\binvoice\s+date\b/.test(text)) return false;
  return /\b(?:invoice\s+date|inv\s+date|tax\s+date|document\s+date|doc\s+date|date)\b/.test(text);
}

function findInvoiceDate(lines: string[]): string {
  const labelPattern = /\b(?:invoice\s+date|inv\s+date|tax\s+date|document\s+date|doc\s+date|date)\b/i;

  for (const line of lines.slice(0, 80)) {
    if (!isInvoiceDateLabel(line)) continue;

    const labeledValue = labelValueFromLine(line, labelPattern);
    const parsed = parseDateValue(labeledValue) || parseDateValue(line);
    if (parsed) return parsed;
  }

  for (let index = 0; index < Math.min(lines.length, 80); index += 1) {
    const line = lines[index] ?? '';
    if (!isInvoiceDateLabel(line)) continue;

    const nextLine = lines[index + 1] ?? '';
    if (nextLine && !/\b(?:due|payment|delivery)\b/i.test(nextLine)) {
      const parsed = parseDateValue(nextLine);
      if (parsed) return parsed;
    }
  }

  for (const line of lines.slice(0, 60)) {
    if (/\bdue\s+date\b/i.test(line)) continue;
    const parsed = parseDateValue(line);
    if (parsed) return parsed;
  }

  return '';
}

function cleanInvoiceNumber(value: string): string {
  return collapseText(value)
    .replace(/^(?:no\.?|number|#)\s*/i, '')
    .replace(/[^A-Za-z0-9/_-]+$/g, '')
    .slice(0, 80);
}

function isFalseInvoiceNumber(value: string, sourceLine = ''): boolean {
  const cleaned = cleanInvoiceNumber(value);
  if (!cleaned || cleaned.length < 2) return true;
  if (parseDateValue(cleaned)) return true;
  if (/\b(?:vat|tax)\s*(?:no|nr|number|reg|registration)\b/i.test(sourceLine)) return true;
  if (/\b(?:page|total|subtotal|amount|balance|date|bank|account|tel|phone)\b/i.test(cleaned)) return true;
  if (/^\d{1,2}\s*(?:of|\/)\s*\d{1,2}$/i.test(cleaned)) return true;
  if (/^\d{10}$/.test(cleaned) && /\b(?:vat|tax)\b/i.test(sourceLine)) return true;
  if (/^[Rr]\s*\d/.test(cleaned)) return true;

  const moneyCandidates = findMoneyCandidates(cleaned);
  return moneyCandidates.some((candidate) => /[Rr]|ZAR/i.test(candidate.raw) || /[,.]\d{2}\b/.test(candidate.raw));
}

function findInvoiceNumber(lines: string[]): string {
  const labelPattern = /\b(?:tax\s+invoice\s*(?:no\.?|number|#)|invoice\s*(?:no\.?|number|#)|inv\s*(?:no\.?|number|#)|document\s*(?:no\.?|number|#)|doc\s*(?:no\.?|number|#)|number)\b/i;

  for (let index = 0; index < Math.min(lines.length, 80); index += 1) {
    const line = lines[index] ?? '';
    if (!labelPattern.test(line)) continue;
    if (/\b(?:vat|tax)\s*(?:no|nr|number|reg|registration)\b/i.test(line)) continue;

    const sameLineValue = labelValueFromLine(line, labelPattern);
    if (sameLineValue && !isFalseInvoiceNumber(sameLineValue, line)) {
      return cleanInvoiceNumber(sameLineValue);
    }

    const nextLine = lines[index + 1] ?? '';
    if (nextLine && !labelPattern.test(nextLine) && !isFalseInvoiceNumber(nextLine, line)) {
      return cleanInvoiceNumber(nextLine);
    }
  }

  return '';
}

function hasBusinessNameKeyword(line: string): boolean {
  const normalized = line.toLowerCase();
  return BUSINESS_NAME_KEYWORDS.some((keyword) => new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(normalized));
}

function cleanSupplierCandidate(line: string): { text: string; fromSupplierLabel: boolean } {
  const supplierLabel = line.match(/\b(?:supplier|vendor)\s*(?:name)?\s*[:#-]\s*(.+)$/i);
  if (supplierLabel?.[1]) {
    return { text: collapseText(supplierLabel[1]), fromSupplierLabel: true };
  }

  return { text: collapseText(line).replace(/^[^A-Za-z0-9]+/, '').trim(), fromSupplierLabel: false };
}

function isBadSupplierLine(line: string): boolean {
  const text = collapseText(line);
  const normalized = text.toLowerCase();
  if (text.length < 3 || text.length > 100) return true;
  if (!/[A-Za-z]/.test(text)) return true;
  if (isPdfInternalLine(text)) return true;
  if (findMoneyCandidates(text).some(candidateLooksLikeAmount)) return true;
  if (parseDateValue(text)) return true;
  if (/^\d+[\d\s,.]*$/.test(text)) return true;
  if (/\b(?:tax\s+invoice|invoice|quote|statement|date|vat|total|subtotal|amount\s+due|balance\s+due|registration|reg\s+no|tel|phone|email|bank|account|page|bill\s+to|customer|client|sold\s+to|ship\s+to|delivery|serial|model\s+no)\b/i.test(text)) return true;
  if (/^[A-Za-z]+\s+[A-Z]{1,5}\d{2,}[A-Z0-9-]*$/i.test(text) && !hasBusinessNameKeyword(text)) return true;
  if (/^kubota\s+[a-z0-9-]+$/i.test(normalized)) return true;
  return false;
}

function findSupplier(lines: string[]): string {
  const billToIndex = lines.findIndex((line) => /\b(?:bill\s+to|customer|client|sold\s+to|ship\s+to)\b/i.test(line));
  const scanLimit = billToIndex > 1 ? Math.min(billToIndex, 28) : Math.min(lines.length, 28);
  const candidates: Array<{ text: string; score: number; index: number }> = [];

  for (let index = 0; index < scanLimit; index += 1) {
    const { text, fromSupplierLabel } = cleanSupplierCandidate(lines[index] ?? '');
    if (isBadSupplierLine(text)) continue;

    const keyword = hasBusinessNameKeyword(text);
    const uppercaseLetters = text.replace(/[^A-Z]/g, '').length;
    const letters = text.replace(/[^A-Za-z]/g, '').length || 1;
    const uppercaseRatio = uppercaseLetters / letters;
    let score = 100 - index;

    if (fromSupplierLabel) score += 40;
    if (keyword) score += 50;
    if (/\b(?:pty|ltd|cc|limited)\b/i.test(text)) score += 40;
    if (uppercaseRatio > 0.55) score += 8;
    if (index <= 4) score += 10;

    candidates.push({ text, score, index });
  }

  candidates.sort((left, right) => right.score - left.score || left.index - right.index);
  return candidates[0]?.text ?? '';
}

function parseReadingNumber(value: string): number | null {
  const match = String(value ?? '').match(/\b(\d{1,3}(?:[\s,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\b/);
  if (!match?.[1]) return null;

  const parsed = parseMoney(match[1]);
  if (parsed === null || parsed < 0 || parsed > 10000000) return null;
  return parsed;
}

function metricForUsageLine(line: string): InvoiceExtractionUsageMetric {
  const text = line.toLowerCase();
  if (/\b(?:odometer|mileage|kilometres|kilometers|kms|km\s*(?:reading|meter)?)\b/.test(text)) return 'km';
  if (/\b(?:machine\s+hours|engine\s+hours|hour\s+meter|hrs?|hours?|meter\s+reading)\b/.test(text)) return 'hours';
  return 'none';
}

function findUsageReading(lines: string[]): UsageExtraction {
  const strongLabel = /\b(?:machine\s+hours|engine\s+hours|hour\s+meter|meter\s+reading|odometer|mileage|kilometres|kilometers|km\s+reading|kms)\b/i;
  const weakHoursLabel = /\b(?:hours|hrs)\b/i;

  for (let index = 0; index < Math.min(lines.length, 120); index += 1) {
    const line = lines[index] ?? '';
    const isStrong = strongLabel.test(line);
    const isWeakHours = !isStrong && weakHoursLabel.test(line) && /\b(?:tractor|kubota|machine|engine|meter)\b/i.test(collapseText(lines.slice(Math.max(0, index - 3), index + 2).join(' ')));

    if (!isStrong && !isWeakHours) continue;
    if (/\b(?:labou?r|rate|qty|quantity|unit\s+price)\b/i.test(line)) continue;

    const metric = metricForUsageLine(line) === 'none' ? 'hours' : metricForUsageLine(line);
    const afterColon = line.includes(':') ? line.slice(line.indexOf(':') + 1) : line;
    const sameLineValue = parseReadingNumber(afterColon);
    if (sameLineValue !== null) return { usageMetric: metric, usageReading: sameLineValue };

    const nextLineValue = parseReadingNumber(lines[index + 1] ?? '');
    if (nextLineValue !== null) return { usageMetric: metric, usageReading: nextLineValue };
  }

  return { usageMetric: 'none', usageReading: null };
}

function includesAnyKeyword(line: string, keywords: string[]): boolean {
  const normalized = line.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function isClassificationRejectedLine(line: string): boolean {
  if (isPdfInternalLine(line)) return true;
  if (/\b(?:invoice|subtotal|sub\s+total|total|vat|tax|amount\s+due|balance\s+due|bank|account|payment|terms|supplier|customer|bill\s+to|date|document\s+no|invoice\s+no|page|registration|reg\s+no)\b/i.test(line)) return true;
  if (/^[Rr]?\s*\d[\d\s,.]*$/.test(line)) return true;
  return false;
}

function classifyText(lines: string[]): TextClassification {
  const maintenanceLines: string[] = [];
  const partLines: string[] = [];
  const repairLines: string[] = [];
  const noteLines: string[] = [];

  for (const line of lines) {
    const text = collapseText(line);
    if (text.length < 3 || text.length > 220) continue;
    if (isClassificationRejectedLine(text)) continue;

    const hasMaintenance = includesAnyKeyword(text, MAINTENANCE_KEYWORDS);
    const hasParts = includesAnyKeyword(text, PARTS_KEYWORDS);
    const hasRepair = includesAnyKeyword(text, REPAIR_KEYWORDS);

    if (hasMaintenance) maintenanceLines.push(text);
    if (hasParts) partLines.push(text);
    if (hasRepair) repairLines.push(text);
    if (!hasMaintenance && !hasParts && !hasRepair && noteLines.length < 8 && /[A-Za-z]{4,}/.test(text)) {
      noteLines.push(text);
    }
  }

  const join = (values: string[]) => uniqueStrings(values).slice(0, 12).join('\n').slice(0, 1200);

  return {
    maintenanceWorkDone: join(maintenanceLines),
    partsSupplied: join(partLines),
    repairWorkDone: join(repairLines),
    notes: join(noteLines),
  };
}

function populatedDraftFieldCount(draft: InvoiceExtractionDraft): number {
  const values = [
    draft.supplierName,
    draft.invoiceNumber,
    draft.invoiceDate,
    draft.subtotalExVat,
    draft.vatAmount,
    draft.totalIncVat,
    draft.usageReading,
    draft.usageMetric === 'none' ? '' : draft.usageMetric,
    draft.maintenanceWorkDone,
    draft.partsSupplied,
    draft.repairWorkDone,
    draft.notes,
  ];

  return values.filter((value) => value !== null && String(value ?? '').trim()).length;
}

export function parseInvoiceText(rawText: string): InvoiceExtractionResult {
  const text = sanitizeExtractedText(rawText, 500);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const warnings: string[] = [];

  if (!collapseText(text)) {
    warnings.push('No readable invoice text was found. Complete the fields manually.');
    return {
      draft: { ...EMPTY_DRAFT },
      rawText: '',
      warnings,
      quality: 'none',
    };
  }

  const initialSubtotalExVat = findMoneyByLabel(lines, isSubtotalLabel);
  const initialVatAmount = findMoneyByLabel(lines, isVatAmountLabel);
  const initialTotalIncVat = findMoneyByLabel(lines, isTotalLabel);
  const moneyValues = deriveMoneyValues({
    subtotalExVat: initialSubtotalExVat,
    vatAmount: initialVatAmount,
    totalIncVat: initialTotalIncVat,
    text,
  });
  const usage = findUsageReading(lines);
  const classification = classifyText(lines);
  const draft: InvoiceExtractionDraft = {
    supplierName: findSupplier(lines),
    invoiceNumber: findInvoiceNumber(lines),
    invoiceDate: findInvoiceDate(lines),
    subtotalExVat: moneyValues.subtotalExVat,
    vatAmount: moneyValues.vatAmount,
    totalIncVat: moneyValues.totalIncVat,
    usageReading: usage.usageReading,
    usageMetric: usage.usageMetric,
    maintenanceWorkDone: classification.maintenanceWorkDone,
    partsSupplied: classification.partsSupplied,
    repairWorkDone: classification.repairWorkDone,
    notes: classification.notes,
  };

  if (!draft.invoiceNumber) warnings.push('Invoice number was not confidently found.');
  if (!draft.invoiceDate) warnings.push('Invoice date was not confidently found.');
  if (draft.totalIncVat === null) warnings.push('Invoice total was not confidently found.');
  if (!draft.supplierName) warnings.push('Supplier name was not confidently found.');
  if (draft.usageMetric === 'none' || draft.usageReading === null) warnings.push('Usage reading was not confidently found.');

  const populatedFields = populatedDraftFieldCount(draft);

  return {
    draft,
    rawText: text.slice(0, 12000),
    warnings,
    quality: populatedFields >= 6 ? 'good' : populatedFields >= 2 ? 'weak' : 'none',
  };
}

export function extractInvoiceFromUpload(input: {
  data: Buffer;
  contentType: string;
  fileName: string;
}): InvoiceExtractionResult {
  const contentType = String(input.contentType ?? '').trim().toLowerCase();
  const fileName = String(input.fileName ?? '').trim().toLowerCase();
  const warnings: string[] = [];

  if (contentType === 'application/pdf' || fileName.endsWith('.pdf')) {
    const rawText = extractDigitalPdfText(input.data);

    if (!collapseText(rawText)) {
      return {
        draft: { ...EMPTY_DRAFT },
        rawText: '',
        warnings: [
          'This file appears to be scanned or image-based. Aim4price could not read the invoice text automatically. Please complete the fields manually.',
        ],
        quality: 'none',
      };
    }

    const parsed = parseInvoiceText(rawText);

    if (!hasInvoiceSignals(parsed.rawText)) {
      parsed.warnings.unshift('The PDF text was readable, but Aim4price could not confidently identify invoice-style content. Please review the fields manually.');
      parsed.quality = parsed.quality === 'good' ? 'weak' : parsed.quality;
    }

    return parsed;
  }

  if (contentType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
    warnings.push('Image OCR is not available in this free MVP build yet. Complete the invoice fields manually.');
    return {
      draft: { ...EMPTY_DRAFT },
      rawText: '',
      warnings,
      quality: 'none',
    };
  }

  warnings.push('This file type is saved, but automatic extraction is only attempted for PDFs and supported images. Complete the fields manually.');
  return {
    draft: { ...EMPTY_DRAFT },
    rawText: '',
    warnings,
    quality: 'none',
  };
}
