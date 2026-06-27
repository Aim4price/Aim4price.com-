import { inflateSync } from 'node:zlib';

export type InvoiceExtractionQuality = 'none' | 'weak' | 'good';

export type InvoiceExtractionDraft = {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  subtotalExVat: number | null;
  vatAmount: number | null;
  totalIncVat: number | null;
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

const EMPTY_DRAFT: InvoiceExtractionDraft = {
  supplierName: '',
  invoiceNumber: '',
  invoiceDate: '',
  subtotalExVat: null,
  vatAmount: null,
  totalIncVat: null,
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
  'lubrication',
  'diagnostic',
  'coolant',
  'check',
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
];

const REPAIR_KEYWORDS = [
  'repair',
  'replace',
  'fixed',
  'fix',
  'weld',
  'rebuild',
  'leak',
  'broken',
  'damage',
  'labour',
  'labor',
  'remove and fit',
  'fitment',
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
    else if (/^[0-7]$/.test(next)) {
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

function decodeHexPdfString(value: string): string {
  const hex = value.replace(/[^0-9a-f]/gi, '');
  if (hex.length < 2) return '';

  const bytes: number[] = [];
  for (let index = 0; index < hex.length - 1; index += 2) {
    bytes.push(parseInt(hex.slice(index, index + 2), 16));
  }

  return Buffer.from(bytes).toString('utf8').replace(/\u0000/g, '');
}

function extractLiteralPdfStrings(value: string): string[] {
  const strings: string[] = [];
  const literalPattern = /\((?:\\.|[^\\)]){2,}\)/g;
  const hexPattern = /<([0-9a-fA-F\s]{6,})>/g;
  let match: RegExpExecArray | null;

  while ((match = literalPattern.exec(value))) {
    const raw = match[0].slice(1, -1);
    const decoded = stripPdfStringEscapes(raw).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
    if (decoded && /[A-Za-z0-9]/.test(decoded)) {
      strings.push(decoded);
    }
  }

  while ((match = hexPattern.exec(value))) {
    const decoded = decodeHexPdfString(match[1] ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
    if (decoded && /[A-Za-z0-9]/.test(decoded)) {
      strings.push(decoded);
    }
  }

  return strings;
}

function looksLikePdfTextStream(value: string): boolean {
  return /\b(?:TJ|Tj|'|")\b/.test(value) || /\b(?:BT|ET|Tf|Td|Tm)\b/.test(value);
}

function extractPdfStreamText(buffer: Buffer): string {
  const binary = buffer.toString('latin1');
  const streamPattern = /<<(.*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  const fragments: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = streamPattern.exec(binary))) {
    const dictionary = match[1] ?? '';
    const streamBody = match[2] ?? '';
    let streamBuffer = Buffer.from(streamBody, 'latin1');

    if (streamBuffer[0] === 0x0d && streamBuffer[1] === 0x0a) {
      streamBuffer = streamBuffer.slice(2);
    } else if (streamBuffer[0] === 0x0a) {
      streamBuffer = streamBuffer.slice(1);
    }

    if (/\/FlateDecode\b/i.test(dictionary)) {
      try {
        streamBuffer = inflateSync(streamBuffer);
      } catch {
        continue;
      }
    }

    const streamText = streamBuffer.toString('latin1');
    if (!looksLikePdfTextStream(streamText)) {
      continue;
    }

    fragments.push(...extractLiteralPdfStrings(streamText));
  }

  return normalizeText(uniqueStrings(fragments).join('\n'));
}

function extractPrintablePdfFallback(buffer: Buffer): string {
  const printable = buffer
    .toString('latin1')
    .replace(/[^\x09\x0a\x0d\x20-\x7e]+/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 4 && /[A-Za-z]/.test(line));

  return normalizeText(uniqueStrings(printable).slice(0, 260).join('\n'));
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
    .replace(/r/gi, '')
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
  return '(?:ZAR\\s*)?(?:R\\s*)?-?\\d[\\d\\s,.]*(?:\\.\\d{2}|,\\d{2})?';
}

function findMoneyCandidates(line: string): number[] {
  const pattern = new RegExp(moneyPatternSource(), 'gi');
  const candidates: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line))) {
    const value = parseMoney(match[0]);
    if (value !== null) {
      candidates.push(value);
    }
  }

  return candidates;
}

function labelMatches(line: string, labels: string[]): boolean {
  const normalized = line.toLowerCase().replace(/[_-]+/g, ' ');
  return labels.some((label) => normalized.includes(label.toLowerCase()));
}

function findMoneyAfterLabels(lines: string[], labels: string[]): number | null {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (!labelMatches(line, labels)) {
      continue;
    }

    const values = findMoneyCandidates(line);
    if (values.length) {
      return values[values.length - 1] ?? null;
    }

    const nextValues = findMoneyCandidates(lines[index + 1] ?? '');
    if (nextValues.length) {
      return nextValues[nextValues.length - 1] ?? null;
    }
  }

  return null;
}

