const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const CONTENT_BOTTOM = 48;

type PdfFont = 'F1' | 'F2';

type HtmlNode = {
  tag: string;
  attributes: Record<string, string>;
  children: HtmlNode[];
  text: string;
};

type ReportBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'keyValue'; label: string; value: string }
  | { kind: 'tableRow'; values: string[]; header: boolean }
  | { kind: 'divider' };

type PdfState = {
  pages: string[][];
  y: number;
  title: string;
  tableRecordNumber: number;
};

export type BrandedReportPdfOptions = {
  title?: string;
  subtitle?: string;
};

const HIDDEN_CLASSES = new Set([
  'actions',
  'action',
  'assetReportScreenBar',
  'assetReportScreenActions',
  'assetReportButton',
  'assetReportButtonPrimary',
]);

const KEY_VALUE_CLASSES = new Set([
  'assetReportRow',
  'assetReportMetaLine',
  'assetReportMaintenanceDetail',
  'assetReportInvoiceDetail',
  'maintenanceDetail',
]);

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    hellip: '...',
    laquo: '<<',
    ldquo: '"',
    lsquo: "'",
    lt: '<',
    middot: '-',
    nbsp: ' ',
    ndash: '-',
    quot: '"',
    raquo: '>>',
    rdquo: '"',
    rsquo: "'",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1]?.toLowerCase() === 'x';
      const parsed = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : match;
    }

    return named[entity.toLowerCase()] ?? match;
  });
}

function normalizeText(value: string): string {
  return decodeHtml(value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  }

  return attributes;
}

function parseHtml(html: string): HtmlNode {
  const root: HtmlNode = { tag: 'root', attributes: {}, children: [], text: '' };
  const stack = [root];
  const tokens = html.match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[^>]+>|[^<]+/g) ?? [];
  const voidTags = new Set(['br', 'hr', 'img', 'input', 'link', 'meta', 'source']);

  for (const token of tokens) {
    if (token.startsWith('<!--') || token.startsWith('<!')) continue;

    if (token.startsWith('</')) {
      const closingTag = token.slice(2, -1).trim().toLowerCase();
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === closingTag) {
          stack.length = index;
          break;
        }
      }
      continue;
    }

    if (token.startsWith('<')) {
      const source = token.slice(1, -1).replace(/\/$/, '').trim();
      const separator = source.search(/\s/);
      const tag = (separator === -1 ? source : source.slice(0, separator)).toLowerCase();
      const attributeSource = separator === -1 ? '' : source.slice(separator + 1);
      const node: HtmlNode = { tag, attributes: parseAttributes(attributeSource), children: [], text: '' };
      stack[stack.length - 1].children.push(node);

      if (!token.endsWith('/>') && !voidTags.has(tag)) stack.push(node);
      continue;
    }

    stack[stack.length - 1].text += token;
  }

  return root;
}

function classNames(node: HtmlNode): string[] {
  return String(node.attributes.class ?? '').split(/\s+/).filter(Boolean);
}

function hasClass(node: HtmlNode, className: string): boolean {
  return classNames(node).includes(className);
}

function textContent(node: HtmlNode): string {
  return normalizeText([node.text, ...node.children.map(textContent)].join(' '));
}

function directDescendantText(node: HtmlNode, tags: string[]): string[] {
  const values: string[] = [];

  function visit(current: HtmlNode) {
    if (tags.includes(current.tag)) {
      const value = textContent(current);
      if (value) values.push(value);
      return;
    }
    current.children.forEach(visit);
  }

  node.children.forEach(visit);
  return values;
}

function isHiddenNode(node: HtmlNode): boolean {
  if (['head', 'script', 'style', 'noscript', 'svg', 'button'].includes(node.tag)) return true;
  return classNames(node).some((className) => HIDDEN_CLASSES.has(className));
}

function keyValueFromNode(node: HtmlNode): { label: string; value: string } | null {
  const spans = directDescendantText(node, ['span']);
  const strong = directDescendantText(node, ['strong']);
  const label = spans[0] ?? '';
  const value = strong[0] ?? '';

  if (!label || !value || label === value) return null;
  return { label, value };
}

function mainReportNode(root: HtmlNode): HtmlNode {
  let firstMain: HtmlNode | null = null;

  function find(node: HtmlNode) {
    if (firstMain) return;
    if (node.tag === 'main') {
      firstMain = node;
      return;
    }
    node.children.forEach(find);
  }

  find(root);
  return firstMain ?? root;
}

function pushBlock(blocks: ReportBlock[], block: ReportBlock) {
  if ('text' in block && !block.text) return;
  const previous = blocks[blocks.length - 1];
  if (previous && JSON.stringify(previous) === JSON.stringify(block)) return;
  blocks.push(block);
}

