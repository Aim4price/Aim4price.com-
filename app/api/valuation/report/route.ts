import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ValuationPdfKeyValue = {
  label: string;
  value: string;
};

type ValuationPdfMarketSource = {
  sourceName: string;
  title: string;
  priceExVat: number | null;
  details: string;
  sourceUrl?: string | null;
};

type ValuationPdfPayload = {
  generatedAt: string;
  machineTitle: string;
  sectorLabel: string;
  familyLabel: string;
  brandName: string;
  valuationPath: string;
  selectedMethodLabel: string;
  selectedValueExVat: number;
  aim4priceValueExVat: number | null;
  marketplaceValueExVat: number | null;
  marketCount: number;
  confidenceText: string;
  confidenceNote: string;
  yearSummary: string;
  usageSummary: string;
  conditionSummary: string;
  replacementPriceExVat: number | null;
  replacementBasisText: string;
  marketEvidenceInfo: string;
  marketSources: ValuationPdfMarketSource[];
  notes: string[];
  assetDetailRows: ValuationPdfKeyValue[];
  clientRows: ValuationPdfKeyValue[];
  recordRows: ValuationPdfKeyValue[];
};

type PdfFontKey = 'F1' | 'F2' | 'F3';

type PdfImageResource = {
  name: string;
  width: number;
  height: number;
  rgbData: Buffer;
  alphaData?: Buffer;
};

type PdfBuildState = {
  pages: string[][];
};

const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const PDF_MARGIN_X = 36;
const PDF_TOP_Y = 804;
const PDF_RIGHT_COLUMN_WIDTH = 175.75;
const PDF_GRID_GAP = 10;
const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN_X * 2;
const PDF_LEFT_COLUMN_WIDTH = PDF_CONTENT_WIDTH - PDF_RIGHT_COLUMN_WIDTH - PDF_GRID_GAP;
const PDF_FOOTER_TOP_Y = 54;
const AIM4PRICE_EMAIL = 'aim4price@gmail.com';
const AIM4PRICE_PHONE = '0625721650';

const COLORS = {
  strong: '0.027 0.043 0.071',
  ink: '0.067 0.094 0.153',
  muted: '0.373 0.420 0.478',
  subdued: '0.247 0.275 0.322',
  line: '0.843 0.867 0.898',
  lineStrong: '0.725 0.761 0.808',
  soft: '0.961 0.965 0.973',
  soft2: '0.980 0.984 0.988',
  white: '1 1 1',
};

const FOOTER_DISCLAIMER =
  'Values are indicative estimates based on saved asset-register information and available pricing inputs. This is not a certified valuation, inspection report or guarantee of selling price. Final value remains subject to physical inspection, documentation, attachments, condition, location and live market demand.';

let cachedLogoImage: PdfImageResource | null | undefined;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = 'N/A'): string {
  const cleaned = String(value ?? '').trim();
  return cleaned || fallback;
}

function readOptionalString(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function readNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function readDate(value: unknown): Date {
  const parsed = value ? new Date(String(value)) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
}

function isBlankReportValue(value: unknown): boolean {
  const cleaned = String(value ?? '').trim();
  return !cleaned || /^(-|n\/a|null|undefined)$/i.test(cleaned);
}

function normalizeKeyValueRows(value: unknown): ValuationPdfKeyValue[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isPlainRecord)
    .map((row) => ({
      label: readOptionalString(row.label),
      value: readOptionalString(row.value),
    }))
    .filter((row) => row.label && !isBlankReportValue(row.value));
}

function readMarketSources(value: unknown): ValuationPdfMarketSource[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isPlainRecord)
    .slice(0, 6)
    .map((item) => ({
      sourceName: readString(item.sourceName, 'Marketplace'),
      title: readString(item.title, 'Market listing'),
      priceExVat: readNumber(item.priceExVat),
      details: readOptionalString(item.details),
      sourceUrl: readOptionalString(item.sourceUrl) || null,
    }));
}

function pushRow(rows: ValuationPdfKeyValue[], label: string, value: unknown) {
  const cleaned = readOptionalString(value);
  if (!label || isBlankReportValue(cleaned)) return;
  rows.push({ label, value: cleaned });
}

