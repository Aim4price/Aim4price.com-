import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  selectedValueExVat: number | null;
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
};

type PdfFontKey = 'F1' | 'F2';

type PdfBuildState = {
  pages: string[][];
  y: number;
};

const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const PDF_MARGIN = 42;
const PDF_BOTTOM_MARGIN = 44;
const VAT_RATE = 0.15;
const VAT_MULTIPLIER = 1 + VAT_RATE;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = 'N/A'): string {
  const cleaned = String(value ?? '').trim();
  return cleaned || fallback;
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

function readMarketSources(value: unknown): ValuationPdfMarketSource[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isPlainRecord)
    .slice(0, 6)
    .map((item) => ({
      sourceName: readString(item.sourceName, 'Marketplace'),
      title: readString(item.title, 'Market listing'),
      priceExVat: readNumber(item.priceExVat),
      details: readString(item.details, ''),
      sourceUrl: readString(item.sourceUrl, '') || null,
    }));
}

function normalizePayload(value: unknown): ValuationPdfPayload {
  if (!isPlainRecord(value)) {
    throw new Error('Invalid valuation report payload.');
  }

  const selectedValueExVat = readNumber(value.selectedValueExVat);
  if (selectedValueExVat === null) {
    throw new Error('A valuation amount is required before the PDF can be created.');
  }

  const notes = Array.isArray(value.notes)
    ? value.notes.map((note) => readString(note, '')).filter(Boolean).slice(0, 5)
    : [];

  return {
    generatedAt: readDate(value.generatedAt).toISOString(),
    machineTitle: readString(value.machineTitle, 'Aim4price valuation'),
    sectorLabel: readString(value.sectorLabel),
    familyLabel: readString(value.familyLabel),
    brandName: readString(value.brandName),
    valuationPath: readString(value.valuationPath),
    selectedMethodLabel: readString(value.selectedMethodLabel, 'Aim4price value'),
    selectedValueExVat,
    aim4priceValueExVat: readNumber(value.aim4priceValueExVat),
    marketplaceValueExVat: readNumber(value.marketplaceValueExVat),
    marketCount: readNumber(value.marketCount) ?? 0,
    confidenceText: readString(value.confidenceText, 'Confidence: N/A'),
    confidenceNote: readString(value.confidenceNote, ''),
    yearSummary: readString(value.yearSummary),
    usageSummary: readString(value.usageSummary),
    conditionSummary: readString(value.conditionSummary),
    replacementPriceExVat: readNumber(value.replacementPriceExVat),
    replacementBasisText: readString(value.replacementBasisText, ''),
    marketEvidenceInfo: readString(value.marketEvidenceInfo, ''),
    marketSources: readMarketSources(value.marketSources),
    notes,
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

function formatPdfMoneyInclVat(value: number | null): string {
  return value === null ? 'N/A' : formatPdfMoney(value * VAT_MULTIPLIER);
}

function pdfFileSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'valuation';
}

function sanitizePdfText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/•/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(value: unknown): string {
  return sanitizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
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

function drawPdfText(state: PdfBuildState, text: unknown, x: number, y: number, size = 10, font: PdfFontKey = 'F1') {
  currentPdfPage(state).push(`BT /${font} ${pdfNumber(size)} Tf ${pdfNumber(x)} ${pdfNumber(y)} Td (${escapePdfText(text)}) Tj ET`);
}

function drawPdfRule(state: PdfBuildState, y: number) {
  currentPdfPage(state).push(`q 0.78 0.82 0.86 RG 0.7 w ${pdfNumber(PDF_MARGIN)} ${pdfNumber(y)} m ${pdfNumber(PDF_PAGE_WIDTH - PDF_MARGIN)} ${pdfNumber(y)} l S Q`);
}

function drawPdfRect(state: PdfBuildState, x: number, y: number, width: number, height: number, fill = '0.96 0.98 0.97') {
  currentPdfPage(state).push(`q ${fill} rg ${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re f Q`);
  currentPdfPage(state).push(`q 0.80 0.87 0.83 RG 0.6 w ${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re S Q`);
}

function addPdfPage(state: PdfBuildState, continued = false) {
  state.pages.push([]);
  state.y = PDF_PAGE_HEIGHT - PDF_MARGIN;

  if (continued) {
    drawPdfText(state, 'Aim4price Valuation Report continued', PDF_MARGIN, state.y, 12, 'F2');
    drawPdfText(state, 'Aim4price valuation PDF', PDF_PAGE_WIDTH - PDF_MARGIN - 138, state.y, 9, 'F1');
    state.y -= 22;
    drawPdfRule(state, state.y);
    state.y -= 18;
  }
}

function ensurePdfSpace(state: PdfBuildState, requiredHeight: number) {
  if (state.y - requiredHeight < PDF_BOTTOM_MARGIN) {
    addPdfPage(state, true);
  }
}

function wrapPdfText(text: unknown, maxChars: number): string[] {
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean);
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

function drawPdfWrappedText(state: PdfBuildState, text: unknown, x: number, maxWidth: number, size = 10, font: PdfFontKey = 'F1', lineHeight = 13): number {
  const maxChars = Math.max(16, Math.floor(maxWidth / (size * 0.54)));
  const lines = wrapPdfText(text, maxChars);

  lines.forEach((line) => {
    drawPdfText(state, line, x, state.y, size, font);
    state.y -= lineHeight;
  });

  return lines.length;
}

function drawPdfWrappedTextAt(state: PdfBuildState, text: unknown, x: number, y: number, maxWidth: number, size = 10, font: PdfFontKey = 'F1', lineHeight = 13): number {
  const maxChars = Math.max(16, Math.floor(maxWidth / (size * 0.54)));
  const lines = wrapPdfText(text, maxChars);

  lines.forEach((line, index) => {
    drawPdfText(state, line, x, y - index * lineHeight, size, font);
  });

  return lines.length;
}

function drawPdfKeyValue(state: PdfBuildState, label: string, value: string, x: number, y: number, width: number) {
  drawPdfText(state, label.toUpperCase(), x, y, 7.6, 'F2');
  const lines = wrapPdfText(value, Math.max(12, Math.floor(width / 5.2)));
  drawPdfText(state, lines[0] ?? '-', x, y - 13, 11, 'F2');
  if (lines[1]) {
    drawPdfText(state, lines[1], x, y - 26, 8.5, 'F1');
  }
}

function drawPdfSummaryCard(state: PdfBuildState, label: string, value: string, x: number, y: number, width: number) {
  drawPdfRect(state, x, y - 48, width, 48, '0.97 0.99 0.98');
  drawPdfText(state, label.toUpperCase(), x + 11, y - 17, 7.5, 'F2');
  drawPdfText(state, value, x + 11, y - 34, 12.5, 'F2');
}

function drawSectionTitle(state: PdfBuildState, title: string) {
  ensurePdfSpace(state, 34);
  drawPdfText(state, title, PDF_MARGIN, state.y, 14, 'F2');
  state.y -= 18;
}

function drawDetailPanel(state: PdfBuildState, items: Array<{ label: string; value: string }>) {
  const rowHeight = 52;
  const blockHeight = Math.ceil(items.length / 3) * rowHeight;
  ensurePdfSpace(state, blockHeight + 8);

  const topY = state.y;
  drawPdfRect(state, PDF_MARGIN, topY - blockHeight, PDF_PAGE_WIDTH - PDF_MARGIN * 2, blockHeight, '0.98 0.99 1.00');

  const gap = 12;
  const columnWidth = (PDF_PAGE_WIDTH - PDF_MARGIN * 2 - 24 - gap * 2) / 3;

  items.forEach((item, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = PDF_MARGIN + 12 + col * (columnWidth + gap);
    const y = topY - 14 - row * rowHeight;
    drawPdfKeyValue(state, item.label, item.value, x, y, columnWidth);
  });

  state.y = topY - blockHeight - 22;
}

function drawMarketSourceBlock(state: PdfBuildState, source: ValuationPdfMarketSource, index: number) {
  const contentWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2 - 24;
  const titleLines = wrapPdfText(`${index + 1}. ${source.title}`, Math.floor(contentWidth / 5.4));
  const metaLines = wrapPdfText(`${source.sourceName} | ${formatPdfMoney(source.priceExVat)} excl. VAT${source.details ? ` | ${source.details}` : ''}`, Math.floor(contentWidth / 4.9));
  const urlLines = source.sourceUrl ? wrapPdfText(source.sourceUrl, Math.floor(contentWidth / 4.6)).slice(0, 2) : [];
  const blockHeight = 23 + titleLines.length * 12.5 + metaLines.length * 11 + urlLines.length * 10;

  ensurePdfSpace(state, blockHeight + 8);
  const topY = state.y;
  drawPdfRect(state, PDF_MARGIN, topY - blockHeight, PDF_PAGE_WIDTH - PDF_MARGIN * 2, blockHeight, index % 2 === 0 ? '0.985 0.992 0.988' : '0.965 0.981 0.974');
  state.y -= 16;

  titleLines.forEach((line) => {
    drawPdfText(state, line, PDF_MARGIN + 12, state.y, 10.4, 'F2');
    state.y -= 12.5;
  });

  metaLines.forEach((line) => {
    drawPdfText(state, line, PDF_MARGIN + 12, state.y, 8.8, 'F1');
    state.y -= 11;
  });

  urlLines.forEach((line) => {
    drawPdfText(state, line, PDF_MARGIN + 12, state.y, 7.8, 'F1');
    state.y -= 10;
  });

  state.y = topY - blockHeight - 8;
}

function buildValuationPdf(payload: ValuationPdfPayload): Buffer {
  const state: PdfBuildState = { pages: [], y: 0 };
  const generatedAt = readDate(payload.generatedAt);
  const selectedInclVat = payload.selectedValueExVat === null ? null : payload.selectedValueExVat * VAT_MULTIPLIER;

  addPdfPage(state, false);

  drawPdfText(state, 'Aim4price', PDF_MARGIN, state.y, 13, 'F2');
  drawPdfText(state, 'Valuation PDF Report', PDF_MARGIN, state.y - 28, 24, 'F2');
  drawPdfText(state, `Generated ${formatPdfDate(generatedAt)}`, PDF_PAGE_WIDTH - PDF_MARGIN - 145, state.y, 9, 'F1');
  state.y -= 56;
  drawPdfRule(state, state.y);
  state.y -= 24;

  const heroTop = state.y;
  drawPdfRect(state, PDF_MARGIN, heroTop - 98, PDF_PAGE_WIDTH - PDF_MARGIN * 2, 98, '0.955 0.980 0.970');
  drawPdfText(state, 'AIM4PRICE ESTIMATE', PDF_MARGIN + 14, heroTop - 22, 8, 'F2');
  const machineLines = drawPdfWrappedTextAt(state, payload.machineTitle, PDF_MARGIN + 14, heroTop - 43, 292, 16.5, 'F2', 18.5);
  drawPdfWrappedTextAt(state, `${payload.brandName} | ${payload.familyLabel} | ${payload.sectorLabel}`, PDF_MARGIN + 14, heroTop - 47 - machineLines * 18, 292, 8.8, 'F1', 11);
  drawPdfText(state, 'SELECTED VALUE', PDF_PAGE_WIDTH - PDF_MARGIN - 174, heroTop - 22, 8, 'F2');
  drawPdfText(state, `${formatPdfMoney(payload.selectedValueExVat)} excl. VAT`, PDF_PAGE_WIDTH - PDF_MARGIN - 174, heroTop - 43, 13, 'F2');
  drawPdfText(state, `${formatPdfMoney(selectedInclVat)} incl. VAT`, PDF_PAGE_WIDTH - PDF_MARGIN - 174, heroTop - 58, 8.8, 'F1');
  drawPdfText(state, payload.confidenceText, PDF_PAGE_WIDTH - PDF_MARGIN - 174, heroTop - 76, 8.8, 'F2');
  drawPdfText(state, payload.selectedMethodLabel, PDF_PAGE_WIDTH - PDF_MARGIN - 174, heroTop - 90, 8.2, 'F1');
  state.y = heroTop - 118;

  const cardGap = 8;
  const cardWidth = (PDF_PAGE_WIDTH - PDF_MARGIN * 2 - cardGap * 3) / 4;
  drawPdfSummaryCard(state, 'Year model', payload.yearSummary, PDF_MARGIN, state.y, cardWidth);
  drawPdfSummaryCard(state, 'Usage', payload.usageSummary, PDF_MARGIN + cardWidth + cardGap, state.y, cardWidth);
  drawPdfSummaryCard(state, 'Condition', payload.conditionSummary, PDF_MARGIN + (cardWidth + cardGap) * 2, state.y, cardWidth);
  drawPdfSummaryCard(state, 'Path', payload.valuationPath, PDF_MARGIN + (cardWidth + cardGap) * 3, state.y, cardWidth);
  state.y -= 68;

  drawSectionTitle(state, 'Report details');
  drawDetailPanel(state, [
    { label: 'Sector', value: payload.sectorLabel },
    { label: 'Equipment type', value: payload.familyLabel },
    { label: 'Brand', value: payload.brandName },
    { label: 'Selected method', value: payload.selectedMethodLabel },
    { label: 'Confidence', value: payload.confidenceText.replace(/^Confidence:\s*/i, '') },
    { label: 'Market listings', value: String(payload.marketCount) },
  ]);

  drawSectionTitle(state, 'Value basis');
  drawDetailPanel(state, [
    { label: 'Aim4price value', value: `${formatPdfMoney(payload.aim4priceValueExVat)} excl. VAT` },
    { label: 'Marketplace value', value: `${formatPdfMoney(payload.marketplaceValueExVat)} excl. VAT` },
    { label: 'Replacement price', value: `${formatPdfMoney(payload.replacementPriceExVat)} excl. VAT` },
    { label: 'Selected incl VAT', value: `${formatPdfMoneyInclVat(payload.selectedValueExVat)} incl. VAT` },
    { label: 'Replacement basis', value: payload.replacementBasisText || 'N/A' },
    { label: 'Evidence rule', value: payload.marketCount > 0 ? 'Matching evidence available' : 'No matching evidence yet' },
  ]);

  if (payload.confidenceNote) {
    ensurePdfSpace(state, 44);
    drawPdfRect(state, PDF_MARGIN, state.y - 42, PDF_PAGE_WIDTH - PDF_MARGIN * 2, 42, '0.985 0.992 0.988');
    drawPdfText(state, 'CONFIDENCE NOTE', PDF_MARGIN + 12, state.y - 15, 7.6, 'F2');
    drawPdfWrappedTextAt(state, payload.confidenceNote, PDF_MARGIN + 12, state.y - 29, PDF_PAGE_WIDTH - PDF_MARGIN * 2 - 24, 8.7, 'F1', 10.4);
    state.y -= 60;
  }

  drawSectionTitle(state, 'Market evidence');
  if (payload.marketEvidenceInfo) {
    drawPdfWrappedText(state, payload.marketEvidenceInfo, PDF_MARGIN, PDF_PAGE_WIDTH - PDF_MARGIN * 2, 8.6, 'F1', 10.8);
    state.y -= 6;
  }

  if (payload.marketSources.length) {
    payload.marketSources.forEach((source, index) => drawMarketSourceBlock(state, source, index));
  } else {
    ensurePdfSpace(state, 62);
    drawPdfRect(state, PDF_MARGIN, state.y - 58, PDF_PAGE_WIDTH - PDF_MARGIN * 2, 58, '0.985 0.992 0.988');
    drawPdfText(state, 'NO MATCHING MARKETPLACE AVERAGE YET', PDF_MARGIN + 12, state.y - 18, 8.5, 'F2');
    drawPdfWrappedTextAt(
      state,
      'When Aim4price finds similar listings, they will appear in the valuation as supporting market evidence.',
      PDF_MARGIN + 12,
      state.y - 35,
      PDF_PAGE_WIDTH - PDF_MARGIN * 2 - 24,
      9,
      'F1',
      11,
    );
    state.y -= 76;
  }

  ensurePdfSpace(state, 96);
  drawPdfRule(state, state.y);
  state.y -= 18;
  drawPdfText(state, 'Important notes', PDF_MARGIN, state.y, 12.5, 'F2');
  state.y -= 16;
  const notes = payload.notes.length
    ? payload.notes
    : ['Values exclude VAT unless stated otherwise.', 'This is an indicative Aim4price estimate and not a certified valuation.'];

  notes.forEach((note, index) => {
    drawPdfWrappedText(state, `${index + 1}. ${note}`, PDF_MARGIN, PDF_PAGE_WIDTH - PDF_MARGIN * 2, 8.4, 'F1', 10.7);
  });

  state.pages.forEach((page, index) => {
    page.push(`BT /F1 8 Tf ${pdfNumber(PDF_MARGIN)} ${pdfNumber(24)} Td (${escapePdfText('Powered by Aim4price.com')}) Tj ET`);
    page.push(`BT /F1 8 Tf ${pdfNumber(PDF_PAGE_WIDTH - PDF_MARGIN - 62)} ${pdfNumber(24)} Td (${escapePdfText(`Page ${index + 1} of ${state.pages.length}`)}) Tj ET`);
  });

  return createPdfBuffer(state.pages.map((commands) => commands.join('\n')));
}

function createPdfBuffer(pageContents: string[]): Buffer {
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const regularFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds: number[] = [];

  pageContents.forEach((content) => {
    const contentLength = Buffer.byteLength(content, 'utf8');
    const contentId = addObject(`<< /Length ${contentLength} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
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
    const generatedDate = new Date(payload.generatedAt).toISOString().slice(0, 10);
    const fileName = `aim4price-valuation-${pdfFileSlug(payload.machineTitle)}-${generatedDate}.pdf`;

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
