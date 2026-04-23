import { getDb } from './db';
import { getAssetRegisterItemById, type AssetRegisterItem, type AssetRegisterItemMethod } from './asset-register-db';
import type { ConditionKey, TractorType } from './tractor-data';
import type { GpsType } from './tractor-logic';
import { calculateEngineHoursValue, tractorLifetimeHours, applyFloor, clamp, currentBaseYear, roundMoney } from './valuation/shared';
import {
  FRONT_PTO_REPLACEMENT_EX_VAT,
  GPS_FULL_AUTOSTEER_REPLACEMENT_EX_VAT,
  GPS_GUIDANCE_REPLACEMENT_EX_VAT,
} from './valuation/tractors';

type ProjectionSnapshot = {
  retailExVat: number;
  hours: number;
  tractorExVat: number;
  loaderExVat: number;
  gpsExVat: number;
};

export type AssetFutureProjection = {
  assetId: string;
  assetTitle: string;
  selectedMethod: AssetRegisterItemMethod;
  currentRegisterValueExVat: number;
  baseYear: number;
  targetYear: number;
  inflationRatePct: number;
  yearsForward: number;
  extraHours: number;
  condition: ConditionKey;
  current: ProjectionSnapshot;
  projected: ProjectionSnapshot;
};

type GenericDbRow = Record<string, unknown>;

type ParsedValuationPayload = {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = asText(value).toLowerCase();
  return normalized === 'true' || normalized === 't' || normalized === '1' || normalized === 'yes';
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function parseValuationPayload(value: unknown): ParsedValuationPayload {
  if (value && typeof value === 'object') {
    const parsed = value as Record<string, unknown>;
    return { input: asObject(parsed.input), output: asObject(parsed.output) };
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return { input: asObject(parsed.input), output: asObject(parsed.output) };
    } catch {
      return { input: {}, output: {} };
    }
  }

  return { input: {}, output: {} };
}

function pick(row: GenericDbRow, candidates: string[]): unknown {
  for (const candidate of candidates) {
    if (candidate in row) {
      return row[candidate];
    }
  }

  return undefined;
}

function normalizeCondition(value: unknown): ConditionKey {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'excellent') return 'excellent';
  if (normalized === 'fair') return 'fair';
  if (normalized === 'used') return 'used';
  if (normalized === 'serious' || normalized === 'requires attention' || normalized === 'requires serious attention') {
    return 'serious';
  }
  return 'good';
}

function normalizeTractorType(value: unknown): TractorType {
  return asText(value).toLowerCase() === 'orchard' ? 'orchard' : 'field';
}

function normalizeGpsType(value: unknown): GpsType {
  return asText(value).toLowerCase() === 'full-autosteer' ? 'full-autosteer' : 'guidance-only';
}

function loaderReplacementPrice(powerKw: number): number {
  if (powerKw < 80) return 175_000;
  if (powerKw <= 120) return 225_000;
  return 340_000;
}

function inflationFactor(ratePct: number, yearsForward: number): number {
  const safeRate = Number.isFinite(ratePct) ? ratePct / 100 : 0;
  return Math.pow(1 + safeRate, Math.max(0, yearsForward));
}

function loaderValueAtYear(powerKw: number, yearModel: number, targetYear: number, inflation: number): number {
  const replacementPrice = loaderReplacementPrice(powerKw) * inflation;
  const age = Math.max(0, targetYear - yearModel);
  const depreciation = clamp(age * 10, 0, 75);
  const currentValue = replacementPrice * (1 - depreciation / 100);
  return roundMoney(applyFloor(currentValue, replacementPrice, 0.25));
}

function gpsValueAtYear(gpsType: GpsType, gpsYear: number, targetYear: number, inflation: number): number {
  const baseReplacement = gpsType === 'full-autosteer'
    ? GPS_FULL_AUTOSTEER_REPLACEMENT_EX_VAT
    : GPS_GUIDANCE_REPLACEMENT_EX_VAT;
  const replacementPrice = baseReplacement * inflation;
  const age = Math.max(0, targetYear - gpsYear);
  const depreciation = clamp(age * 10, 0, 80);
  const currentValue = replacementPrice * (1 - depreciation / 100);
  return roundMoney(applyFloor(currentValue, replacementPrice, 0.2));
}