function extractReportBlocks(html: string): { title: string; blocks: ReportBlock[] } {
  const root = parseHtml(html);
  const reportRoot = mainReportNode(root);
  const blocks: ReportBlock[] = [];
  let title = '';

  function walk(node: HtmlNode) {
    if (isHiddenNode(node)) return;

    if (node.tag === 'tr') {
      const values = node.children
        .filter((child) => child.tag === 'td' || child.tag === 'th')
        .map(textContent)
        .filter(Boolean);
      if (values.length) pushBlock(blocks, { kind: 'tableRow', values, header: node.children.some((child) => child.tag === 'th') });
      return;
    }

    const classes = classNames(node);
    if (classes.some((className) => KEY_VALUE_CLASSES.has(className))) {
      const pair = keyValueFromNode(node);
      if (pair) {
        pushBlock(blocks, { kind: 'keyValue', ...pair });
        return;
      }
    }

    if (node.tag === 'h1' || node.tag === 'h2' || node.tag === 'h3') {
      const text = textContent(node);
      if (!title && text) title = text;
      pushBlock(blocks, { kind: 'heading', level: Number(node.tag.slice(1)) as 1 | 2 | 3, text });
      return;
    }

    if (node.tag === 'p') {
      const text = textContent(node);
      if (text && !hasClass(node, 'assetReportDisclaimer')) pushBlock(blocks, { kind: 'paragraph', text });
      return;
    }

    if (node.tag === 'hr') {
      pushBlock(blocks, { kind: 'divider' });
      return;
    }

    node.children.forEach(walk);
  }

  walk(reportRoot);

  return {
    title: title || 'Aim4price Report',
    blocks,
  };
}

function escapePdfText(value: string): string {
  return normalizeText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function pdfNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : '0';
}

function page(state: PdfState): string[] {
  if (!state.pages.length) state.pages.push([]);
  return state.pages[state.pages.length - 1];
}

function drawRect(state: PdfState, x: number, y: number, width: number, height: number, fill: string, stroke?: string) {
  page(state).push(`q ${fill} rg ${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re f Q`);
  if (stroke) page(state).push(`q ${stroke} RG 0.7 w ${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re S Q`);
}

function drawRule(state: PdfState, y: number, color = '0.80 0.85 0.84') {
  page(state).push(`q ${color} RG 0.65 w ${PAGE_MARGIN} ${pdfNumber(y)} m ${PAGE_WIDTH - PAGE_MARGIN} ${pdfNumber(y)} l S Q`);
}

function drawText(state: PdfState, text: string, x: number, y: number, size: number, font: PdfFont, color = '0.07 0.14 0.12') {
  page(state).push(`BT ${color} rg /${font} ${pdfNumber(size)} Tf ${pdfNumber(x)} ${pdfNumber(y)} Td (${escapePdfText(text)}) Tj ET`);
}

function wrapText(text: string, maxChars: number): string[] {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) lines.push(current);
      current = '';
      for (let offset = 0; offset < word.length; offset += maxChars) lines.push(word.slice(offset, offset + maxChars));
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}

function wrappedLines(text: string, width: number, size: number): string[] {
  return wrapText(text, Math.max(14, Math.floor(width / (size * 0.52))));
}

function drawPageHeader(state: PdfState, continued: boolean) {
  state.pages.push([]);
  drawRect(state, 0, PAGE_HEIGHT - 78, PAGE_WIDTH, 78, '0.04 0.23 0.19');
  drawText(state, 'AIM4PRICE', PAGE_MARGIN, PAGE_HEIGHT - 39, 15, 'F2', '1 1 1');
  drawText(state, continued ? `${state.title} - continued` : state.title, PAGE_MARGIN, PAGE_HEIGHT - 60, 9.5, 'F1', '0.82 0.93 0.89');
  state.y = PAGE_HEIGHT - 104;
}

function ensureSpace(state: PdfState, height: number) {
  if (state.y - height < CONTENT_BOTTOM) drawPageHeader(state, true);
}

function drawHeading(state: PdfState, block: Extract<ReportBlock, { kind: 'heading' }>) {
  const size = block.level === 1 ? 20 : block.level === 2 ? 13.5 : 11;
  const lineHeight = block.level === 1 ? 24 : block.level === 2 ? 18 : 15;
  const lines = wrappedLines(block.text, CONTENT_WIDTH - (block.level === 1 ? 26 : 0), size);
  const height = lines.length * lineHeight + (block.level === 1 ? 24 : 13);
  ensureSpace(state, height);

  if (block.level === 1) {
    drawRect(state, PAGE_MARGIN, state.y - height + 9, CONTENT_WIDTH, height, '0.91 0.97 0.95', '0.63 0.79 0.73');
    let y = state.y - 20;
    for (const line of lines) {
      drawText(state, line, PAGE_MARGIN + 14, y, size, 'F2');
      y -= lineHeight;
    }
    state.y -= height + 6;
    return;
  }

  if (block.level === 2) drawRule(state, state.y + 5, '0.43 0.67 0.59');
  let y = state.y - 10;
  for (const line of lines) {
    drawText(state, line, PAGE_MARGIN, y, size, 'F2');
    y -= lineHeight;
  }
  state.y -= height;
}