function findTextAfterLabels(lines: string[], labels: string[], maxLength = 120): string {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    for (const label of labels) {
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`${escapedLabel}\\s*[:#-]?\\s*(.+)$`, 'i');
      const match = line.match(pattern);
      const value = collapseText(match?.[1] ?? '');

      if (value && !labelMatches(value, labels)) {
        return value.slice(0, maxLength);
      }
    }

    if (labelMatches(line, labels)) {
      const nextLine = collapseText(lines[index + 1] ?? '');
      if (nextLine) {
        return nextLine.slice(0, maxLength);
      }
    }
  }

  return '';
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

  const monthMatch = text.match(/\b(\d{1,2})\s+(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+(20\d{2}|19\d{2})\b/i);
  if (monthMatch) {
    const day = Number(monthMatch[1]);
    const month = monthNameToNumber(monthMatch[2] ?? '');
    const year = Number(monthMatch[3]);
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

function findInvoiceDate(lines: string[]): string {
  const labeled = findTextAfterLabels(lines, ['Invoice Date', 'Date'], 80);
  const labeledDate = parseDateValue(labeled);
  if (labeledDate) return labeledDate;

  for (const line of lines.slice(0, 60)) {
    const parsed = parseDateValue(line);
    if (parsed) return parsed;
  }

  return '';
}

function cleanInvoiceNumber(value: string): string {
  return collapseText(value)
    .replace(/^(no\.?|number|#)\s*/i, '')
    .replace(/[^A-Za-z0-9/_-]+$/g, '')
    .slice(0, 80);
}

function findInvoiceNumber(lines: string[]): string {
  const direct = findTextAfterLabels(lines, ['Invoice No', 'Invoice Number', 'Invoice #', 'Inv No', 'Inv Number'], 90);
  if (direct) return cleanInvoiceNumber(direct);

  for (const line of lines.slice(0, 50)) {
    const match = line.match(/\b(?:invoice|tax invoice)\s*(?:no\.?|number|#)?\s*[:#-]\s*([A-Za-z0-9][A-Za-z0-9/_-]{1,60})/i);
    if (match?.[1]) return cleanInvoiceNumber(match[1]);
  }

  return '';
}

function findSupplier(lines: string[]): string {
  const rejected = /\b(invoice|tax invoice|quote|statement|date|vat|total|subtotal|amount due|balance due|registration|reg no|tel|phone|email|bank|account|page)\b/i;

  for (const line of lines.slice(0, 14)) {
    const text = collapseText(line).replace(/^[^A-Za-z0-9]+/, '').trim();

    if (text.length < 3 || text.length > 90) continue;
    if (!/[A-Za-z]/.test(text)) continue;
    if (rejected.test(text)) continue;
    if (findMoneyCandidates(text).length) continue;

    return text;
  }

  return '';
}

function includesAnyKeyword(line: string, keywords: string[]): boolean {
  const normalized = line.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function classifyText(lines: string[]): TextClassification {
  const maintenanceLines: string[] = [];
  const partLines: string[] = [];
  const repairLines: string[] = [];
  const noteLines: string[] = [];
  const rejected = /\b(invoice|subtotal|sub total|total|vat|tax|amount due|balance due|bank|account|payment|terms)\b/i;

  for (const line of lines) {
    const text = collapseText(line);
    if (text.length < 3 || text.length > 220) continue;
    if (rejected.test(text)) continue;

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

export function parseInvoiceText(rawText: string): InvoiceExtractionResult {
  const text = normalizeText(rawText);
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

  const subtotalExVat = findMoneyAfterLabels(lines, ['Subtotal', 'Sub Total', 'Total Excl', 'Total Excluding', 'Excl VAT', 'Excl. VAT']);
  const vatAmount = findMoneyAfterLabels(lines, ['VAT', 'Tax']);
  const totalIncVat =
    findMoneyAfterLabels(lines, ['Amount Due', 'Balance Due', 'Total Incl', 'Total Including', 'Total Inc', 'Grand Total']) ??
    findMoneyAfterLabels(lines, ['Total']);
  const classification = classifyText(lines);
  const draft: InvoiceExtractionDraft = {
    supplierName: findSupplier(lines),
    invoiceNumber: findInvoiceNumber(lines),
    invoiceDate: findInvoiceDate(lines),
    subtotalExVat,
    vatAmount,
    totalIncVat,
    maintenanceWorkDone: classification.maintenanceWorkDone,
    partsSupplied: classification.partsSupplied,
    repairWorkDone: classification.repairWorkDone,
    notes: classification.notes,
  };

  if (!draft.invoiceNumber) warnings.push('Invoice number was not confidently found.');
  if (!draft.invoiceDate) warnings.push('Invoice date was not confidently found.');
  if (draft.totalIncVat === null) warnings.push('Invoice total was not confidently found.');
  if (!draft.supplierName) warnings.push('Supplier name was not confidently found.');

  const populatedFields = Object.values(draft).filter((value) => value !== null && String(value ?? '').trim()).length;

  return {
    draft,
    rawText: text.slice(0, 12000),
    warnings,
    quality: populatedFields >= 5 ? 'good' : populatedFields >= 2 ? 'weak' : 'none',
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
    const parsed = parseInvoiceText(rawText);

    if (collapseText(rawText).length < 50) {
      parsed.warnings.unshift('This PDF looks like a scanned document. Please check the extracted fields or complete them manually.');
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
