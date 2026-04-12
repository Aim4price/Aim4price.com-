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

type ColumnMetaRow = {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
};

type TableSchema = {
  columnNames: Set<string>;
  columns: Map<string, ColumnMetaRow>;
};

type SqlField = {
  column: string;
  value: unknown;
  cast?: string;
};

let assetRegisterSchemaPromise: Promise<TableSchema> | null = null;

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
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'tractor' || normalized === 'equipment') return 'tractor';
  if (normalized === 'property') return 'property';
  return 'manual';
}

function normalizeMethod(value: unknown): AssetRegisterItemMethod {
  const normalized = String(value ?? '').trim().toLowerCase();

  return normalized === 'aim4price' ||
    normalized === 'market' ||
    normalized === 'department' ||
    normalized === 'manual'
    ? normalized
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
  const selectedValueExVat = Math.round(
    asNumber(row.selected_value_ex_vat) ?? asNumber(row.value) ?? 0,
  );

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

async function getAssetRegisterSchema(): Promise<TableSchema> {
  if (!assetRegisterSchemaPromise) {
    const db = getDb();

    assetRegisterSchemaPromise = db
      .query<ColumnMetaRow>(
        `
          select
            column_name,
            data_type,
            udt_name,
            is_nullable,
            column_default
          from information_schema.columns
          where table_name = 'asset_register_items'
            and table_schema = any(current_schemas(false))
        `,
      )
      .then((result) => ({
        columnNames: new Set(result.rows.map((row) => row.column_name)),
        columns: new Map(result.rows.map((row) => [row.column_name, row])),
      }));
  }

  const schema = await assetRegisterSchemaPromise;

  if (!schema.columnNames.size) {
    throw new Error('ASSET_REGISTER_TABLE_NOT_FOUND');
  }

  return schema;
}

function resolveColumn(schema: TableSchema, ...candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (schema.columnNames.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getColumnMeta(schema: TableSchema, ...candidates: string[]): ColumnMetaRow | null {
  const column = resolveColumn(schema, ...candidates);
  return column ? schema.columns.get(column) ?? null : null;
}

function isArrayColumn(meta: ColumnMetaRow | null): boolean {
  return Boolean(meta && (meta.data_type === 'ARRAY' || meta.udt_name.startsWith('_')));
}

function isJsonColumn(meta: ColumnMetaRow | null): boolean {
  return Boolean(meta && (meta.data_type === 'json' || meta.data_type === 'jsonb'));
}

function buildSelectList(schema: TableSchema): string {
  const userIdColumn = resolveColumn(schema, 'user_id');
  const valuationRunIdColumn = resolveColumn(schema, 'valuation_run_id', 'run_id');
  const kindColumn = resolveColumn(schema, 'kind', 'equipment_type', 'asset_type', 'item_type');
  const titleColumn = resolveColumn(schema, 'title', 'name', 'asset_name');
  const valueColumn = resolveColumn(
    schema,
    'value',
    'selected_value_ex_vat',
    'selected_value',
    'saved_value_ex_vat',
  );
  const selectedMethodColumn = resolveColumn(schema, 'selected_method', 'method', 'valuation_method');
  const selectedValueColumn = resolveColumn(
    schema,
    'selected_value_ex_vat',
    'selected_value',
    'value',
    'saved_value_ex_vat',
  );
  const brandColumn = resolveColumn(schema, 'brand_name', 'brand');
  const modelColumn = resolveColumn(schema, 'model_name', 'model');
  const driveColumn = resolveColumn(schema, 'drive_type', 'drive', 'drivetrain');
  const tractorTypeColumn = resolveColumn(schema, 'tractor_type', 'tractor_category');
  const cabColumn = resolveColumn(schema, 'cab_type', 'cab');
  const powerColumn = resolveColumn(schema, 'power_kw', 'kw', 'power');
  const yearColumn = resolveColumn(schema, 'year_model', 'year');
  const hoursColumn = resolveColumn(schema, 'hours', 'engine_hours');
  const aim4priceColumn = resolveColumn(schema, 'aim4price_value_ex_vat', 'aim4price_value');
  const marketColumn = resolveColumn(schema, 'market_mid_ex_vat', 'market_value_ex_vat', 'market_value');
  const departmentColumn = resolveColumn(
    schema,
    'department_value_ex_vat',
    'department_value',
    'dalrrd_value_ex_vat',
  );
  const noteColumn = resolveColumn(schema, 'note', 'notes', 'description');
  const serialColumn = resolveColumn(schema, 'serial_number', 'serial', 'vin');
  const financedColumn = resolveColumn(schema, 'is_financed', 'financed');
  const financeNoteColumn = resolveColumn(schema, 'finance_note', 'finance_notes', 'finance_status');
  const photosColumn = resolveColumn(schema, 'photos', 'photo_urls', 'image_urls', 'images');
  const createdAtColumn = resolveColumn(schema, 'created_at', 'createdon', 'created');
  const updatedAtColumn = resolveColumn(schema, 'updated_at', 'modified_at', 'updatedon', 'created_at');

  const selectParts = [
    'id',
    userIdColumn ? `${userIdColumn} as user_id` : `''::text as user_id`,
    valuationRunIdColumn ? `${valuationRunIdColumn} as valuation_run_id` : 'null::bigint as valuation_run_id',
    kindColumn ? `${kindColumn} as kind` : `'manual'::text as kind`,
    titleColumn ? `${titleColumn} as title` : `''::text as title`,
    valueColumn ? `${valueColumn} as value` : '0::numeric as value',
    selectedMethodColumn ? `${selectedMethodColumn} as selected_method` : `'manual'::text as selected_method`,
    selectedValueColumn ? `${selectedValueColumn} as selected_value_ex_vat` : '0::numeric as selected_value_ex_vat',
    brandColumn ? `${brandColumn} as brand_name` : 'null::text as brand_name',
    modelColumn ? `${modelColumn} as model_name` : 'null::text as model_name',
    driveColumn ? `${driveColumn} as drive_type` : 'null::text as drive_type',
    tractorTypeColumn ? `${tractorTypeColumn} as tractor_type` : 'null::text as tractor_type',
    cabColumn ? `${cabColumn} as cab_type` : 'null::text as cab_type',
    powerColumn ? `${powerColumn} as power_kw` : 'null::numeric as power_kw',
    yearColumn ? `${yearColumn} as year_model` : 'null::integer as year_model',
    hoursColumn ? `${hoursColumn} as hours` : 'null::integer as hours',
    aim4priceColumn ? `${aim4priceColumn} as aim4price_value_ex_vat` : 'null::numeric as aim4price_value_ex_vat',
    marketColumn ? `${marketColumn} as market_mid_ex_vat` : 'null::numeric as market_mid_ex_vat',
    departmentColumn ? `${departmentColumn} as department_value_ex_vat` : 'null::numeric as department_value_ex_vat',
    noteColumn ? `${noteColumn} as note` : 'null::text as note',
    serialColumn ? `${serialColumn} as serial_number` : 'null::text as serial_number',
    financedColumn ? `${financedColumn} as is_financed` : 'false as is_financed',
    financeNoteColumn ? `${financeNoteColumn} as finance_note` : 'null::text as finance_note',
    photosColumn ? `${photosColumn} as photos` : `'[]'::jsonb as photos`,
    createdAtColumn ? `${createdAtColumn} as created_at` : 'now() as created_at',
    updatedAtColumn ? `${updatedAtColumn} as updated_at` : 'now() as updated_at',
  ];

  return selectParts.join(',\n        ');
}

function pushField(
  fields: SqlField[],
  schema: TableSchema,
  candidates: string[],
  value: unknown,
  cast?: string,
): void {
  const column = resolveColumn(schema, ...candidates);

  if (!column) {
    return;
  }

  fields.push({ column, value, cast });
}

function pushPhotoField(fields: SqlField[], schema: TableSchema, photos: string[]): void {
  const meta = getColumnMeta(schema, 'photos', 'photo_urls', 'image_urls', 'images');
  if (!meta) {
    return;
  }

  const normalized = normalizePhotoArray(photos);

  if (isArrayColumn(meta)) {
    fields.push({ column: meta.column_name, value: normalized, cast: '::text[]' });
    return;
  }

  if (isJsonColumn(meta)) {
    fields.push({
      column: meta.column_name,
      value: JSON.stringify(normalized),
      cast: meta.data_type === 'jsonb' ? '::jsonb' : '::json',
    });
    return;
  }

  fields.push({ column: meta.column_name, value: JSON.stringify(normalized) });
}

function buildInsertQuery(schema: TableSchema, fields: SqlField[]): { sql: string; values: unknown[] } {
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
        ${buildSelectList(schema)}
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
  const schema = await getAssetRegisterSchema();
  const result = await db.query<AssetRegisterRow>(
    `
      select
        ${buildSelectList(schema)}
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
  const schema = await getAssetRegisterSchema();

  const orderColumn = resolveColumn(schema, 'updated_at', 'created_at', 'id') ?? 'id';
  const result = await db.query<AssetRegisterRow>(
    `
      select
        ${buildSelectList(schema)}
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
  const schema = await getAssetRegisterSchema();
  const now = new Date();
  const nextValue = Math.round(Number(input.value) || 0);
  const fields: SqlField[] = [];

  pushField(fields, schema, ['user_id'], userId);
  pushField(fields, schema, ['valuation_run_id', 'run_id'], null);
  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], normalizeKind(input.kind));
  pushField(fields, schema, ['title', 'name', 'asset_name'], asText(input.title));
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], nextValue);
  pushField(fields, schema, ['selected_method', 'method', 'valuation_method'], 'manual');
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], nextValue);
  pushField(fields, schema, ['source', 'origin', 'entry_source'], 'manual');
  pushField(fields, schema, ['note', 'notes', 'description'], asText(input.note) || null);
  pushField(fields, schema, ['serial_number', 'serial', 'vin'], asText(input.serialNumber) || null);
  pushField(fields, schema, ['is_financed', 'financed'], Boolean(input.isFinanced));
  pushField(fields, schema, ['finance_note', 'finance_notes', 'finance_status'], asText(input.financeNote) || null);
  pushPhotoField(fields, schema, input.photos ?? []);
  pushField(fields, schema, ['created_at', 'createdon', 'created'], now);
  pushField(fields, schema, ['updated_at', 'modified_at', 'updatedon'], now);

  const query = buildInsertQuery(schema, fields);
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
  const schema = await getAssetRegisterSchema();
  const existing = await getAssetRegisterItemById(userId, input.assetId);

  if (!existing) {
    throw new Error('ASSET_NOT_FOUND');
  }

  const now = new Date();
  const nextKind = existing.valuationRunId ? existing.kind : normalizeKind(input.kind);
  const nextValue = Math.round(Number(input.value) || 0);
  const fields: SqlField[] = [];

  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], nextKind);
  pushField(fields, schema, ['title', 'name', 'asset_name'], asText(input.title));
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], nextValue);
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], nextValue);
  pushField(fields, schema, ['note', 'notes', 'description'], asText(input.note) || null);
  pushField(fields, schema, ['serial_number', 'serial', 'vin'], asText(input.serialNumber) || null);
  pushField(fields, schema, ['is_financed', 'financed'], Boolean(input.isFinanced));
  pushField(fields, schema, ['finance_note', 'finance_notes', 'finance_status'], asText(input.financeNote) || null);
  pushPhotoField(fields, schema, input.photos ?? []);
  pushField(fields, schema, ['updated_at', 'modified_at', 'updatedon'], now);

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
        ${buildSelectList(schema)}
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
  const schema = await getAssetRegisterSchema();
  const valuationResult = input.result;
  const model = valuationResult.model;
  const title = `${model.brandName} ${model.modelName}`.trim();
  const now = new Date();
  const selectedValueExVat = Math.round(Number(input.selectedValueExVat) || 0);
  const fields: SqlField[] = [];

  pushField(fields, schema, ['user_id'], input.userId);
  pushField(fields, schema, ['valuation_run_id', 'run_id'], input.valuationRunId ?? null);
  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], 'tractor');
  pushField(fields, schema, ['title', 'name', 'asset_name'], title);
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['selected_method', 'method', 'valuation_method'], input.selectedMethod);
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['source', 'origin', 'entry_source'], 'valuation');
  pushField(fields, schema, ['brand_name', 'brand'], model.brandName);
  pushField(fields, schema, ['model_name', 'model'], model.modelName);
  pushField(fields, schema, ['drive_type', 'drive', 'drivetrain'], model.drive);
  pushField(fields, schema, ['tractor_type', 'tractor_category'], model.tractorType);
  pushField(fields, schema, ['cab_type', 'cab'], model.cab);
  pushField(fields, schema, ['power_kw', 'kw', 'power'], model.powerKw);
  pushField(fields, schema, ['year_model', 'year'], Math.round(input.year));
  pushField(fields, schema, ['hours', 'engine_hours'], Math.max(0, Math.round(input.hours)));
  pushField(fields, schema, ['aim4price_value_ex_vat', 'aim4price_value'], toRoundedNumber(valuationResult.aim4priceValueExVat));
  pushField(fields, schema, ['market_mid_ex_vat', 'market_value_ex_vat', 'market_value'], toRoundedNumber(valuationResult.marketMid));
  pushField(fields, schema, ['department_value_ex_vat', 'department_value', 'dalrrd_value_ex_vat'], toRoundedNumber(valuationResult.departmentValueExVat));
  pushField(fields, schema, ['note', 'notes', 'description'], asText(input.note) || null);
  pushPhotoField(fields, schema, []);
  pushField(fields, schema, ['created_at', 'createdon', 'created'], now);
  pushField(fields, schema, ['updated_at', 'modified_at', 'updatedon'], now);

  const query = buildInsertQuery(schema, fields);
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
