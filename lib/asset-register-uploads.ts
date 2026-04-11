import { getDb } from './db';
import type { CabType, DriveType, TractorType } from './tractor-data';
import type { MethodKey } from './valuation-runs';
import type { Result } from './tractor-logic';

export type AssetRegisterItemKind = 'tractor' | 'manual' | 'property';
export type AssetRegisterItemMethod = MethodKey | 'manual';

export type AssetRegisterItem = {
  id: number;
  userId: string;
  valuationRunId: number | null;
  kind: AssetRegisterItemKind;
  title: string;
  value: number;
  selectedMethod: AssetRegisterItemMethod;
  selectedValueExVat: number;
  brandName: string;
  modelName: string;
  drive: DriveType | '';
  tractorType: TractorType | '';
  cab: CabType | '';
  powerKw: number | null;
  yearModel: number | null;
  hours: number | null;
  aim4priceValueExVat: number | null;
  marketMidExVat: number | null;
  departmentValueExVat: number | null;
  note: string;
  serialNumber: string;
  isFinanced: boolean;
  financeNote: string;
  photos: string[];
  createdAtIso: string;
  updatedAtIso: string;
};

export type CreateManualAssetInput = {
  kind: AssetRegisterItemKind;
  title: string;
  value: number;
  note?: string | null;
  serialNumber?: string | null;
  isFinanced?: boolean;
  financeNote?: string | null;
  photos?: string[];
};

export type UpdateAssetRegisterItemInput = {
  assetId: number;
  kind: AssetRegisterItemKind;
  title: string;
  value: number;
  note?: string | null;
  serialNumber?: string | null;
  isFinanced?: boolean;
  financeNote?: string | null;
  photos?: string[];
};

type AssetRegisterRow = {
  id: string | number;
  user_id: string | null;
  valuation_run_id: string | number | null;
  kind: string | null;
  title: string | null;
  value: string | number | null;
  selected_method: string | null;
  selected_value_ex_vat: string | number | null;
  brand_name: string | null;
  model_name: string | null;
  drive_type: string | null;
  tractor_type: string | null;
  cab_type: string | null;
  power_kw: string | number | null;
  year_model: string | number | null;
  hours: string | number | null;
  aim4price_value_ex_vat: string | number | null;
  market_mid_ex_vat: string | number | null;
  department_value_ex_vat: string | number | null;
  note: string | null;
  serial_number: string | null;
  is_financed: boolean | null;
  finance_note: string | null;
  photos: unknown;
  created_at: string | null;
  updated_at: string | null;
};

type ColumnRow = {
  column_name: string;
};

type SqlField = {
  column: string;
  value: unknown;
  cast?: string;
};