function normalizeSelectedMethodLabel(value: unknown): string {
  const cleaned = readString(value, 'Aim4price Value').replace(/\s+/g, ' ').trim();
  if (/market/i.test(cleaned)) return 'Marketplace Value';
  if (/aim4price/i.test(cleaned)) return 'Aim4price Value';
  return cleaned;
}

function normalizeConfidenceText(value: unknown): string {
  const cleaned = readString(value, 'Low').replace(/^Confidence:\s*/i, '').trim();
  if (/^high$/i.test(cleaned)) return 'High';
  if (/^medium$/i.test(cleaned)) return 'Medium';
  if (/^low$/i.test(cleaned)) return 'Low';
  return cleaned || 'Low';
}

function marketEvidenceText(marketCount: number): string {
  if (!Number.isFinite(marketCount) || marketCount <= 0) return 'No matches';
  return `${marketCount} match${marketCount === 1 ? '' : 'es'}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePayload(value: unknown): ValuationPdfPayload {
  if (!isPlainRecord(value)) {
    throw new Error('Invalid valuation report payload.');
  }

  const selectedValueExVat = readNumber(value.selectedValueExVat);
  if (selectedValueExVat === null) {
    throw new Error('A selected valuation amount is required before the PDF can be created.');
  }

  const notes = Array.isArray(value.notes)
    ? value.notes.map((note) => readOptionalString(note)).filter(Boolean).slice(0, 5)
    : [];

  const generatedAt = readDate(value.generatedAt).toISOString();
  const familyLabel = readString(value.familyLabel, 'Asset');
  const sectorLabel = readString(value.sectorLabel, 'Asset');
  const brandName = readString(value.brandName, '');
  const valuationPath = readString(value.valuationPath, 'Valuation');
  const selectedMethodLabel = normalizeSelectedMethodLabel(value.selectedMethodLabel);
  const marketCount = readNumber(value.marketCount) ?? 0;
  const confidenceText = normalizeConfidenceText(value.confidenceText);
  const yearSummary = readString(value.yearSummary, 'Unknown');
  const usageSummary = readString(value.usageSummary, 'Usage captured');
  const conditionSummary = readString(value.conditionSummary, 'Condition captured');

  const fallbackAssetRows: ValuationPdfKeyValue[] = [];
  pushRow(fallbackAssetRows, 'Category', familyLabel || sectorLabel);
  pushRow(fallbackAssetRows, 'Brand', brandName);
  pushRow(fallbackAssetRows, 'Model', readString(value.machineTitle, '').replace(new RegExp(`^${escapeRegExp(brandName)}\\s+`, 'i'), ''));
  pushRow(fallbackAssetRows, 'Year', yearSummary);
  pushRow(fallbackAssetRows, 'Usage', usageSummary);
  pushRow(fallbackAssetRows, 'Condition', conditionSummary);
  const replacementPriceExVat = readNumber(value.replacementPriceExVat);
  if (replacementPriceExVat !== null) pushRow(fallbackAssetRows, 'Replacement Price', `${formatPdfMoney(replacementPriceExVat)} excl. VAT`);
  pushRow(fallbackAssetRows, 'Valuation Path', valuationPath);
  pushRow(fallbackAssetRows, 'Valuation Source / Selected Value Type', selectedMethodLabel);

  const fallbackClientRows: ValuationPdfKeyValue[] = [
    { label: 'Business Name', value: 'Aim4price' },
    { label: 'Contact Details', value: AIM4PRICE_PHONE },
    { label: 'Business Email', value: AIM4PRICE_EMAIL },
  ];

  const fallbackRecordRows: ValuationPdfKeyValue[] = [
    { label: 'Selected Value', value: selectedMethodLabel },
    { label: 'Confidence', value: confidenceText },
    { label: 'Market Evidence', value: marketEvidenceText(marketCount) },
    { label: 'Generated', value: formatPdfDate(readDate(generatedAt)) },
  ];

  const assetDetailRows = normalizeKeyValueRows(value.assetDetailRows);
  const clientRows = normalizeKeyValueRows(value.clientRows);
  const recordRows = normalizeKeyValueRows(value.recordRows);

  return {
    generatedAt,
    machineTitle: readString(value.machineTitle, 'Aim4price valuation'),
    sectorLabel,
    familyLabel,
    brandName,
    valuationPath,
    selectedMethodLabel,
    selectedValueExVat,
    aim4priceValueExVat: readNumber(value.aim4priceValueExVat),
    marketplaceValueExVat: readNumber(value.marketplaceValueExVat),
    marketCount,
    confidenceText,
    confidenceNote: readOptionalString(value.confidenceNote),
    yearSummary,
    usageSummary,
    conditionSummary,
    replacementPriceExVat,
    replacementBasisText: readOptionalString(value.replacementBasisText),
    marketEvidenceInfo: readOptionalString(value.marketEvidenceInfo),
    marketSources: readMarketSources(value.marketSources),
    notes,
    assetDetailRows: assetDetailRows.length ? assetDetailRows : fallbackAssetRows,
    clientRows: clientRows.length ? clientRows : fallbackClientRows,
    recordRows: recordRows.length ? recordRows : fallbackRecordRows,
  };
}

function formatPdfDate(value: Date): string {
  return value.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatPdfMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';

  const rounded = Math.round(value);
  const formatted = Math.abs(rounded).toLocaleString('en-ZA').replace(/,/g, ' ');
  return `${rounded < 0 ? '-' : ''}R ${formatted}`;
}

function pdfFileSlug(value: string): string {
  const parts = String(value ?? '').match(/[A-Za-z0-9]+/g) ?? [];
  return parts.join('-') || 'Valuation';
}

function normalizePdfText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(value: unknown): string {
  const normalized = normalizePdfText(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  let output = '';

  for (const character of normalized) {
    if (character === '\\') {
      output += '\\\\';
    } else if (character === '(') {
      output += '\\(';
    } else if (character === ')') {
      output += '\\)';
    } else if (character === '•') {
      output += '\\225';
    } else if (character === '·') {
      output += '\\267';
    } else {
      const code = character.charCodeAt(0);
      output += code >= 32 && code <= 126 ? character : ' ';
    }
  }

  return output;
}

function pdfNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : '0';
}

function currentPdfPage(state: PdfBuildState): string[] {
  if (!state.pages.length) {
    state.pages.push([]);
  }

  return state.pages[state.pages.length - 1];
}

function drawPdfText(
  state: PdfBuildState,
  text: unknown,
  x: number,
  y: number,
  size = 10,
  font: PdfFontKey = 'F1',
  color = COLORS.ink,
) {
  currentPdfPage(state).push(`BT ${color} rg /${font} ${pdfNumber(size)} Tf ${pdfNumber(x)} ${pdfNumber(y)} Td (${escapePdfText(text)}) Tj ET`);
}

function estimatePdfTextWidth(text: unknown, size: number, font: PdfFontKey = 'F1'): number {
  const value = normalizePdfText(text);
  const base = font === 'F2' ? 0.57 : 0.53;
  let units = 0;

  for (const character of value) {
    if (character === ' ') units += 0.32;
    else if ('.,:;|!iIl'.includes(character)) units += 0.28;
    else if ('MW@#%'.includes(character)) units += 0.82;
    else units += base;
  }

  return units * size;
}

function drawPdfRightText(
  state: PdfBuildState,
  text: unknown,
  rightX: number,
  y: number,
  size = 10,
  font: PdfFontKey = 'F1',
  color = COLORS.ink,
) {
  drawPdfText(state, text, rightX - estimatePdfTextWidth(text, size, font), y, size, font, color);
}

function drawPdfLine(state: PdfBuildState, x1: number, y1: number, x2: number, y2: number, color = COLORS.line, width = 0.6) {
  currentPdfPage(state).push(`q ${color} RG ${pdfNumber(width)} w ${pdfNumber(x1)} ${pdfNumber(y1)} m ${pdfNumber(x2)} ${pdfNumber(y2)} l S Q`);
}

function drawPdfRect(
  state: PdfBuildState,
  x: number,
  y: number,
  width: number,
  height: number,
  fill = COLORS.white,
  stroke = COLORS.lineStrong,
  strokeWidth = 0.6,
) {
  currentPdfPage(state).push(`q ${fill} rg ${stroke} RG ${pdfNumber(strokeWidth)} w ${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re B Q`);
}

function drawPdfImage(state: PdfBuildState, image: PdfImageResource, x: number, y: number, width: number, height: number) {
  currentPdfPage(state).push(`q ${pdfNumber(width)} 0 0 ${pdfNumber(height)} ${pdfNumber(x)} ${pdfNumber(y)} cm /${image.name} Do Q`);
}

function drawPdfDot(state: PdfBuildState, centerX: number, centerY: number, radius = 1.15, color = COLORS.subdued) {
  const c = radius * 0.5522847498;
  const x = centerX;
  const y = centerY;
  currentPdfPage(state).push(
    `q ${color} rg ${pdfNumber(x + radius)} ${pdfNumber(y)} m ${pdfNumber(x + radius)} ${pdfNumber(y + c)} ${pdfNumber(x + c)} ${pdfNumber(y + radius)} ${pdfNumber(x)} ${pdfNumber(y + radius)} c ${pdfNumber(x - c)} ${pdfNumber(y + radius)} ${pdfNumber(x - radius)} ${pdfNumber(y + c)} ${pdfNumber(x - radius)} ${pdfNumber(y)} c ${pdfNumber(x - radius)} ${pdfNumber(y - c)} ${pdfNumber(x - c)} ${pdfNumber(y - radius)} ${pdfNumber(x)} ${pdfNumber(y - radius)} c ${pdfNumber(x + c)} ${pdfNumber(y - radius)} ${pdfNumber(x + radius)} ${pdfNumber(y - c)} ${pdfNumber(x + radius)} ${pdfNumber(y)} c f Q`,
  );
}

function drawPdfMetaLine(state: PdfBuildState, parts: string[], x: number, y: number, maxWidth: number, size = 9.2) {
  const totalWidth = parts.reduce((sum, part) => sum + estimatePdfTextWidth(part, size, 'F1'), 0) + Math.max(0, parts.length - 1) * 16;

  if (totalWidth > maxWidth) {
    drawPdfWrappedText(state, parts.join(' | '), x, y, maxWidth, size - 0.4, 'F1', 10.5, COLORS.subdued);
    return;
  }

  let cursorX = x;
  parts.forEach((part, index) => {
    drawPdfText(state, part, cursorX, y, size, 'F1', COLORS.subdued);
    cursorX += estimatePdfTextWidth(part, size, 'F1');

    if (index < parts.length - 1) {
      cursorX += 8;
      drawPdfDot(state, cursorX, y + size * 0.34, 1.05, COLORS.subdued);
      cursorX += 8;
    }
  });
}

function wrapPdfText(text: unknown, maxChars: number): string[] {
  const words = normalizePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }

      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      return;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : ['-'];
}

function wrapPdfTextForWidth(text: unknown, maxWidth: number, size: number, font: PdfFontKey = 'F1'): string[] {
  const maxChars = Math.max(9, Math.floor(maxWidth / (size * (font === 'F2' ? 0.54 : 0.50))));
  return wrapPdfText(text, maxChars);
}

function drawPdfWrappedText(
  state: PdfBuildState,
  text: unknown,
  x: number,
  y: number,
  maxWidth: number,
  size = 10,
  font: PdfFontKey = 'F1',
  lineHeight = size * 1.25,
  color = COLORS.ink,
): number {
  const lines = wrapPdfTextForWidth(text, maxWidth, size, font);
  lines.forEach((line, index) => drawPdfText(state, line, x, y - index * lineHeight, size, font, color));
  return lines.length;
}

function fitPdfTextSize(text: unknown, maxWidth: number, preferredSize: number, font: PdfFontKey = 'F2', minSize = 21): number {
  let size = preferredSize;
  while (size > minSize && estimatePdfTextWidth(text, size, font) > maxWidth) {
    size -= 0.8;
  }
  return size;
}

function measureTableRows(rows: ValuationPdfKeyValue[], options: { labelWidth: number; valueWidth: number; valueAlign?: 'left' | 'right' }) {
  return rows.map((row) => {
    const labelFontSize = row.label.length > 22 ? 7.5 : 8.6;
    const labelLines = wrapPdfTextForWidth(row.label, options.labelWidth - 4, labelFontSize, 'F1');
    const valueLines = options.valueAlign === 'right'
      ? wrapPdfTextForWidth(row.value, options.valueWidth - 2, 8.2, 'F2')
      : wrapPdfTextForWidth(row.value, options.valueWidth - 2, 8.8, 'F2');
    const lineCount = Math.max(labelLines.length, valueLines.length);
    const height = Math.max(options.valueAlign === 'right' ? 17.5 : 20.2, 6 + lineCount * 10.5);

    return { row, labelLines, valueLines, labelFontSize, height };
  });
}

function drawReportRows(
  state: PdfBuildState,
  rows: ValuationPdfKeyValue[],
  x: number,
  topY: number,
  width: number,
  options: { labelWidth: number; valueAlign?: 'left' | 'right'; compact?: boolean },
): number {
  const leftPadding = options.compact ? 8 : 9;
  const rightPadding = options.compact ? 8 : 9;
  const labelWidth = options.labelWidth;
  const valueX = x + leftPadding + labelWidth;
  const valueWidth = width - leftPadding - rightPadding - labelWidth;
  const measuredRows = measureTableRows(rows, { labelWidth, valueWidth, valueAlign: options.valueAlign });
  let cursorY = topY;

  drawPdfLine(state, x + leftPadding, cursorY, x + width - rightPadding, cursorY, COLORS.line, 0.6);

  measuredRows.forEach((measured) => {
    const rowTop = cursorY;
    const rowBottom = rowTop - measured.height;
    const textTop = rowTop - (options.compact ? 11.2 : 12.4);

    measured.labelLines.forEach((line, index) => {
      drawPdfText(state, line, x + leftPadding, textTop - index * 9.6, measured.labelFontSize, 'F1', COLORS.subdued);
    });

    measured.valueLines.forEach((line, index) => {
      if (options.valueAlign === 'right') {
        drawPdfRightText(state, line, x + width - rightPadding, textTop - index * 9.6, 8.2, 'F2', COLORS.strong);
      } else {
        drawPdfText(state, line, valueX, textTop - index * 9.6, 8.8, 'F2', COLORS.strong);
      }
    });

    drawPdfLine(state, x + leftPadding, rowBottom, x + width - rightPadding, rowBottom, COLORS.line, 0.6);
    cursorY = rowBottom;
  });

  return topY - cursorY;
}

function drawReportSection(
  state: PdfBuildState,
  title: string,
  rows: ValuationPdfKeyValue[],
  x: number,
  topY: number,
  width: number,
  options: { labelWidth: number; valueAlign?: 'left' | 'right'; compact?: boolean },
): number {
  const topPadding = options.compact ? 10 : 11;
  const titleY = topY - topPadding - 7;
  const tableTop = topY - (options.compact ? 27 : 31);
  const valueWidth = width - 18 - options.labelWidth;
  const rowHeight = measureTableRows(rows, { labelWidth: options.labelWidth, valueWidth, valueAlign: options.valueAlign }).reduce(
    (total, row) => total + row.height,
    0,
  );
  const sectionHeight = (topY - tableTop) + rowHeight + (options.compact ? 8 : 10);

  drawPdfRect(state, x, topY - sectionHeight, width, sectionHeight, COLORS.white, COLORS.lineStrong, 0.65);
  drawPdfText(state, title, x + (options.compact ? 9 : 10), titleY, 10.8, 'F2', COLORS.strong);
  drawReportRows(state, rows, x, tableTop, width, options);

  return sectionHeight;
}

function drawHeader(state: PdfBuildState, payload: ValuationPdfPayload, logoImage: PdfImageResource | null) {
  if (logoImage) {
    drawPdfImage(state, logoImage, PDF_MARGIN_X + 7, PDF_TOP_Y - 24, 28, 21.85);
  }

  drawPdfText(state, 'Asset Valuation Report', PDF_MARGIN_X + 72, PDF_TOP_Y - 5, 16, 'F2', COLORS.strong);
  drawPdfText(state, 'Aim4price valuation report', PDF_MARGIN_X + 72, PDF_TOP_Y - 23, 8.9, 'F1', COLORS.muted);

  const generatedLabel = formatPdfDate(readDate(payload.generatedAt));
  const metaX = PDF_PAGE_WIDTH - PDF_MARGIN_X - PDF_RIGHT_COLUMN_WIDTH;
  const metaRightX = PDF_PAGE_WIDTH - PDF_MARGIN_X;
  drawPdfText(state, 'Generated', metaX, PDF_TOP_Y - 6, 8.3, 'F1', COLORS.muted);
  drawPdfRightText(state, generatedLabel, metaRightX, PDF_TOP_Y - 6, 8.3, 'F2', COLORS.strong);
  drawPdfText(state, 'Email', metaX, PDF_TOP_Y - 22, 8.3, 'F1', COLORS.muted);
  drawPdfRightText(state, AIM4PRICE_EMAIL, metaRightX, PDF_TOP_Y - 22, 8.3, 'F2', COLORS.strong);

  drawPdfLine(state, PDF_MARGIN_X, PDF_TOP_Y - 56, PDF_PAGE_WIDTH - PDF_MARGIN_X, PDF_TOP_Y - 56, COLORS.lineStrong, 0.7);
}

function drawOverview(state: PdfBuildState, payload: ValuationPdfPayload, topY: number): number {
  const height = 92;
  const rightX = PDF_MARGIN_X + PDF_LEFT_COLUMN_WIDTH;
  const rightWidth = PDF_RIGHT_COLUMN_WIDTH;
  const rightPadding = 12;
  const generatedDate = formatPdfDate(readDate(payload.generatedAt));
  const categoryLabel = (payload.assetDetailRows.find((row) => /^category$/i.test(row.label))?.value || payload.familyLabel || payload.sectorLabel).toUpperCase();
  const heroMetaParts = [`Year Model: ${payload.yearSummary}`, `Usage: ${payload.usageSummary}`, `Condition: ${payload.conditionSummary}`];

  drawPdfRect(state, PDF_MARGIN_X, topY - height, PDF_CONTENT_WIDTH, height, COLORS.white, COLORS.lineStrong, 0.65);
  drawPdfLine(state, rightX, topY, rightX, topY - height, COLORS.lineStrong, 0.65);
  drawPdfRect(state, rightX, topY - height, rightWidth, height, COLORS.soft2, COLORS.lineStrong, 0.65);

  drawPdfText(state, categoryLabel, PDF_MARGIN_X + 12, topY - 18, 8.1, 'F2', COLORS.muted);
  const titleLines = wrapPdfTextForWidth(payload.machineTitle, PDF_LEFT_COLUMN_WIDTH - 28, 21.5, 'F2');
  drawPdfText(state, titleLines[0] ?? payload.machineTitle, PDF_MARGIN_X + 12, topY - 41, 21.5, 'F2', COLORS.strong);
  if (titleLines[1]) {
    drawPdfText(state, titleLines[1], PDF_MARGIN_X + 12, topY - 61, 15.8, 'F2', COLORS.strong);
    drawPdfWrappedText(state, heroMetaParts.join(' | '), PDF_MARGIN_X + 12, topY - 78, PDF_LEFT_COLUMN_WIDTH - 28, 8.3, 'F1', 10.5, COLORS.subdued);
  } else {
    drawPdfMetaLine(state, heroMetaParts, PDF_MARGIN_X + 12, topY - 62, PDF_LEFT_COLUMN_WIDTH - 28, 9.2);
  }

  drawPdfText(state, 'ESTIMATED VALUE', rightX + rightPadding, topY - 18, 8.8, 'F2', COLORS.strong);
  const valueText = formatPdfMoney(payload.selectedValueExVat);
  const valueSize = fitPdfTextSize(valueText, rightWidth - rightPadding * 2, 30, 'F2', 20);
  drawPdfText(state, valueText, rightX + rightPadding, topY - 46, valueSize, 'F2', COLORS.strong);
  drawPdfText(state, 'VAT excluded', rightX + rightPadding, topY - 62, 8.5, 'F1', COLORS.muted);
  drawPdfLine(state, rightX + rightPadding, topY - 72, rightX + rightWidth - rightPadding, topY - 72, COLORS.line, 0.6);
  drawPdfText(state, 'Generated', rightX + rightPadding, topY - 86, 8.2, 'F2', COLORS.muted);
  drawPdfRightText(state, generatedDate, rightX + rightWidth - rightPadding, topY - 86, 8.3, 'F2', COLORS.strong);

  return height;
}

function drawFooter(state: PdfBuildState) {
  drawPdfLine(state, PDF_MARGIN_X, PDF_FOOTER_TOP_Y, PDF_PAGE_WIDTH - PDF_MARGIN_X, PDF_FOOTER_TOP_Y, COLORS.lineStrong, 0.7);
  drawPdfText(state, 'Powered by Aim4price.com', PDF_MARGIN_X, PDF_FOOTER_TOP_Y - 17, 8.2, 'F2', COLORS.strong);

  const disclaimerLines = wrapPdfTextForWidth(FOOTER_DISCLAIMER, PDF_CONTENT_WIDTH - 48, 7.35, 'F3').slice(0, 2);
  disclaimerLines.forEach((line, index) => {
    drawPdfText(state, line, PDF_MARGIN_X, PDF_FOOTER_TOP_Y - 31 - index * 9, 7.35, 'F3', COLORS.subdued);
  });

  drawPdfRightText(state, 'Page 1 of 1', PDF_PAGE_WIDTH - PDF_MARGIN_X, PDF_FOOTER_TOP_Y - 35, 8, 'F2', COLORS.strong);
}

function buildValuationPdf(payload: ValuationPdfPayload): Buffer {
  const state: PdfBuildState = { pages: [[]] };
  const logoImage = getLogoImage();

  drawHeader(state, payload, logoImage);
  const overviewTopY = PDF_TOP_Y - 68;
  const overviewHeight = drawOverview(state, payload, overviewTopY);
  const contentTopY = overviewTopY - overviewHeight - 12;
  const rightX = PDF_MARGIN_X + PDF_LEFT_COLUMN_WIDTH + PDF_GRID_GAP;

  const assetDetailsHeight = drawReportSection(
    state,
    'Asset Details',
    payload.assetDetailRows,
    PDF_MARGIN_X,
    contentTopY,
    PDF_LEFT_COLUMN_WIDTH,
    { labelWidth: 92, valueAlign: 'left' },
  );

  const clientTopY = contentTopY - assetDetailsHeight - 10;
  drawReportSection(
    state,
    'Client / Asset Owner',
    payload.clientRows,
    PDF_MARGIN_X,
    clientTopY,
    PDF_LEFT_COLUMN_WIDTH,
    { labelWidth: 92, valueAlign: 'left' },
  );

  drawReportSection(
    state,
    'Record Summary',
    payload.recordRows,
    rightX,
    contentTopY,
    PDF_RIGHT_COLUMN_WIDTH,
    { labelWidth: 74, valueAlign: 'right', compact: true },
  );

  drawFooter(state);

  return createPdfBuffer(state.pages.map((commands) => commands.join('\n')), logoImage ? [logoImage] : []);
}

function paethPredictor(left: number, above: number, upperLeft: number): number {
  const p = left + above - upperLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - above);
  const pc = Math.abs(p - upperLeft);

  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return above;
  return upperLeft;
}

function parsePngImage(buffer: Buffer, name: string): PdfImageResource | null {
  const signature = buffer.subarray(0, 8);
  if (!signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const chunkData = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (chunkType === 'IHDR') {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData.readUInt8(8);
      colorType = chunkData.readUInt8(9);
      const interlace = chunkData.readUInt8(12);
      if (bitDepth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) return null;
    } else if (chunkType === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (chunkType === 'IEND') {
      break;
    }
  }

  if (!width || !height || !idatChunks.length) return null;

  const channels = colorType === 6 ? 4 : 3;
  const bytesPerPixel = channels;
  const rowBytes = width * channels;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const raw = Buffer.alloc(width * height * channels);
  let sourceOffset = 0;
  let targetOffset = 0;
  let previousRow = Buffer.alloc(rowBytes);

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[sourceOffset];
    sourceOffset += 1;
    const row = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + rowBytes));
    sourceOffset += rowBytes;

    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const above = previousRow[x] ?? 0;
      const upperLeft = x >= bytesPerPixel ? previousRow[x - bytesPerPixel] ?? 0 : 0;
      let value = row[x];

      if (filterType === 1) value = (value + left) & 0xff;
      else if (filterType === 2) value = (value + above) & 0xff;
      else if (filterType === 3) value = (value + Math.floor((left + above) / 2)) & 0xff;
      else if (filterType === 4) value = (value + paethPredictor(left, above, upperLeft)) & 0xff;
      else if (filterType !== 0) return null;

      row[x] = value;
    }

    row.copy(raw, targetOffset);
    previousRow = row;
    targetOffset += rowBytes;
  }

  const rgb = Buffer.alloc(width * height * 3);
  const alpha = colorType === 6 ? Buffer.alloc(width * height) : undefined;
  let rgbOffset = 0;
  let alphaOffset = 0;
  let hasTransparency = false;

  for (let index = 0; index < raw.length; index += channels) {
    rgb[rgbOffset] = raw[index];
    rgb[rgbOffset + 1] = raw[index + 1];
    rgb[rgbOffset + 2] = raw[index + 2];
    rgbOffset += 3;

    if (alpha) {
      const alphaValue = raw[index + 3];
      alpha[alphaOffset] = alphaValue;
      if (alphaValue < 255) hasTransparency = true;
      alphaOffset += 1;
    }
  }

  return {
    name,
    width,
    height,
    rgbData: deflateSync(rgb),
    alphaData: hasTransparency && alpha ? deflateSync(alpha) : undefined,
  };
}

function getLogoImage(): PdfImageResource | null {
  if (typeof cachedLogoImage !== 'undefined') return cachedLogoImage;

  try {
    const logoPath = path.join(process.cwd(), 'public', 'brand', 'aim4price-mark-black.png');
    const logoBuffer = fs.readFileSync(logoPath);
    cachedLogoImage = parsePngImage(logoBuffer, 'ImLogo');
  } catch {
    cachedLogoImage = null;
  }

  return cachedLogoImage;
}

function asciiHexStream(data: Buffer): string {
  return `${data.toString('hex').toUpperCase()}>`;
}

function createImageObjects(images: PdfImageResource[], addObject: (body: string) => number): Map<string, number> {
  const imageObjectIds = new Map<string, number>();

  images.forEach((image) => {
    let softMaskId: number | null = null;

    if (image.alphaData) {
      const alphaStream = asciiHexStream(image.alphaData);
      softMaskId = addObject(
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /Length ${Buffer.byteLength(alphaStream, 'ascii')} >>\nstream\n${alphaStream}\nendstream`,
      );
    }

    const rgbStream = asciiHexStream(image.rgbData);
    const maskReference = softMaskId ? ` /SMask ${softMaskId} 0 R` : '';
    const imageId = addObject(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode]${maskReference} /Length ${Buffer.byteLength(rgbStream, 'ascii')} >>\nstream\n${rgbStream}\nendstream`,
    );
    imageObjectIds.set(image.name, imageId);
  });

  return imageObjectIds;
}

function createPdfBuffer(pageContents: string[], images: PdfImageResource[] = []): Buffer {
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const regularFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const obliqueFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>');
  const imageObjectIds = createImageObjects(images, addObject);
  const xObjectResource = imageObjectIds.size
    ? ` /XObject << ${Array.from(imageObjectIds.entries()).map(([name, objectId]) => `/${name} ${objectId} 0 R`).join(' ')} >>`
    : '';
  const pageIds: number[] = [];

  pageContents.forEach((content) => {
    const contentLength = Buffer.byteLength(content, 'utf8');
    const contentId = addObject(`<< /Length ${contentLength} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R /F3 ${obliqueFontId} 0 R >>${xObjectResource} >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((pageId) => `${pageId} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  const chunks: string[] = ['%PDF-1.4\n'];
  const offsets: number[] = [0];
  let position = Buffer.byteLength(chunks[0], 'utf8');

  objects.forEach((body, index) => {
    const objectText = `${index + 1} 0 obj\n${body}\nendobj\n`;
    offsets.push(position);
    chunks.push(objectText);
    position += Buffer.byteLength(objectText, 'utf8');
  });

  const xrefOffset = position;
  const xrefRows = offsets
    .map((offset, index) => (index === 0 ? '0000000000 65535 f ' : `${String(offset).padStart(10, '0')} 00000 n `))
    .join('\n');
  const trailer = `xref\n0 ${objects.length + 1}\n${xrefRows}\ntrailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  chunks.push(trailer);
  return Buffer.from(chunks.join(''), 'utf8');
}

export async function POST(request: NextRequest) {
  try {
    const payload = normalizePayload(await request.json());
    const pdfBuffer = buildValuationPdf(payload);
    const fileName = `Aim4price-Valuation-${pdfFileSlug(payload.machineTitle)}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to create valuation PDF.' },
      { status: 400 },
    );
  }
}
