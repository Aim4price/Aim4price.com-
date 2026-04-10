import { getDb } from './db';
import type { CabType, DriveType, TractorType } from './tractor-data';
import type { MethodKey, SaveValuationRunResult } from './valuation-runs';

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

type AssetRegisterRow = {
  id: string | number;
  user_id: string;
  valuation_run_id: string | number | null;
  kind: string;
  title: string;
  value: string | number;
  selected_method: string;
  selected_value_ex_vat: string | number;
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
  created_at: string;
  updated_at: string;
};

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

function mapAssetRegisterRow(row: AssetRegisterRow): AssetRegisterItem {
  return {
    id: Number(row.id),
    userId: row.user_id,
    valuationRunId: asNumber(row.valuation_run_id),
    kind: row.kind === 'tractor' || row.kind === 'manual' || row.kind === 'property' ? row.kind : 'manual',
    title: row.title,
    value: Math.round(asNumber(row.value) ?? 0),
    selectedMethod:
      row.selected_method === 'aim4price' ||
      row.selected_method === 'market' ||
      row.selected_method === 'department' ||
      row.selected_method === 'manual'
        ? row.selected_method
        : 'manual',
    selectedValueExVat: Math.round(asNumber(row.selected_value_ex_vat) ?? 0),
    brandName: asText(row.brand_name),
    modelName: asText(row.model_name),
    drive: row.drive_type === '2wd' || row.drive_type === '4wd' || row.drive_type === 'tracks' ? row.drive_type : '',
    tractorType: row.tractor_type === 'field' || row.tractor_type === 'orchard' ? row.tractor_type : '',
    cab: row.cab_type === 'cab' || row.cab_type === 'open-station' ? row.cab_type : '',
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
    photos: asStringArray(row.photos),
    createdAtIso: row.created_at,
    updatedAtIso: row.updated_at,
  };
}

export async function listAssetRegisterItems(userId: string): Promise<AssetRegisterItem[]> {
  const db = getDb();

  const result = await db.query<AssetRegisterRow>(
    `
      select
        id,
        user_id,
        valuation_run_id,
        kind,
        title,
        value,
        selected_method,
        selected_value_ex_vat,
        brand_name,
        model_name,
        drive_type,
        tractor_type,
        cab_type,
        power_kw,
        year_model,
        hours,
        aim4price_value_ex_vat,
        market_mid_ex_vat,
        department_value_ex_vat,
        note,
        serial_number,
        is_financed,
        finance_note,
        photos,
        created_at,
        updated_at
      from asset_register_items
      where user_id = $1
      order by updated_at desc, id desc
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

  const result = await db.query<AssetRegisterRow>(
    `
      insert into asset_register_items (
        user_id,
        valuation_run_id,
        kind,
        title,
        value,
        selected_method,
        selected_value_ex_vat,
        note,
        serial_number,
        is_financed,
        finance_note,
        photos,
        created_at,
        updated_at
      )
      values (
        $1, null, $2, $3, $4, 'manual', $4, $5, $6, $7, $8, $9::jsonb, now(), now()
      )
      returning
        id,
        user_id,
        valuation_run_id,
        kind,
        title,
        value,
        selected_method,
        selected_value_ex_vat,
        brand_name,
        model_name,
        drive_type,
        tractor_type,
        cab_type,
        power_kw,
        year_model,
        hours,
        aim4price_value_ex_vat,
        market_mid_ex_vat,
        department_value_ex_vat,
        note,
        serial_number,
        is_financed,
        finance_note,
        photos,
        created_at,
        updated_at
    `,
    [
      userId,
      input.kind,
      asText(input.title),
      Math.round(Number(input.value) || 0),
      asText(input.note) || null,
      asText(input.serialNumber) || null,
      Boolean(input.isFinanced),
      asText(input.financeNote) || null,
      JSON.stringify((input.photos ?? []).map((entry) => asText(entry)).filter(Boolean)),
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('ASSET_CREATE_FAILED');
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
  valuationRun: SaveValuationRunResult;
  selectedMethod: MethodKey;
  year: number;
  hours: number;
  note?: string | null;
}): Promise<AssetRegisterItem> {
  const db = getDb();
  const result = input.valuationRun.result;
  const model = result.model;
  const title = `${model.brandName} ${model.modelName}`.trim();

  const inserted = await db.query<AssetRegisterRow>(
    `
      insert into asset_register_items (
        user_id,
        valuation_run_id,
        kind,
        title,
        value,
        selected_method,
        selected_value_ex_vat,
        brand_name,
        model_name,
        drive_type,
        tractor_type,
        cab_type,
        power_kw,
        year_model,
        hours,
        aim4price_value_ex_vat,
        market_mid_ex_vat,
        department_value_ex_vat,
        note,
        photos,
        created_at,
        updated_at
      )
      values (
        $1, $2, 'tractor', $3, $4, $5, $4, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, '[]'::jsonb, now(), now()
      )
      returning
        id,
        user_id,
        valuation_run_id,
        kind,
        title,
        value,
        selected_method,
        selected_value_ex_vat,
        brand_name,
        model_name,
        drive_type,
        tractor_type,
        cab_type,
        power_kw,
        year_model,
        hours,
        aim4price_value_ex_vat,
        market_mid_ex_vat,
        department_value_ex_vat,
        note,
        serial_number,
        is_financed,
        finance_note,
        photos,
        created_at,
        updated_at
    `,
    [
      input.userId,
      input.valuationRun.runId,
      title,
      Math.round(input.valuationRun.selectedValueExVat),
      input.selectedMethod,
      model.brandName,
      model.modelName,
      model.drive,
      model.tractorType,
      model.cab,
      model.powerKw,
      Math.round(input.year),
      Math.max(0, Math.round(input.hours)),
      toRoundedNumber(result.aim4priceValueExVat),
      toRoundedNumber(result.marketMid),
      toRoundedNumber(result.departmentValueExVat),
      asText(input.note) || null,
    ],
  );

  const row = inserted.rows[0];
  if (!row) {
    throw new Error('ASSET_CREATE_FAILED');
  }

  return mapAssetRegisterRow(row);
}

function toRoundedNumber(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.round(value);
}
