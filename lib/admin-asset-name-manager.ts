import {
  listAssetRegisterItems,
  updateAssetRegisterItemNames,
  type AssetRegisterItem,
} from './asset-register-db';
import { listAssetRegisters, type AssetRegisterSummary } from './asset-registers';
import {
  createXlsxWorkbook,
  type XlsxCellValue,
  type XlsxSheet,
} from './simple-xlsx';

export type AdminAssetNameTemplateAsset = {
  assetId: string;
  registerId: string;
  publicAssetCode: string;
  registerName: string;
  assetType: string;
  serialOrVin: string;
  licenseRegistrationNumber: string;
  currentAssetTitle: string;
  currentBrand: string;
  currentModel: string;
};

export type AdminAssetNamePreviewStatus =
  | 'changed'
  | 'unchanged'
  | 'warning'
  | 'error'
  | 'committed';

export type AdminAssetNamePreviewRow = {
  rowNumber: number;
  assetId: string;
  registerId: string;
  registerName: string;
  publicAssetCode: string;
  currentAssetTitle: string;
  newAssetTitle: string;
  currentBrand: string;
  newBrand: string;
  currentModel: string;
  newModel: string;
  status: AdminAssetNamePreviewStatus;
  message: string;
};

export type AdminAssetNamePreviewSummary = {
  uploadedRows: number;
  matchedRows: number;
  changedRows: number;
  unchangedRows: number;
  skippedRows: number;
  errorRows: number;
  committedRows: number;
};

export type AdminAssetNamePreview = {
  summary: AdminAssetNamePreviewSummary;
  rows: AdminAssetNamePreviewRow[];
};

export type AdminAssetNameCommitChange = {
  assetId?: string | null;
  _asset_id?: string | null;
  registerId?: string | null;
  _register_id?: string | null;
  newAssetTitle?: string | null;
  new_asset_title?: string | null;
  newBrand?: string | null;
  new_brand?: string | null;
  newModel?: string | null;
  new_model?: string | null;
};

type CsvRow = {
  rowNumber: number;
  values: string[];
};

type CsvTable = {
  headers: string[];
  rows: CsvRow[];
};

const EXPORT_COLUMNS = [
  '_asset_id',
  '_register_id',
  '_public_asset_code',
  'register_name',
  'asset_type',
  'serial_or_vin',
  'license_registration_number',
  'current_asset_title',
  'new_asset_title',
  'current_brand',
  'new_brand',
  'current_model',
  'new_model',
] as const;

const REQUIRED_UPLOAD_COLUMNS = ['_asset_id', '_register_id'] as const;
const EDITABLE_UPLOAD_COLUMNS = ['new_asset_title', 'new_brand', 'new_model'] as const;

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function cleanCsvValue(value: unknown): string {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeader(value: unknown): string {
  return cleanCsvValue(value)
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]+/g, '')
    .replace(/_+/g, '_');
}

function isEmptyCsvRecord(values: string[]): boolean {
  return values.every((value) => cleanCsvValue(value) === '');
}

function parseCsvText(csvText: string): CsvTable {
  const text = String(csvText ?? '').replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }

      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      record.push(field);
      field = '';
      continue;
    }

    if (char === '\n') {
      record.push(field.replace(/\r$/, ''));
      records.push(record);
      record = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length > 0 || record.length > 0 || text.endsWith(',')) {
    record.push(field.replace(/\r$/, ''));
    records.push(record);
  }

  while (records.length && isEmptyCsvRecord(records[records.length - 1] ?? [])) {
    records.pop();
  }

  if (records[0]?.length === 1 && cleanCsvValue(records[0][0]).toLowerCase().startsWith('sep=')) {
    records.shift();
  }

  if (!records.length) {
    throw new Error('CSV file is empty.');
  }

  const headerRowIndex = records.findIndex((record) => {
    const normalizedHeaders = record.map(normalizeHeader);
    return REQUIRED_UPLOAD_COLUMNS.every((column) => normalizedHeaders.includes(column));
  });

  if (headerRowIndex < 0) {
    throw new Error('CSV header row not found. Keep the _asset_id and _register_id columns in the file.');
  }

  const headers = records[headerRowIndex].map(normalizeHeader);
  const rows = records
    .slice(headerRowIndex + 1)
    .map((values, index) => ({ rowNumber: headerRowIndex + index + 2, values }))
    .filter((row) => !isEmptyCsvRecord(row.values));

  return { headers, rows };
}

