import { getDb } from './db';
import { getAssetRegisterItemById, type AssetRegisterItem, type AssetRegisterItemMethod } from './asset-register-db';
import type { ConditionKey, TractorType } from './tractor-data';
import type { GpsType } from './tractor-logic';

const CONDITION_FACTORS: Record<ConditionKey, number> = {
  excellent: 0.95,
  good: 0.85,
  fair: 0.75,
  used: 0.65,
  serious: 0.55,
};

const FRONT_PTO_REPLACEMENT_EX_VAT = 250_000;
const GPS_FULL_AUTOSTEER_REPLACEMENT_EX_VAT = 250_000;
const GPS_GUIDANCE_REPLACEMENT_EX_VAT = 100_000;

type ProjectionSnapshot = {
  retailExVat: number;
  tradeInExVat: number;
  tradeInPercent: number;
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
  breakdown: {
    inflationFactor: number;
    replacementBaseExVat: number;
    projectedReplacementBaseExVat: number;
    ageDepPct: number;
    usageDepPct: number;
    averageDepPct: number;
    conditionFactor: number;
  };
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
    return {
      input: asObject(parsed.input),
      output: asObject(parsed.output),
    };
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return {
        input: asObject(parsed.input),
        output: asObject(parsed.output),
      };
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

function roundMoney(value: number): number {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lifetime(type: TractorType, powerKw: number): number {
  if (type === 'orchard') return 10_000;
  if (powerKw <= 25) return 8_000;
  if (powerKw <= 75) return 12_000;
  return 14_000;
}

function ageDepAtYear(yearModel: number, targetYear: number): number {
  const age = Math.max(0, targetYear - yearModel);

  let depreciation = 0;
  if (age >= 1) depreciation += 20;
  if (age >= 2) depreciation += 15;
  if (age >= 3) depreciation += 10;
  if (age >= 4) depreciation += (age - 3) * 2.5;

  return clamp(Number(depreciation.toFixed(1)), 0, 100);
}

function usageDep(type: TractorType, hours: number, powerKw: number): number {
  const safeHours = Math.max(0, Number(hours) || 0);
  const usagePct = (safeHours / lifetime(type, powerKw)) * 100;
  return clamp(Number(usagePct.toFixed(1)), 0, 100);
}

function applyCondition(value: number, condition: ConditionKey): number {
  return value * CONDITION_FACTORS[condition];
}

function applyFloor(value: number, replacementBase: number, floorPercent: number): number {
  return Math.max(value, replacementBase * floorPercent);
}

function loaderReplacementPrice(powerKw: number): number {
  if (powerKw < 80) return 175_000;
  if (powerKw <= 120) return 225_000;
  return 340_000;
}

function tradeInPercent(retailValueExVat: number, condition: ConditionKey): number {
  const lowerBand: Record<ConditionKey, number> = {
    excellent: 0.1,
    good: 0.125,
    fair: 0.15,
    used: 0.175,
    serious: 0.2,
  };

  const upperBand: Record<ConditionKey, number> = {
    excellent: 0.075,
    good: 0.1,
    fair: 0.125,
    used: 0.15,
    serious: 0.175,
  };

  return retailValueExVat < 1_000_000 ? lowerBand[condition] : upperBand[condition];
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
  const baseReplacement =
    gpsType === 'full-autosteer' ? GPS_FULL_AUTOSTEER_REPLACEMENT_EX_VAT : GPS_GUIDANCE_REPLACEMENT_EX_VAT;
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
}): { snapshot: ProjectionSnapshot; breakdown: AssetFutureProjection['breakdown'] } {
  const yearsForward = Math.max(0, input.targetYear - input.baseYear);
  const inflator = inflationFactor(input.inflationRatePct, yearsForward);
  const hours = Math.max(0, input.hoursStart + input.extraHours);
  const replacementBaseExVat =
    input.replacementPriceExVat + (input.frontPtoEnabled && input.powerKw >= 70 ? FRONT_PTO_REPLACEMENT_EX_VAT : 0);
  const projectedReplacementBaseExVat = replacementBaseExVat * inflator;

  const ageDepPct = ageDepAtYear(input.yearModel, input.targetYear);
  const usageDepPct = usageDep(input.tractorType, hours, input.powerKw);
  const averageDepPct = Math.round((ageDepPct + usageDepPct) / 2);

  const tractorBeforeCondition = projectedReplacementBaseExVat * (1 - averageDepPct / 100);
  const tractorAfterCondition = applyCondition(tractorBeforeCondition, input.condition);
  const tractorExVat = roundMoney(applyFloor(tractorAfterCondition, projectedReplacementBaseExVat, 0.05));

  const loaderExVat = input.frontLoaderEnabled
    ? loaderValueAtYear(input.powerKw, input.yearModel, input.targetYear, inflator)
    : 0;

  const gpsExVat = input.gpsEnabled ? gpsValueAtYear(input.gpsType, input.gpsYear, input.targetYear, inflator) : 0;

  const retailExVat = tractorExVat + loaderExVat + gpsExVat;
  const tradeInPct = tradeInPercent(retailExVat, input.condition);
  const tradeInExVat = roundMoney(retailExVat * (1 - tradeInPct));

  return {
    snapshot: {
      retailExVat,
      tradeInExVat,
      tradeInPercent: tradeInPct,
      hours,
      tractorExVat,
      loaderExVat,
      gpsExVat,
    },
    breakdown: {
      inflationFactor: inflator,
      replacementBaseExVat: roundMoney(replacementBaseExVat),
      projectedReplacementBaseExVat: roundMoney(projectedReplacementBaseExVat),
      ageDepPct,
      usageDepPct,
      averageDepPct,
      conditionFactor: CONDITION_FACTORS[input.condition],
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

async function fetchCatalogReplacementPrice(modelId: unknown): Promise<number | null> {
  const modelKey = asText(modelId);
  if (!modelKey) {
    return null;
  }

  const db = getDb();
  const result = await db.query<{ aim4price_replacement_price_ex_vat: unknown }>(
    `
      select aim4price_replacement_price_ex_vat
      from tractor_catalog
      where id::text = $1
      limit 1
    `,
    [modelKey],
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

  const payload = parseValuationPayload(pick(valuationRow, ['valuation_payload']));
  const payloadInput = payload.input;

  const replacementPriceExVat =
    asNumber(pick(valuationRow, ['catalog_replacement_price_ex_vat'])) ??
    (await fetchCatalogReplacementPrice(pick(valuationRow, ['model_id'])));

  if (!replacementPriceExVat || replacementPriceExVat <= 0) {
    throw new Error('REPLACEMENT_PRICE_NOT_AVAILABLE');
  }

  const baseYear = new Date().getFullYear();
  const targetYear = Math.max(baseYear, Math.round(input.targetYear || baseYear));
  const inflationRatePct = clamp(Number(input.inflationRatePct) || 0, -50, 200);
  const extraHours = Math.max(0, Math.round(Number(input.extraHours) || 0));

  const yearModel = asset.yearModel ?? Math.round(asNumber(pick(valuationRow, ['year_model'])) ?? baseYear);
  const powerKw = asset.powerKw ?? Math.round(asNumber(pick(valuationRow, ['power_kw'])) ?? 0);
  const tractorType = normalizeTractorType(asset.tractorType || pick(valuationRow, ['tractor_type']) || payloadInput.tractorType);
  const hoursStart = Math.max(
    0,
    Math.round(asset.hours ?? asNumber(pick(valuationRow, ['hours'])) ?? asNumber(payloadInput.hours) ?? 0),
  );

  const condition = normalizeCondition(asset.condition || pick(valuationRow, ['condition']) || payloadInput.condition);
  const frontPtoEnabled = asBoolean(pick(valuationRow, ['front_pto'])) || asBoolean(payloadInput.frontPto);
  const frontLoaderEnabled = asBoolean(pick(valuationRow, ['front_loader'])) || asBoolean(payloadInput.frontLoader);
  const gpsEnabled = asBoolean(pick(valuationRow, ['gps_enabled'])) || asBoolean(payloadInput.gpsEnabled);
  const gpsType = normalizeGpsType(pick(valuationRow, ['gps_type']) ?? payloadInput.gpsType);
  const gpsYear = Math.round(
    asNumber(pick(valuationRow, ['gps_year'])) ?? asNumber(payloadInput.gpsYear) ?? yearModel,
  );

  const currentResult = calculateSnapshot({
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
  });

  const projectedResult = calculateSnapshot({
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
  });

  return {
    assetId: asset.id,
    assetTitle: asset.title,
    selectedMethod: asset.selectedMethod,
    currentRegisterValueExVat: Math.round(asset.value || 0),
    baseYear,
    targetYear,
    inflationRatePct,
    yearsForward: Math.max(0, targetYear - baseYear),
    extraHours,
    condition,
    current: currentResult.snapshot,
    projected: projectedResult.snapshot,
    breakdown: projectedResult.breakdown,
  };
}
