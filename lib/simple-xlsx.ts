export type XlsxPrimitiveCellValue = string | number | boolean | Date | null | undefined;

export type XlsxCellStyle =
  | 'default'
  | 'title'
  | 'subtitle'
  | 'metaLabel'
  | 'metaValue'
  | 'section'
  | 'tableHeader'
  | 'text'
  | 'muted'
  | 'integer'
  | 'decimal'
  | 'currency'
  | 'date'
  | 'percent'
  | 'statusGood'
  | 'statusWarn'
  | 'statusBad'
  | 'statusInfo'
  | 'note'
  | 'year'
  | 'link'
  | 'dateTime';

export type XlsxStyledCell = {
  value?: XlsxPrimitiveCellValue;
  formula?: string;
  style?: XlsxCellStyle;
  hyperlink?: string;
};

export type XlsxCellValue = XlsxPrimitiveCellValue | XlsxStyledCell;

export type XlsxMergeRange = {
  fromRow: number;
  fromColumn: number;
  toRow: number;
  toColumn: number;
};

export type XlsxAutoFilterRange = {
  fromRow: number;
  fromColumn: number;
  toRow: number;
  toColumn: number;
};

export type XlsxSheet = {
  name: string;
  rows: XlsxCellValue[][];
  columns?: Array<number | null | undefined>;
  merges?: XlsxMergeRange[];
  freezeRow?: number;
  autoFilter?: XlsxAutoFilterRange;
  tabColor?: string;
  orientation?: 'portrait' | 'landscape';
};

type ZipEntry = {
  name: string;
  data: Buffer;
  crc32: number;
  offset: number;
};