function calculateSnapshot(input: {
  targetYear: number;
  baseYear: number;
  replacementPriceExVat: number;
  yearModel: number;
  powerKw: number;
  tractorType: TractorType;
  hoursStart: number;
  extraHours: number;
  condition: ConditionKey;
  frontPtoEnabled: boolean;
  frontLoaderEnabled: boolean;
  gpsEnabled: boolean;
  gpsType: GpsType;
  gpsYear: number;
  inflationRatePct: number;
}): { snapshot: ProjectionSnapshot } {
  const yearsForward = Math.max(0, input.targetYear - input.baseYear);
  const inflator = inflationFactor(input.inflationRatePct, yearsForward);
  const hours = Math.max(0, input.hoursStart + input.extraHours);
  const replacementBaseExVat =
    input.replacementPriceExVat + (input.frontPtoEnabled && input.powerKw >= 70 ? FRONT_PTO_REPLACEMENT_EX_VAT : 0);
  const projectedReplacementBaseExVat = replacementBaseExVat * inflator;

  const tractorExVat = calculateEngineHoursValue({
    replacementPriceExVat: projectedReplacementBaseExVat,
    yearModel: input.yearModel,
    hours,
    condition: input.condition,
    maxLifetimeHours: tractorLifetimeHours(input.tractorType, input.powerKw),
    baseYear: input.targetYear,
  }).finalValueExVat;

  const loaderExVat = input.frontLoaderEnabled
    ? loaderValueAtYear(input.powerKw, input.yearModel, input.targetYear, inflator)
    : 0;

  const gpsExVat = input.gpsEnabled
    ? gpsValueAtYear(input.gpsType, input.gpsYear, input.targetYear, inflator)
    : 0;

  const retailExVat = tractorExVat + loaderExVat + gpsExVat;

  return {
    snapshot: {
      retailExVat,
      hours,
      tractorExVat,
      loaderExVat,
      gpsExVat,
    },
  };
}

async function fetchValuationRunRow(userId: string, runId: number): Promise<GenericDbRow | null> {
  const db = getDb();
  const result = await db.query<GenericDbRow>(
    `
      select *
      from valuation_runs
      where id = $1 and user_id = $2
      limit 1
    `,
    [runId, userId],
  );

  return result.rows[0] ?? null;
}

async function fetchCatalogReplacementPrice(input: {
  equipmentModelId?: unknown;
  legacyModelId?: unknown;
}): Promise<number | null> {
  const equipmentModelKey = asText(input.equipmentModelId);
  const legacyModelKey = asText(input.legacyModelId);
  const db = getDb();

  if (equipmentModelKey) {
    const modelResult = await db.query<{ aim4price_replacement_price_ex_vat: unknown }>(
      `
        select aim4price_replacement_price_ex_vat
        from public.equipment_models
        where id::text = $1
        limit 1
      `,
      [equipmentModelKey],
    );

    const replacement = asNumber(modelResult.rows[0]?.aim4price_replacement_price_ex_vat);
    if (replacement && replacement > 0) {
      return replacement;
    }
  }

  if (!legacyModelKey) {
    return null;
  }

  const result = await db.query<{ aim4price_replacement_price_ex_vat: unknown }>(
    `
      select aim4price_replacement_price_ex_vat
      from public.tractor_catalog
      where id::text = $1
      limit 1
    `,
    [legacyModelKey],
  );

  return asNumber(result.rows[0]?.aim4price_replacement_price_ex_vat);
}

function requireTractorProjectionAsset(asset: AssetRegisterItem): asserts asset is AssetRegisterItem & {
  valuationRunId: number;
  yearModel: number;
  powerKw: number;
  tractorType: TractorType;
} {
  if (asset.valuationRunId === null) {
    throw new Error('FUTURE_PRICE_UNAVAILABLE');
  }

  if (!asset.yearModel || !asset.powerKw || !asset.tractorType) {
    throw new Error('FUTURE_PRICE_UNAVAILABLE');
  }
}