function drawParagraph(state: PdfState, text: string) {
  const lines = wrappedLines(text, CONTENT_WIDTH, 9.2);
  const height = lines.length * 12 + 7;
  ensureSpace(state, height);
  let y = state.y;
  for (const line of lines) {
    drawText(state, line, PAGE_MARGIN, y, 9.2, 'F1', '0.31 0.38 0.36');
    y -= 12;
  }
  state.y -= height;
}

function drawKeyValue(state: PdfState, label: string, value: string) {
  const labelWidth = 145;
  const valueLines = wrappedLines(value, CONTENT_WIDTH - labelWidth - 26, 9.2);
  const height = Math.max(26, valueLines.length * 12 + 12);
  ensureSpace(state, height);
  drawRect(state, PAGE_MARGIN, state.y - height + 5, CONTENT_WIDTH, height, '0.975 0.985 0.982', '0.84 0.88 0.87');
  drawText(state, label, PAGE_MARGIN + 10, state.y - 12, 8.6, 'F2', '0.20 0.34 0.30');
  valueLines.forEach((line, index) => drawText(state, line, PAGE_MARGIN + labelWidth, state.y - 12 - index * 12, 9.2, 'F1'));
  state.y -= height + 3;
}

function availableTableLines(state: PdfState, lineHeight: number): number {
  return Math.max(0, Math.floor((state.y - CONTENT_BOTTOM - 12) / lineHeight));
}

function drawTableRow(state: PdfState, values: string[], header: boolean) {
  const safeValues = values.length ? values : ['-'];
  const columnWidth = CONTENT_WIDTH / safeValues.length;
  const fontSize = header ? 7.6 : 7.4;
  const lineHeight = 9.5;
  const lineSets = safeValues.map((value) => wrappedLines(value, columnWidth - 10, fontSize));
  const totalLines = Math.max(...lineSets.map((lines) => lines.length));
  let lineOffset = 0;

  while (lineOffset < totalLines) {
    if (availableTableLines(state, lineHeight) < 1) drawPageHeader(state, true);
    const linesOnPage = Math.max(1, availableTableLines(state, lineHeight));
    const chunkLineCount = Math.min(totalLines - lineOffset, linesOnPage);
    const height = Math.max(24, chunkLineCount * lineHeight + 11);

    drawRect(
      state,
      PAGE_MARGIN,
      state.y - height + 4,
      CONTENT_WIDTH,
      height,
      header ? '0.10 0.35 0.29' : '0.98 0.985 0.982',
      '0.78 0.84 0.82',
    );
    lineSets.forEach((lines, column) => lines.slice(lineOffset, lineOffset + chunkLineCount).forEach((line, index) => {
      drawText(
        state,
        line,
        PAGE_MARGIN + column * columnWidth + 5,
        state.y - 11 - index * lineHeight,
        fontSize,
        header ? 'F2' : 'F1',
        header ? '1 1 1' : '0.10 0.18 0.16',
      );
    }));
    state.y -= height;
    lineOffset += chunkLineCount;
  }
}

function drawWideTableRecordHeading(state: PdfState, label: string) {
  ensureSpace(state, 27);
  drawRect(state, PAGE_MARGIN, state.y - 21, CONTENT_WIDTH, 25, '0.10 0.35 0.29', '0.10 0.35 0.29');
  drawText(state, label, PAGE_MARGIN + 10, state.y - 11, 8.4, 'F2', '1 1 1');
  state.y -= 27;
}

function drawWideTableField(state: PdfState, label: string, value: string, recordLabel: string) {
  const labelWidth = 152;
  const lineHeight = 10.5;
  const labelLines = wrappedLines(label, labelWidth - 19, 8.1);
  const valueLines = wrappedLines(value, CONTENT_WIDTH - labelWidth - 19, 8.4);
  const totalLines = Math.max(labelLines.length, valueLines.length);
  let lineOffset = 0;

  while (lineOffset < totalLines) {
    if (availableTableLines(state, lineHeight) < 1) {
      drawPageHeader(state, true);
      drawWideTableRecordHeading(state, `${recordLabel} - continued`);
    }
    const linesOnPage = Math.max(1, availableTableLines(state, lineHeight));
    const chunkLineCount = Math.min(totalLines - lineOffset, linesOnPage);
    const height = Math.max(25, chunkLineCount * lineHeight + 11);

    drawRect(state, PAGE_MARGIN, state.y - height + 4, CONTENT_WIDTH, height, '0.98 0.985 0.982', '0.78 0.84 0.82');
    labelLines.slice(lineOffset, lineOffset + chunkLineCount).forEach((line, index) => {
      drawText(state, line, PAGE_MARGIN + 9, state.y - 11 - index * lineHeight, 8.1, 'F2', '0.20 0.34 0.30');
    });
    valueLines.slice(lineOffset, lineOffset + chunkLineCount).forEach((line, index) => {
      drawText(state, line, PAGE_MARGIN + labelWidth, state.y - 11 - index * lineHeight, 8.4, 'F1');
    });
    state.y -= height;
    lineOffset += chunkLineCount;
  }
}