const CELL_STYLE_IDS: Record<XlsxCellStyle, number> = {
  default: 0,
  title: 1,
  subtitle: 2,
  metaLabel: 3,
  metaValue: 4,
  section: 5,
  tableHeader: 6,
  text: 7,
  muted: 8,
  integer: 9,
  decimal: 10,
  currency: 11,
  date: 12,
  percent: 13,
  statusGood: 14,
  statusWarn: 15,
  statusBad: 16,
  note: 17,
  statusInfo: 18,
  year: 19,
  link: 20,
  dateTime: 21,
};

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeSheetName(value: string, usedNames: Set<string>): string {
  const cleaned = (value || 'Sheet')
    .replace(/[\\/*?:\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31) || 'Sheet';

  let candidate = cleaned;
  let counter = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = ` ${counter}`;
    const base = cleaned.slice(0, Math.max(1, 31 - suffix.length)).trim();
    candidate = `${base}${suffix}`;
    counter += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function excelColumnName(index: number): string {
  let column = '';
  let current = Math.max(1, Math.floor(index));

  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }

  return column;
}

function cellReference(row: number, column: number): string {
  return `${excelColumnName(column)}${row}`;
}

function rangeReference(range: XlsxMergeRange | XlsxAutoFilterRange): string {
  return `${cellReference(range.fromRow, range.fromColumn)}:${cellReference(range.toRow, range.toColumn)}`;
}

function normalizeCellText(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

function isStyledCell(value: XlsxCellValue): value is XlsxStyledCell {
  return (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Date) &&
    !Array.isArray(value) &&
    ('value' in value || 'formula' in value || 'style' in value || 'hyperlink' in value)
  );
}

function normalizeCell(value: XlsxCellValue): XlsxStyledCell {
  return isStyledCell(value) ? value : { value };
}

function styleAttribute(style?: XlsxCellStyle): string {
  const styleId = CELL_STYLE_IDS[style ?? 'default'] ?? 0;
  return styleId > 0 ? ` s="${styleId}"` : '';
}

function excelSerialDate(value: Date): number {
  return (value.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000;
}

function valueToCellValueXml(value: XlsxPrimitiveCellValue): string {
  if (value === null || typeof value === 'undefined') {
    return '';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<v>${value}</v>`;
  }

  if (typeof value === 'boolean') {
    return `<v>${value ? 1 : 0}</v>`;
  }

  if (value instanceof Date) {
    return `<v>${excelSerialDate(value)}</v>`;
  }

  return `<is><t xml:space="preserve">${escapeXml(normalizeCellText(String(value)))}</t></is>`;
}

function cellTypeAttribute(value: XlsxPrimitiveCellValue, hasFormula: boolean): string {
  if (hasFormula) {
    return '';
  }

  if (typeof value === 'boolean') {
    return ' t="b"';
  }

  if (typeof value === 'string') {
    return ' t="inlineStr"';
  }

  return '';
}

function toCellXml(input: XlsxCellValue, reference: string): string {
  const cell = normalizeCell(input);
  const value = cell.value;
  const formula = String(cell.formula ?? '').trim();
  const hasFormula = Boolean(formula);
  const hasValue = !(value === null || typeof value === 'undefined');
  const hasStyle = Boolean((cell.style && cell.style !== 'default') || normalizeHyperlink(cell.hyperlink));

  if (!hasFormula && !hasValue && !hasStyle) {
    return '';
  }

  const typeAttribute = cellTypeAttribute(value, hasFormula);
  const style = styleAttribute(cell.style ?? (normalizeHyperlink(cell.hyperlink) ? 'link' : undefined));

  if (hasFormula) {
    const cachedValueXml = hasValue ? valueToCellValueXml(value) : '';
    return `<c r="${reference}"${style}><f>${escapeXml(formula)}</f>${cachedValueXml}</c>`;
  }

  if (!hasValue) {
    return `<c r="${reference}"${style}/>`;
  }

  return `<c r="${reference}"${typeAttribute}${style}>${valueToCellValueXml(value)}</c>`;
}

function estimateColumnWidth(value: XlsxCellValue): number {
  const cell = normalizeCell(value);
  const rawValue = cell.value;

  if (rawValue === null || typeof rawValue === 'undefined') return 0;
  if (typeof rawValue === 'number') return String(Math.round(rawValue)).length + 3;
  if (typeof rawValue === 'boolean') return 8;
  if (rawValue instanceof Date) return cell.style === 'dateTime' ? 22 : 14;

  const longestLine = String(rawValue)
    .split(/\r\n|\r|\n/)
    .reduce((longest, line) => Math.max(longest, line.length), 0);

  return Math.min(54, Math.max(8, longestLine + 2));
}

function buildColumnsXml(rows: XlsxCellValue[][], configuredWidths: XlsxSheet['columns']): string {
  const columnWidths: number[] = [];

  rows.forEach((row) => {
    row.forEach((value, index) => {
      columnWidths[index] = Math.max(columnWidths[index] ?? 0, estimateColumnWidth(value));
    });
  });

  configuredWidths?.forEach((width, index) => {
    if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
      columnWidths[index] = Math.max(columnWidths[index] ?? 0, width);
    }
  });

  if (!columnWidths.length) {
    return '';
  }

  return `<cols>${columnWidths
    .map((width, index) => {
      const safeWidth = Math.min(64, Math.max(8, width || 10));
      return `<col min="${index + 1}" max="${index + 1}" width="${safeWidth}" customWidth="1"/>`;
    })
    .join('')}</cols>`;
}

function buildSheetViewsXml(sheet: XlsxSheet): string {
  const color = String(sheet.tabColor ?? '').replace(/[^a-fA-F0-9]/g, '').slice(0, 6);
  const tabColorXml = color ? `<tabColor rgb="FF${color.toUpperCase()}"/>` : '';
  const freezeRow = Math.max(0, Math.floor(Number(sheet.freezeRow ?? 0)));

  if (freezeRow > 0) {
    const topLeftCell = cellReference(freezeRow + 1, 1);
    return `<sheetViews><sheetView workbookViewId="0" tabSelected="0">${tabColorXml}<pane ySplit="${freezeRow}" topLeftCell="${topLeftCell}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="${topLeftCell}" sqref="${topLeftCell}"/></sheetView></sheetViews>`;
  }

  return `<sheetViews><sheetView workbookViewId="0">${tabColorXml}</sheetView></sheetViews>`;
}

function buildMergeCellsXml(merges: XlsxMergeRange[] | undefined): string {
  const safeMerges = (merges ?? []).filter(
    (merge) =>
      merge.fromRow > 0 &&
      merge.fromColumn > 0 &&
      merge.toRow >= merge.fromRow &&
      merge.toColumn >= merge.fromColumn &&
      (merge.toRow > merge.fromRow || merge.toColumn > merge.fromColumn),
  );

  if (!safeMerges.length) {
    return '';
  }

  return `<mergeCells count="${safeMerges.length}">${safeMerges
    .map((merge) => `<mergeCell ref="${rangeReference(merge)}"/>`)
    .join('')}</mergeCells>`;
}

function buildAutoFilterXml(autoFilter: XlsxSheet['autoFilter']): string {
  if (!autoFilter) {
    return '';
  }

  if (
    autoFilter.fromRow < 1 ||
    autoFilter.fromColumn < 1 ||
    autoFilter.toRow < autoFilter.fromRow ||
    autoFilter.toColumn < autoFilter.fromColumn
  ) {
    return '';
  }

  return `<autoFilter ref="${rangeReference(autoFilter)}"/>`;
}

type XlsxHyperlink = {
  reference: string;
  target: string;
};

function normalizeHyperlink(value: unknown): string {
  const candidate = String(value ?? '').trim();
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function collectHyperlinks(rows: XlsxCellValue[][]): XlsxHyperlink[] {
  const hyperlinks: XlsxHyperlink[] = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((input, columnIndex) => {
      const target = normalizeHyperlink(normalizeCell(input).hyperlink);
      if (!target) return;

      hyperlinks.push({
        reference: cellReference(rowIndex + 1, columnIndex + 1),
        target,
      });
    });
  });

  return hyperlinks;
}

function buildHyperlinksXml(hyperlinks: XlsxHyperlink[]): string {
  if (!hyperlinks.length) return '';

  return `<hyperlinks>${hyperlinks
    .map((hyperlink, index) => `<hyperlink ref="${hyperlink.reference}" r:id="rId${index + 1}"/>`)
    .join('')}</hyperlinks>`;
}

function buildWorksheetRelationshipsXml(hyperlinks: XlsxHyperlink[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${hyperlinks
    .map((hyperlink, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(hyperlink.target)}" TargetMode="External"/>`)
    .join('')}
</Relationships>`;
}

function buildWorksheetXml(sheet: XlsxSheet, hyperlinks: XlsxHyperlink[]): string {
  const rows = sheet.rows ?? [];
  const maxColumnCount = Math.max(1, ...rows.map((row) => row.length), sheet.columns?.length ?? 0);
  const maxRowCount = Math.max(1, rows.length);
  const dimension = `A1:${cellReference(maxRowCount, maxColumnCount)}`;
  const colsXml = buildColumnsXml(rows, sheet.columns);
  const sheetViewsXml = buildSheetViewsXml(sheet);
  const mergesXml = buildMergeCellsXml(sheet.merges);
  const autoFilterXml = buildAutoFilterXml(sheet.autoFilter);
  const hyperlinksXml = buildHyperlinksXml(hyperlinks);
  const orientation = sheet.orientation === 'portrait' ? 'portrait' : 'landscape';

  const rowsXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const rowHeight = rowNumber === 1 ? ' ht="26" customHeight="1"' : rowNumber === 11 ? ' ht="24" customHeight="1"' : '';
      const cells = row
        .map((value, colIndex) => toCellXml(value, cellReference(rowNumber, colIndex + 1)))
        .filter(Boolean)
        .join('');

      return `<row r="${rowNumber}"${rowHeight}>${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1" autoPageBreaks="0"/></sheetPr>
  <dimension ref="${dimension}"/>
  ${sheetViewsXml}
  <sheetFormatPr defaultRowHeight="17"/>
  ${colsXml}
  <sheetData>${rowsXml}</sheetData>
  ${autoFilterXml}
  ${mergesXml}
  ${hyperlinksXml}
  <pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
  <pageSetup orientation="${orientation}" paperSize="9" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

function buildContentTypes(sheetCount: number): string {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, index) => {
    const sheetNumber = index + 1;
    return `<Override PartName="/xl/worksheets/sheet${sheetNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`;
}

function buildRootRelationships(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function buildWorkbookXml(sheetNames: string[]): string {
  const sheetsXml = sheetNames
    .map(
      (name, index) =>
        `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr date1904="false"/>
  <sheets>${sheetsXml}</sheets>
  <calcPr calcId="0" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>`;
}

function buildWorkbookRelationships(sheetCount: number): string {
  const relationships = Array.from({ length: sheetCount }, (_, index) => {
    const sheetNumber = index + 1;
    return `<Relationship Id="rId${sheetNumber}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetNumber}.xml"/>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relationships}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildStylesXml(): string {
  const accountingRandFormat = '_-"R" * #,##0_-;[Red]_-"R" * -#,##0_-;_-"R" * "-"_-;_-@_-';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="5">
    <numFmt numFmtId="164" formatCode="${escapeXml(accountingRandFormat)}"/>
    <numFmt numFmtId="165" formatCode="#,##0.##"/>
    <numFmt numFmtId="166" formatCode="dd mmm yyyy"/>
    <numFmt numFmtId="167" formatCode="0%"/>
    <numFmt numFmtId="168" formatCode="dd mmm yyyy hh:mm"/>
  </numFmts>
  <fonts count="10">
    <font><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="18"/><color rgb="FF05070C"/><name val="Calibri"/><family val="2"/></font>
    <font><sz val="10"/><color rgb="FF5D6675"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF0F6A46"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF8A6500"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFA3271B"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF0369A1"/><name val="Calibri"/><family val="2"/></font>
    <font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="9">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF10382F"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F6F5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE3F3EA"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF1CD"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFDE1DE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8F4EF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE0F2FE"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD9E4DF"/></left>
      <right style="thin"><color rgb="FFD9E4DF"/></right>
      <top style="thin"><color rgb="FFD9E4DF"/></top>
      <bottom style="thin"><color rgb="FFD9E4DF"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="22">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" wrapText="1" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment wrapText="1" vertical="top"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment wrapText="1" vertical="top"/></xf>
    <xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment wrapText="1" vertical="top"/></xf>
    <xf numFmtId="0" fontId="8" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="9" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment wrapText="1" vertical="top"/></xf>
    <xf numFmtId="168" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

function buildCoreXml(): string {
  const createdIso = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Aim4price Asset Register</dc:title>
  <dc:creator>Aim4price</dc:creator>
  <cp:lastModifiedBy>Aim4price</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${createdIso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${createdIso}</dcterms:modified>
</cp:coreProperties>`;
}

function buildAppXml(sheetNames: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Aim4price</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>${sheetNames.length}</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="${sheetNames.length}" baseType="lpstr">
      ${sheetNames.map((name) => `<vt:lpstr>${escapeXml(name)}</vt:lpstr>`).join('')}
    </vt:vector>
  </TitlesOfParts>
  <Company>Aim4price</Company>
</Properties>`;
}

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries: Array<{ name: string; data: string | Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  const zipEntries: ZipEntry[] = entries.map((entry) => {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    return {
      name: entry.name,
      data,
      crc32: crc32(data),
      offset: 0,
    };
  });

  zipEntries.forEach((entry) => {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    entry.offset = offset;

    const localHeader = Buffer.alloc(30 + nameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(entry.crc32, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuffer.copy(localHeader, 30);

    localParts.push(localHeader, entry.data);
    offset += localHeader.length + entry.data.length;

    const centralHeader = Buffer.alloc(46 + nameBuffer.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(entry.crc32, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(entry.offset, 42);
    nameBuffer.copy(centralHeader, 46);

    centralParts.push(centralHeader);
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = localParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(zipEntries.length, 8);
  endRecord.writeUInt16LE(zipEntries.length, 10);
  endRecord.writeUInt32LE(centralSize, 12);
  endRecord.writeUInt32LE(centralOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, endRecord]);
}

export function createXlsxWorkbook(sheets: XlsxSheet[]): Buffer {
  const usedNames = new Set<string>();
  const safeSheets = sheets.length ? sheets : [{ name: 'Asset Register', rows: [] }];
  const sheetNames = safeSheets.map((sheet) => sanitizeSheetName(sheet.name, usedNames));

  const entries: Array<{ name: string; data: string | Buffer }> = [
    { name: '[Content_Types].xml', data: buildContentTypes(safeSheets.length) },
    { name: '_rels/.rels', data: buildRootRelationships() },
    { name: 'docProps/core.xml', data: buildCoreXml() },
    { name: 'docProps/app.xml', data: buildAppXml(sheetNames) },
    { name: 'xl/workbook.xml', data: buildWorkbookXml(sheetNames) },
    { name: 'xl/_rels/workbook.xml.rels', data: buildWorkbookRelationships(safeSheets.length) },
    { name: 'xl/styles.xml', data: buildStylesXml() },
  ];

  safeSheets.forEach((sheet, index) => {
    const hyperlinks = collectHyperlinks(sheet.rows ?? []);
    entries.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: buildWorksheetXml(sheet, hyperlinks),
    });

    if (hyperlinks.length) {
      entries.push({
        name: `xl/worksheets/_rels/sheet${index + 1}.xml.rels`,
        data: buildWorksheetRelationshipsXml(hyperlinks),
      });
    }
  });

  return createZip(entries);
}