function buildHeaderIndex(headers: string[]): Map<string, number> {
  const index = new Map<string, number>();

  headers.forEach((header, position) => {
    if (header && !index.has(header)) {
      index.set(header, position);
    }
  });

  return index;
}

function readCsvColumn(row: CsvRow, headerIndex: Map<string, number>, headerName: string): string {
  const index = headerIndex.get(headerName);
  return typeof index === 'number' ? cleanCsvValue(row.values[index]) : '';
}

function makeAssetKey(assetId: string, registerId: string): string {
  return `${assetId}::${registerId}`;
}

function formatAssetType(item: AssetRegisterItem): string {
  const kind = cleanText(item.kind);

  if (!kind) {
    return 'Asset';
  }

  return kind
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toTemplateAsset(register: AssetRegisterSummary, item: AssetRegisterItem): AdminAssetNameTemplateAsset {
  return {
    assetId: item.id,
    registerId: item.registerId ?? register.id,
    publicAssetCode: item.publicAssetCode,
    registerName: register.businessName || 'Asset Register',
    assetType: formatAssetType(item),
    serialOrVin: item.serialNumber,
    licenseRegistrationNumber: item.licenseRegistrationNumber,
    currentAssetTitle: item.title,
    currentBrand: item.brandName,
    currentModel: item.modelName,
  };
}

function buildAssetLookup(assets: AdminAssetNameTemplateAsset[]): Map<string, AdminAssetNameTemplateAsset> {
  const lookup = new Map<string, AdminAssetNameTemplateAsset>();

  for (const asset of assets) {
    if (!asset.assetId || !asset.registerId) {
      continue;
    }

    lookup.set(makeAssetKey(asset.assetId, asset.registerId), asset);
  }

  return lookup;
}

function buildAssetIdLookup(assets: AdminAssetNameTemplateAsset[]): Map<string, AdminAssetNameTemplateAsset[]> {
  const lookup = new Map<string, AdminAssetNameTemplateAsset[]>();

  for (const asset of assets) {
    if (!asset.assetId) {
      continue;
    }

    const existing = lookup.get(asset.assetId) ?? [];
    existing.push(asset);
    lookup.set(asset.assetId, existing);
  }

  return lookup;
}

function makeSummary(rows: AdminAssetNamePreviewRow[], uploadedRows: number): AdminAssetNamePreviewSummary {
  const changedRows = rows.filter((row) => row.status === 'changed').length;
  const committedRows = rows.filter((row) => row.status === 'committed').length;
  const errorRows = rows.filter((row) => row.status === 'error').length;
  const skippedRows = rows.filter((row) => row.status === 'warning').length;
  const unchangedRows = rows.filter((row) => row.status === 'unchanged').length;

  return {
    uploadedRows,
    matchedRows: rows.length - errorRows,
    changedRows,
    unchangedRows,
    skippedRows,
    errorRows,
    committedRows,
  };
}

function compareNames(input: {
  rowNumber: number;
  asset: AdminAssetNameTemplateAsset;
  newAssetTitle: string;
  newBrand: string;
  newModel: string;
}): AdminAssetNamePreviewRow {
  const rawNewTitle = cleanCsvValue(input.newAssetTitle);
  const rawNewBrand = cleanCsvValue(input.newBrand);
  const rawNewModel = cleanCsvValue(input.newModel);
  const allEditableFieldsBlank = !rawNewTitle && !rawNewBrand && !rawNewModel;

  if (allEditableFieldsBlank) {
    return {
      rowNumber: input.rowNumber,
      assetId: input.asset.assetId,
      registerId: input.asset.registerId,
      registerName: input.asset.registerName,
      publicAssetCode: input.asset.publicAssetCode,
      currentAssetTitle: input.asset.currentAssetTitle,
      newAssetTitle: '',
      currentBrand: input.asset.currentBrand,
      newBrand: '',
      currentModel: input.asset.currentModel,
      newModel: '',
      status: 'warning',
      message: 'All editable new fields are blank. Row skipped to prevent accidental wiping.',
    };
  }

  const effectiveNewTitle = rawNewTitle || input.asset.currentAssetTitle;
  const effectiveNewBrand = rawNewBrand || input.asset.currentBrand;
  const effectiveNewModel = rawNewModel || input.asset.currentModel;
  const changed =
    effectiveNewTitle !== input.asset.currentAssetTitle ||
    effectiveNewBrand !== input.asset.currentBrand ||
    effectiveNewModel !== input.asset.currentModel;
  const hadBlankEditableField = !rawNewTitle || !rawNewBrand || !rawNewModel;

  return {
    rowNumber: input.rowNumber,
    assetId: input.asset.assetId,
    registerId: input.asset.registerId,
    registerName: input.asset.registerName,
    publicAssetCode: input.asset.publicAssetCode,
    currentAssetTitle: input.asset.currentAssetTitle,
    newAssetTitle: effectiveNewTitle,
    currentBrand: input.asset.currentBrand,
    newBrand: effectiveNewBrand,
    currentModel: input.asset.currentModel,
    newModel: effectiveNewModel,
    status: changed ? 'changed' : 'unchanged',
    message: changed && hadBlankEditableField ? 'Blank editable fields were kept unchanged.' : '',
  };
}

function errorPreviewRow(input: {
  rowNumber: number;
  assetId?: string;
  registerId?: string;
  message: string;
}): AdminAssetNamePreviewRow {
  return {
    rowNumber: input.rowNumber,
    assetId: cleanText(input.assetId),
    registerId: cleanText(input.registerId),
    registerName: '',
    publicAssetCode: '',
    currentAssetTitle: '',
    newAssetTitle: '',
    currentBrand: '',
    newBrand: '',
    currentModel: '',
    newModel: '',
    status: 'error',
    message: input.message,
  };
}

export async function listAdminAssetNameTemplateAssets(
  userId: string,
): Promise<AdminAssetNameTemplateAsset[]> {
  const registers = await listAssetRegisters(userId);
  const bundles = await Promise.all(
    registers.map(async (register) => {
      const items = await listAssetRegisterItems(userId, register.id);
      return items.map((item) => toTemplateAsset(register, item));
    }),
  );

  return bundles
    .flat()
    .filter((asset) => asset.assetId && asset.registerId)
    .sort((left, right) => {
      const registerCompare = left.registerName.localeCompare(right.registerName);
      if (registerCompare !== 0) return registerCompare;
      return left.currentAssetTitle.localeCompare(right.currentAssetTitle);
    });
}

export async function createAdminAssetNameTemplateWorkbook(userId: string): Promise<Buffer> {
  const assets = await listAdminAssetNameTemplateAssets(userId);
  const headerRow: XlsxCellValue[] = EXPORT_COLUMNS.map((column) => ({
    value: column,
    style: 'tableHeader',
  }));
  const dataRows: XlsxCellValue[][] = assets.map((asset) => [
    asset.assetId,
    asset.registerId,
    asset.publicAssetCode,
    asset.registerName,
    asset.assetType,
    asset.serialOrVin,
    asset.licenseRegistrationNumber,
    asset.currentAssetTitle,
    asset.currentAssetTitle,
    asset.currentBrand,
    asset.currentBrand,
    asset.currentModel,
    asset.currentModel,
  ]);
  const rows: XlsxCellValue[][] = [
    [{ value: 'Aim4price Asset Name Manager', style: 'title' }],
    [{ value: 'Admin-only rename template. Edit only the new_asset_title, new_brand and new_model columns.', style: 'subtitle' }],
    [],
    [
      { value: 'Do not edit', style: 'metaLabel' },
      { value: '_asset_id and _register_id. The import matches by database IDs only.', style: 'metaValue' },
    ],
    [
      { value: 'Editable fields', style: 'metaLabel' },
      { value: 'new_asset_title, new_brand, new_model', style: 'metaValue' },
    ],
    [],
    headerRow,
    ...dataRows,
  ];
  const sheet: XlsxSheet = {
    name: 'Asset Name Manager',
    rows,
    columns: [
      34,
      34,
      24,
      26,
      18,
      22,
      26,
      34,
      34,
      22,
      22,
      26,
      26,
    ],
    merges: [
      { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 13 },
      { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 13 },
    ],
    freezeRow: 7,
    autoFilter: {
      fromRow: 7,
      fromColumn: 1,
      toRow: Math.max(7, rows.length),
      toColumn: EXPORT_COLUMNS.length,
    },
    tabColor: '174D3E',
  };

  return createXlsxWorkbook([sheet]);
}

export function buildAdminAssetNameTemplateFileName(email: string): string {
  const safeEmail = cleanText(email)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `aim4price-${safeEmail || 'user'}-asset-name-template.xlsx`;
}

export async function previewAdminAssetNameCsv(
  userId: string,
  csvText: string,
): Promise<AdminAssetNamePreview> {
  const table = parseCsvText(csvText);
  const headerIndex = buildHeaderIndex(table.headers);
  const missingRequiredColumns = [
    ...REQUIRED_UPLOAD_COLUMNS,
    ...EDITABLE_UPLOAD_COLUMNS,
  ].filter((column) => !headerIndex.has(column));

  if (missingRequiredColumns.length) {
    throw new Error(`CSV is missing required column(s): ${missingRequiredColumns.join(', ')}.`);
  }

  const assets = await listAdminAssetNameTemplateAssets(userId);
  const assetLookup = buildAssetLookup(assets);
  const assetIdLookup = buildAssetIdLookup(assets);
  const rows = table.rows.map((row) => {
    const assetId = readCsvColumn(row, headerIndex, '_asset_id');
    const registerId = readCsvColumn(row, headerIndex, '_register_id');

    if (!assetId || !registerId) {
      return errorPreviewRow({
        rowNumber: row.rowNumber,
        assetId,
        registerId,
        message: 'Missing _asset_id or _register_id.',
      });
    }

    const asset = assetLookup.get(makeAssetKey(assetId, registerId));

    if (!asset) {
      const possibleAssetMatches = assetIdLookup.get(assetId) ?? [];
      const message = possibleAssetMatches.length
        ? 'The _register_id does not match this asset’s saved register.'
        : '_asset_id does not belong to the selected user.';

      return errorPreviewRow({ rowNumber: row.rowNumber, assetId, registerId, message });
    }

    return compareNames({
      rowNumber: row.rowNumber,
      asset,
      newAssetTitle: readCsvColumn(row, headerIndex, 'new_asset_title'),
      newBrand: readCsvColumn(row, headerIndex, 'new_brand'),
      newModel: readCsvColumn(row, headerIndex, 'new_model'),
    });
  });

  return {
    summary: makeSummary(rows, table.rows.length),
    rows,
  };
}

export async function commitAdminAssetNameChanges(
  userId: string,
  changes: AdminAssetNameCommitChange[],
): Promise<AdminAssetNamePreview> {
  const safeChanges = Array.isArray(changes) ? changes.slice(0, 5000) : [];
  const assets = await listAdminAssetNameTemplateAssets(userId);
  const assetLookup = buildAssetLookup(assets);
  const assetIdLookup = buildAssetIdLookup(assets);
  const rows: AdminAssetNamePreviewRow[] = [];

  for (const [index, change] of safeChanges.entries()) {
    const rowNumber = index + 1;
    const assetId = cleanText(change.assetId ?? change._asset_id);
    const registerId = cleanText(change.registerId ?? change._register_id);

    if (!assetId || !registerId) {
      rows.push(errorPreviewRow({
        rowNumber,
        assetId,
        registerId,
        message: 'Missing _asset_id or _register_id.',
      }));
      continue;
    }

    const asset = assetLookup.get(makeAssetKey(assetId, registerId));

    if (!asset) {
      const possibleAssetMatches = assetIdLookup.get(assetId) ?? [];
      rows.push(errorPreviewRow({
        rowNumber,
        assetId,
        registerId,
        message: possibleAssetMatches.length
          ? 'The _register_id does not match this asset’s saved register.'
          : '_asset_id does not belong to the selected user.',
      }));
      continue;
    }

    const previewRow = compareNames({
      rowNumber,
      asset,
      newAssetTitle: cleanText(change.newAssetTitle ?? change.new_asset_title),
      newBrand: cleanText(change.newBrand ?? change.new_brand),
      newModel: cleanText(change.newModel ?? change.new_model),
    });

    if (previewRow.status !== 'changed') {
      rows.push(previewRow);
      continue;
    }

    try {
      const updated = await updateAssetRegisterItemNames(userId, {
        assetId,
        registerId,
        title: previewRow.newAssetTitle,
        brandName: previewRow.newBrand,
        modelName: previewRow.newModel,
      });

      rows.push({
        ...previewRow,
        currentAssetTitle: asset.currentAssetTitle,
        newAssetTitle: updated.title,
        currentBrand: asset.currentBrand,
        newBrand: updated.brandName,
        currentModel: asset.currentModel,
        newModel: updated.modelName,
        status: 'committed',
        message: 'Name changes committed.',
      });
    } catch (error) {
      rows.push({
        ...previewRow,
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update this asset.',
      });
    }
  }

  return {
    summary: makeSummary(rows, safeChanges.length),
    rows,
  };
}