function drawWideTableHeader(state: PdfState, headers: string[]) {
  drawWideTableRecordHeading(state, 'Report table');
  headers.forEach((header, index) => {
    drawWideTableField(state, `Column ${index + 1}`, header, 'Report table');
  });
  state.y -= 5;
}

function drawWideTableRecord(state: PdfState, headers: string[], values: string[]) {
  state.tableRecordNumber += 1;
  const recordLabel = `Record ${state.tableRecordNumber}`;
  drawWideTableRecordHeading(state, recordLabel);
  const fieldCount = Math.max(headers.length, values.length);

  for (let index = 0; index < fieldCount; index += 1) {
    drawWideTableField(
      state,
      headers[index] || `Column ${index + 1}`,
      values[index] || '-',
      recordLabel,
    );
  }
  state.y -= 7;
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

  for (const content of pageContents) {
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
    pageIds.push(addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];
  let position = Buffer.byteLength(chunks[0], 'utf8');

  objects.forEach((body, index) => {
    const object = `${index + 1} 0 obj\n${body}\nendobj\n`;
    offsets.push(position);
    chunks.push(object);
    position += Buffer.byteLength(object, 'utf8');
  });

  const xrefOffset = position;
  const xrefRows = offsets.map((offset, index) => (
    index === 0 ? '0000000000 65535 f ' : `${String(offset).padStart(10, '0')} 00000 n `
  )).join('\n');
  chunks.push(`xref\n0 ${objects.length + 1}\n${xrefRows}\ntrailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return Buffer.from(chunks.join(''), 'utf8');
}

export function buildBrandedReportPdfFromHtml(html: string, options: BrandedReportPdfOptions = {}): Buffer {
  const extracted = extractReportBlocks(html);
  const state: PdfState = {
    pages: [],
    y: 0,
    title: normalizeText(options.title || extracted.title || 'Aim4price Report'),
    tableRecordNumber: 0,
  };
  drawPageHeader(state, false);

  if (options.subtitle) drawParagraph(state, normalizeText(options.subtitle));
  let wideTableHeaders: string[] = [];
  for (const block of extracted.blocks) {
    if (block.kind === 'heading') {
      wideTableHeaders = [];
      state.tableRecordNumber = 0;
      drawHeading(state, block);
    } else if (block.kind === 'paragraph') {
      wideTableHeaders = [];
      state.tableRecordNumber = 0;
      drawParagraph(state, block.text);
    } else if (block.kind === 'keyValue') {
      wideTableHeaders = [];
      state.tableRecordNumber = 0;
      drawKeyValue(state, block.label, block.value);
    } else if (block.kind === 'tableRow') {
      if (block.header && block.values.length > 6) {
        wideTableHeaders = block.values;
        state.tableRecordNumber = 0;
        drawWideTableHeader(state, block.values);
      } else if (wideTableHeaders.length || block.values.length > 6) {
        drawWideTableRecord(state, wideTableHeaders, block.values);
      } else {
        drawTableRow(state, block.values, block.header);
      }
    } else {
      wideTableHeaders = [];
      state.tableRecordNumber = 0;
      ensureSpace(state, 14);
      drawRule(state, state.y);
      state.y -= 14;
    }
  }

  if (!extracted.blocks.length) drawParagraph(state, 'This Aim4price report contains no matching records for the selected period.');

  state.pages.forEach((commands, index) => {
    commands.push(`q 0.78 0.84 0.82 RG 0.6 w ${PAGE_MARGIN} 36 m ${PAGE_WIDTH - PAGE_MARGIN} 36 l S Q`);
    commands.push(`BT 0.24 0.36 0.32 rg /F1 8 Tf ${PAGE_MARGIN} 22 Td (${escapePdfText('Powered by Aim4price.com')}) Tj ET`);
    commands.push(`BT 0.24 0.36 0.32 rg /F1 8 Tf ${PAGE_WIDTH - PAGE_MARGIN - 66} 22 Td (${escapePdfText(`Page ${index + 1} of ${state.pages.length}`)}) Tj ET`);
  });

  return createPdfBuffer(state.pages.map((commands) => commands.join('\n')));
}