let assetRegisterColumnsPromise: Promise<Set<string>> | null = null;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => asText(entry)).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((entry) => asText(entry)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizePhotoArray(value: unknown): string[] {
  const seen = new Set<string>();
  const entries = asStringArray(value).slice(0, 12);

  return entries.filter((entry) => {
    if (!entry) return false;
    if (seen.has(entry)) return false;
    seen.add(entry);
    return true;
  });
}

function normalizeKind(value: unknown): AssetRegisterItemKind {
  return value === 'tractor' || value === 'manual' || value === 'property' ? value : 'manual';
}

function normalizeMethod(value: unknown): AssetRegisterItemMethod {
  return value === 'aim4price' || value === 'market' || value === 'department' || value === 'manual'
    ? value
    : 'manual';
}

function mapDrive(value: unknown): DriveType | '' {
  return value === '2wd' || value === '4wd' || value === 'tracks' ? value : '';
}

function mapTractorType(value: unknown): TractorType | '' {
  return value === 'field' || value === 'orchard' ? value : '';
}

function mapCab(value: unknown): CabType | '' {
  if (value === 'cab') return 'cab';
  if (value === 'open-station' || value === 'open station') return 'open-station';
  return '';
}

function buildIsoDate(value: unknown): string {
  const text = asText(value);
  return text || new Date().toISOString();
}

function mapAssetRegisterRow(row: AssetRegisterRow): AssetRegisterItem {
  const selectedValueExVat = Math.round(asNumber(row.selected_value_ex_vat) ?? asNumber(row.value) ?? 0);

  return {
    id: Number(row.id),
    userId: asText(row.user_id),
    valuationRunId: asNumber(row.valuation_run_id),
    kind: normalizeKind(row.kind),
    title: asText(row.title),
    value: Math.round(asNumber(row.value) ?? selectedValueExVat),
    selectedMethod: normalizeMethod(row.selected_method),
    selectedValueExVat,
    brandName: asText(row.brand_name),
    modelName: asText(row.model_name),
    drive: mapDrive(row.drive_type),
    tractorType: mapTractorType(row.tractor_type),
    cab: mapCab(row.cab_type),
    powerKw: asNumber(row.power_kw),
    yearModel: asNumber(row.year_model),
    hours: asNumber(row.hours),
    aim4priceValueExVat: asNumber(row.aim4price_value_ex_vat),
    marketMidExVat: asNumber(row.market_mid_ex_vat),
    departmentValueExVat: asNumber(row.department_value_ex_vat),
    note: asText(row.note),
    serialNumber: asText(row.serial_number),
    isFinanced: Boolean(row.is_financed),
    financeNote: asText(row.finance_note),
    photos: normalizePhotoArray(row.photos),
    createdAtIso: buildIsoDate(row.created_at),
    updatedAtIso: buildIsoDate(row.updated_at ?? row.created_at),
  };
}

async function getAssetRegisterColumns(): Promise<Set<string>> {
  if (!assetRegisterColumnsPromise) {
    const db = getDb();

    assetRegisterColumnsPromise = db
      .query<ColumnRow>(
        `
          select column_name
          from information_schema.columns
          where table_name = 'asset_register_items'
            and table_schema = any(current_schemas(false))
        `,
      )
      .then((result) => new Set(result.rows.map((row) => row.column_name)));
  }

  const columns = await assetRegisterColumnsPromise;

  if (!columns.size) {
    throw new Error('ASSET_REGISTER_TABLE_NOT_FOUND');
  }

  return columns;
}

function resolveColumn(columns: Set<string>, ...candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildSelectList(columns: Set<string>): string {
  const valueColumn = resolveColumn(columns, 'value', 'selected_value_ex_vat');
  const selectedValueColumn = resolveColumn(columns, 'selected_value_ex_vat', 'value');
  const selectedMethodColumn = resolveColumn(columns, 'selected_method');
  const driveColumn = resolveColumn(columns, 'drive_type', 'drive');
  const tractorTypeColumn = resolveColumn(columns, 'tractor_type');
  const cabColumn = resolveColumn(columns, 'cab_type', 'cab');
  const noteColumn = resolveColumn(columns, 'note', 'notes');
  const photosColumn = resolveColumn(columns, 'photos');
  const createdAtColumn = resolveColumn(columns, 'created_at');
  const updatedAtColumn = resolveColumn(columns, 'updated_at', 'created_at');

  const selectParts = [
    'id',
    columns.has('user_id') ? 'user_id' : `''::text as user_id`,
    columns.has('valuation_run_id') ? 'valuation_run_id' : 'null::bigint as valuation_run_id',
    columns.has('kind') ? 'kind' : `'manual'::text as kind`,
    columns.has('title') ? 'title' : `''::text as title`,
    valueColumn ? `${valueColumn} as value` : '0::numeric as value',
    selectedMethodColumn ? `${selectedMethodColumn} as selected_method` : `'manual'::text as selected_method`,
    selectedValueColumn ? `${selectedValueColumn} as selected_value_ex_vat` : '0::numeric as selected_value_ex_vat',
    columns.has('brand_name') ? 'brand_name' : 'null::text as brand_name',
    columns.has('model_name') ? 'model_name' : 'null::text as model_name',
    driveColumn ? `${driveColumn} as drive_type` : 'null::text as drive_type',
    tractorTypeColumn ? `${tractorTypeColumn} as tractor_type` : 'null::text as tractor_type',
    cabColumn ? `${cabColumn} as cab_type` : 'null::text as cab_type',
    columns.has('power_kw') ? 'power_kw' : 'null::numeric as power_kw',
    columns.has('year_model') ? 'year_model' : 'null::integer as year_model',
    columns.has('hours') ? 'hours' : 'null::integer as hours',
    columns.has('aim4price_value_ex_vat') ? 'aim4price_value_ex_vat' : 'null::numeric as aim4price_value_ex_vat',
    columns.has('market_mid_ex_vat') ? 'market_mid_ex_vat' : 'null::numeric as market_mid_ex_vat',
    columns.has('department_value_ex_vat') ? 'department_value_ex_vat' : 'null::numeric as department_value_ex_vat',
    noteColumn ? `${noteColumn} as note` : 'null::text as note',
    columns.has('serial_number') ? 'serial_number' : 'null::text as serial_number',
    columns.has('is_financed') ? 'is_financed' : 'false as is_financed',
    columns.has('finance_note') ? 'finance_note' : 'null::text as finance_note',
    photosColumn ? `${photosColumn} as photos` : `'[]'::jsonb as photos`,
    createdAtColumn ? `${createdAtColumn} as created_at` : 'now() as created_at',
    updatedAtColumn ? `${updatedAtColumn} as updated_at` : 'now() as updated_at',
  ];

  return selectParts.join(',\n        ');
}

function pushField(
  fields: SqlField[],
  columns: Set<string>,
  candidates: string[],
  value: unknown,
  cast?: string,
): void {
  const column = resolveColumn(columns, ...candidates);

  if (!column) {
    return;
  }

  fields.push({ column, value, cast });
}

function buildInsertQuery(columns: Set<string>, fields: SqlField[]): { sql: string; values: unknown[] } {
  if (!fields.length) {
    throw new Error('ASSET_CREATE_FAILED');
  }

  const values: unknown[] = [];
  const placeholders = fields.map((field, index) => {
    values.push(field.value);
    return `$${index + 1}${field.cast ?? ''}`;
  });

  return {
    sql: `
      insert into asset_register_items (
        ${fields.map((field) => field.column).join(',\n        ')}
      )
      values (
        ${placeholders.join(', ')}
      )
      returning
        ${buildSelectList(columns)}
    `,
    values,
  };
}

function buildUpdateSetClause(fields: SqlField[]): { clause: string; values: unknown[] } {
  const values: unknown[] = [];
  const clauses = fields.map((field, index) => {
    values.push(field.value);
    return `${field.column} = $${index + 3}${field.cast ?? ''}`;
  });

  return {
    clause: clauses.join(',\n        '),
    values,
  };
}

export async function getAssetRegisterItemById(userId: string, assetId: number): Promise<AssetRegisterItem | null> {
  const db = getDb();
  const columns = await getAssetRegisterColumns();
  const result = await db.query<AssetRegisterRow>(
    `
      select
        ${buildSelectList(columns)}
      from asset_register_items
      where user_id = $1 and id = $2
      limit 1
    `,
    [userId, assetId],
  );

  const row = result.rows[0];
  return row ? mapAssetRegisterRow(row) : null;
}

export async function listAssetRegisterItems(userId: string): Promise<AssetRegisterItem[]> {
  const db = getDb();
  const columns = await getAssetRegisterColumns();

  const orderColumn = resolveColumn(columns, 'updated_at', 'created_at', 'id') ?? 'id';
  const result = await db.query<AssetRegisterRow>(
    `
      select
        ${buildSelectList(columns)}
      from asset_register_items
      where user_id = $1
      order by ${orderColumn} desc, id desc
    `,
    [userId],
  );

  return result.rows.map(mapAssetRegisterRow);
}

export async function createManualAssetRegisterItem(
  userId: string,
  input: CreateManualAssetInput,
): Promise<AssetRegisterItem> {
  const db = getDb();
  const columns = await getAssetRegisterColumns();
  const now = new Date();
  const nextValue = Math.round(Number(input.value) || 0);
  const fields: SqlField[] = [];

  pushField(fields, columns, ['user_id'], userId);
  pushField(fields, columns, ['valuation_run_id'], null);
  pushField(fields, columns, ['kind'], normalizeKind(input.kind));
  pushField(fields, columns, ['title'], asText(input.title));
  pushField(fields, columns, ['value'], nextValue);
  pushField(fields, columns, ['selected_method'], 'manual');
  pushField(fields, columns, ['selected_value_ex_vat'], nextValue);
  pushField(fields, columns, ['note', 'notes'], asText(input.note) || null);
  pushField(fields, columns, ['serial_number'], asText(input.serialNumber) || null);
  pushField(fields, columns, ['is_financed'], Boolean(input.isFinanced));
  pushField(fields, columns, ['finance_note'], asText(input.financeNote) || null);
  pushField(fields, columns, ['photos'], JSON.stringify(normalizePhotoArray(input.photos ?? [])), '::jsonb');
  pushField(fields, columns, ['created_at'], now);
  pushField(fields, columns, ['updated_at'], now);

  const query = buildInsertQuery(columns, fields);
  const result = await db.query<AssetRegisterRow>(query.sql, query.values);
  const row = result.rows[0];

  if (!row) {
    throw new Error('ASSET_CREATE_FAILED');
  }

  return mapAssetRegisterRow(row);
}

export async function updateAssetRegisterItem(
  userId: string,
  input: UpdateAssetRegisterItemInput,
): Promise<AssetRegisterItem> {
  const db = getDb();
  const columns = await getAssetRegisterColumns();
  const existing = await getAssetRegisterItemById(userId, input.assetId);

  if (!existing) {
    throw new Error('ASSET_NOT_FOUND');
  }

  const now = new Date();
  const nextKind = existing.valuationRunId ? existing.kind : normalizeKind(input.kind);
  const nextValue = Math.round(Number(input.value) || 0);
  const fields: SqlField[] = [];

  pushField(fields, columns, ['kind'], nextKind);
  pushField(fields, columns, ['title'], asText(input.title));
  pushField(fields, columns, ['value'], nextValue);
  pushField(fields, columns, ['selected_value_ex_vat'], nextValue);
  pushField(fields, columns, ['note', 'notes'], asText(input.note) || null);
  pushField(fields, columns, ['serial_number'], asText(input.serialNumber) || null);
  pushField(fields, columns, ['is_financed'], Boolean(input.isFinanced));
  pushField(fields, columns, ['finance_note'], asText(input.financeNote) || null);
  pushField(fields, columns, ['photos'], JSON.stringify(normalizePhotoArray(input.photos ?? [])), '::jsonb');
  pushField(fields, columns, ['updated_at'], now);

  if (!fields.length) {
    return existing;
  }

  const update = buildUpdateSetClause(fields);
  const result = await db.query<AssetRegisterRow>(
    `
      update asset_register_items
      set
        ${update.clause}
      where user_id = $1 and id = $2
      returning
        ${buildSelectList(columns)}
    `,
    [userId, input.assetId, ...update.values],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('ASSET_UPDATE_FAILED');
  }

  return mapAssetRegisterRow(row);
}

export async function deleteAssetRegisterItem(userId: string, assetId: number): Promise<void> {
  const db = getDb();

  await db.query(
    `
      delete from asset_register_items
      where user_id = $1 and id = $2
    `,
    [userId, assetId],
  );
}

export async function createAssetRegisterItemFromValuation(input: {
  userId: string;
  valuationRunId?: number | null;
  result: Result;
  selectedMethod: MethodKey;
  selectedValueExVat: number;
  year: number;
  hours: number;
  note?: string | null;
}): Promise<AssetRegisterItem> {
  const db = getDb();
  const columns = await getAssetRegisterColumns();
  const result = input.result;
  const model = result.model;
  const title = `${model.brandName} ${model.modelName}`.trim();
  const now = new Date();
  const selectedValueExVat = Math.round(Number(input.selectedValueExVat) || 0);
  const fields: SqlField[] = [];

  pushField(fields, columns, ['user_id'], input.userId);
  pushField(fields, columns, ['valuation_run_id'], input.valuationRunId ?? null);
  pushField(fields, columns, ['kind'], 'tractor');
  pushField(fields, columns, ['title'], title);
  pushField(fields, columns, ['value'], selectedValueExVat);
  pushField(fields, columns, ['selected_method'], input.selectedMethod);
  pushField(fields, columns, ['selected_value_ex_vat'], selectedValueExVat);
  pushField(fields, columns, ['brand_name'], model.brandName);
  pushField(fields, columns, ['model_name'], model.modelName);
  pushField(fields, columns, ['drive_type', 'drive'], model.drive);
  pushField(fields, columns, ['tractor_type'], model.tractorType);
  pushField(fields, columns, ['cab_type', 'cab'], model.cab);
  pushField(fields, columns, ['power_kw'], model.powerKw);
  pushField(fields, columns, ['year_model'], Math.round(input.year));
  pushField(fields, columns, ['hours'], Math.max(0, Math.round(input.hours)));
  pushField(fields, columns, ['aim4price_value_ex_vat'], toRoundedNumber(result.aim4priceValueExVat));
  pushField(fields, columns, ['market_mid_ex_vat'], toRoundedNumber(result.marketMid));
  pushField(fields, columns, ['department_value_ex_vat'], toRoundedNumber(result.departmentValueExVat));
  pushField(fields, columns, ['note', 'notes'], asText(input.note) || null);
  pushField(fields, columns, ['photos'], JSON.stringify([]), '::jsonb');
  pushField(fields, columns, ['created_at'], now);
  pushField(fields, columns, ['updated_at'], now);

  const query = buildInsertQuery(columns, fields);
  const inserted = await db.query<AssetRegisterRow>(query.sql, query.values);
  const row = inserted.rows[0];

  if (!row) {
    throw new Error('ASSET_CREATE_FAILED');
  }

  return mapAssetRegisterRow(row);
}

function toRoundedNumber(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.round(value);
}