export async function calculateFuturePriceForAsset(input: {
  userId: string;
  assetId: string;
  targetYear: number;
  inflationRatePct: number;
  extraHours?: number;
}): Promise<AssetFutureProjection> {
  const asset = await getAssetRegisterItemById(input.userId, input.assetId);

  if (!asset) {
    throw new Error('ASSET_NOT_FOUND');
  }

  requireTractorProjectionAsset(asset);

  const valuationRow = await fetchValuationRunRow(input.userId, asset.valuationRunId);
  if (!valuationRow) {
    throw new Error('VALUATION_RUN_NOT_FOUND');
  }

  const valuationPayload = parseValuationPayload(pick(valuationRow, ['valuation_payload', 'payload']));
  const valuationInput = valuationPayload.input;

  const selectedMethod = asset.selectedMethod;
  const currentRegisterValueExVat = Math.round(asset.selectedValueExVat ?? asset.value);
  const baseYear = new Date().getFullYear();
  const targetYear = Math.max(baseYear, Math.round(input.targetYear));
  const yearsForward = Math.max(0, targetYear - baseYear);
  const inflationRatePct = Number.isFinite(input.inflationRatePct) ? Number(input.inflationRatePct) : 0;
  const extraHours = Math.max(0, Math.round(Number(input.extraHours ?? 0) || 0));

  const yearModel = Math.round(
    asNumber(asset.yearModel) ?? asNumber(pick(valuationRow, ['year_model'])) ?? asNumber(valuationInput.year) ?? baseYear,
  );
  const hoursStart = Math.max(
    0,
    Math.round(
      asNumber(asset.hours) ?? asNumber(pick(valuationRow, ['hours'])) ?? asNumber(valuationInput.hours) ?? 0,
    ),
  );
  const condition = normalizeCondition(
    asset.condition ?? pick(valuationRow, ['condition']) ?? valuationInput.condition,
  );
  const tractorType = normalizeTractorType(asset.tractorType ?? pick(valuationRow, ['tractor_type']));
  const powerKw = Math.max(
    0,
    Math.round(asNumber(asset.powerKw) ?? asNumber(pick(valuationRow, ['power_kw'])) ?? 0),
  );

  const frontPtoEnabled = asBoolean(pick(valuationRow, ['front_pto'])) || asBoolean(valuationInput.frontPto);
  const frontLoaderEnabled = asBoolean(pick(valuationRow, ['front_loader'])) || asBoolean(valuationInput.frontLoader);
  const gpsEnabled = asBoolean(pick(valuationRow, ['gps_enabled'])) || asBoolean(valuationInput.gpsEnabled);
  const gpsType = normalizeGpsType(pick(valuationRow, ['gps_type']) ?? valuationInput.gpsType);
  const gpsYear = Math.max(
    1950,
    Math.round(
      asNumber(pick(valuationRow, ['gps_year'])) ?? asNumber(valuationInput.gpsYear) ?? yearModel,
    ),
  );

  const replacementPriceExVat = await fetchCatalogReplacementPrice({
    equipmentModelId: asset.equipmentModelId ?? pick(valuationRow, ['equipment_model_id']),
    legacyModelId: pick(valuationRow, ['model_id']),
  });

  if (!replacementPriceExVat || replacementPriceExVat <= 0) {
    throw new Error('REPLACEMENT_PRICE_NOT_AVAILABLE');
  }

  const current = calculateSnapshot({
    targetYear: baseYear,
    baseYear,
    replacementPriceExVat,
    yearModel,
    powerKw,
    tractorType,
    hoursStart,
    extraHours: 0,
    condition,
    frontPtoEnabled,
    frontLoaderEnabled,
    gpsEnabled,
    gpsType,
    gpsYear,
    inflationRatePct: 0,
  }).snapshot;

  const projected = calculateSnapshot({
    targetYear,
    baseYear,
    replacementPriceExVat,
    yearModel,
    powerKw,
    tractorType,
    hoursStart,
    extraHours,
    condition,
    frontPtoEnabled,
    frontLoaderEnabled,
    gpsEnabled,
    gpsType,
    gpsYear,
    inflationRatePct,
  }).snapshot;

  return {
    assetId: asset.id,
    assetTitle: asset.title,
    selectedMethod,
    currentRegisterValueExVat,
    baseYear,
    targetYear,
    inflationRatePct,
    yearsForward,
    extraHours,
    condition,
    current,
    projected,
  };
}
