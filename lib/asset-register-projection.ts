import { getDb } from './db';
import { getAssetRegisterItemById, type AssetRegisterItem, type AssetRegisterItemMethod } from './asset-register-db';
import type { ConditionKey, TractorType } from './tractor-data';
import type { GpsType } from './tractor-logic';
import { calculateEngineHoursValue, calculatePercentUsedValue, tractorLifetimeHours, applyFloor, clamp, roundMoney } from './valuation/shared';
import {
  FRONT_PTO_REPLACEMENT_EX_VAT,
  GPS_FULL_AUTOSTEER_REPLACEMENT_EX_VAT,
  GPS_GUIDANCE_REPLACEMENT_EX_VAT,
} from './valuation/tractors';

type UsageMetric = 'hours' | 'km' | 'percent';

type ProjectionSnapshot = {
  retailExVat: number;
  hours: number;
  tractorExVat: number;
  loaderExVat: number;
  gpsExVat: number;
  lifeWorkedPercent?: number | null;
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
  extraUsage: number;
  targetLifeWorkedPercent?: number | null;
  usageMetric: UsageMetric;
  usageUnitLabel: string;
  condition: ConditionKey;
  currentCondition: ConditionKey;
  targetCondition: ConditionKey;
  current: ProjectionSnapshot;
  projected: ProjectionSnapshot;
};

type GenericDbRow = Record<string, unknown>;

type ParsedValuationPayload = {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

const REPLACEMENT_PRICE_KEYS = [
  'replacementPriceExVat',
  'replacement_price_ex_vat',
  'replacementPriceUsedExVat',
  'replacement_price_used_ex_vat',
  'userReplacementPriceExVat',
  'user_replacement_price_ex_vat',
  'officialReplacementPriceExVat',
  'official_replacement_price_ex_vat',
  'aim4priceReplacementPriceExVat',
  'aim4price_replacement_price_ex_vat',
  'replacementPrice',
  'replacement_price',
] as const;

const MAX_LIFETIME_USAGE_KEYS = [
  'maxLifetimeUsage',
  'max_lifetime_usage',
  'maxLifetimeHours',
  'max_lifetime_hours',
  'expectedLifetimeHours',
  'expected_lifetime_hours',
  'lifetimeHours',
  'lifetime_hours',
  'designLifeHours',
  'design_life_hours',
  'usefulLifeHours',
  'useful_life_hours',
  'maxLifetimeKm',
  'max_lifetime_km',
  'expectedLifetimeKm',
  'expected_lifetime_km',
  'lifetimeKm',
  'lifetime_km',
  'designLifeKm',
  'design_life_km',
  'usefulLifeKm',
  'useful_life_km',
] as const;

const LIFE_WORKED_PERCENT_KEYS = [
  'lifeWorkedPercent',
  'life_worked_percent',
  'workedPercent',
  'worked_percent',
  'percentWorked',
  'percent_worked',
  'lifetimeWorkedPercent',
  'lifetime_worked_percent',
  'lifetimeUsedPercent',
  'lifetime_used_percent',
] as const;

const USAGE_MODE_KEYS = [
  'usageMode',
  'usage_mode',
  'usageMetricType',
  'usage_metric_type',
  'valuationMode',
  'valuation_mode',
  'depreciationMethodUsed',
  'depreciation_method_used',
  'depreciationMethod',
  'depreciation_method',
] as const;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function asNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asPositiveInteger(value: unknown): number | null {
  const numeric = asNumber(value);
  return numeric !== null && numeric > 0 ? Math.round(numeric) : null;
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

function pickFromRecord(record: Record<string, unknown>, candidates: readonly string[]): unknown {
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(record, candidate)) {
      return record[candidate];
    }
  }

  return undefined;
}

function firstPositiveNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const numeric = asPositiveInteger(value);
    if (numeric !== null) {
      return numeric;
    }
  }

  return null;
}

function firstPositiveNumberFromRecords(records: Record<string, unknown>[], keys: readonly string[]): number | null {
  for (const record of records) {
    const numeric = firstPositiveNumber(pickFromRecord(record, keys));
    if (numeric !== null) {
      return numeric;
    }
  }

  return null;
}

function normalizePercent(value: unknown): number | null {
  const numeric = asNumber(value);
  if (numeric === null || numeric < 0 || numeric > 100) {
    return null;
  }

  return Math.round(numeric * 10) / 10;
}

function firstPercentNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const numeric = normalizePercent(value);
    if (numeric !== null) {
      return numeric;
    }
  }

  return null;
}

function firstPercentNumberFromRecords(records: Record<string, unknown>[], keys: readonly string[]): number | null {
  for (const record of records) {
    const numeric = firstPercentNumber(pickFromRecord(record, keys));
    if (numeric !== null) {
      return numeric;
    }
  }

  return null;
}

function firstUsageModeFromRecords(records: Record<string, unknown>[]): string {
  for (const record of records) {
    const rawMode = pickFromRecord(record, USAGE_MODE_KEYS);
    const mode = asText(rawMode).toLowerCase();
    if (mode) {
      return mode;
    }
  }

  return '';
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

function normalizeUsageMetric(value: unknown, fallbackKind?: string): UsageMetric {
  const normalized = asText(value).toLowerCase();

  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers') {
    return 'km';
  }

  if (normalized === 'hours' || normalized === 'hour' || normalized === 'hrs') {
    return 'hours';
  }

  return fallbackKind === 'vehicle' ? 'km' : 'hours';
}

function readUsageMetric(input: {
  asset: AssetRegisterItem;
  row: GenericDbRow;
  valuationInput: Record<string, unknown>;
  valuationOutput: Record<string, unknown>;
}): UsageMetric {
  const specs = asObject(input.asset.specsJson);

  return normalizeUsageMetric(
    specs.usageMetric ??
      specs.usage_metric ??
      specs.usageMetricType ??
      specs.usage_metric_type ??
      specs.usageUnit ??
      specs.usage_unit ??
      input.valuationInput.usageMetric ??
      input.valuationInput.usage_metric ??
      input.valuationInput.usageMetricType ??
      input.valuationInput.usage_metric_type ??
      input.valuationOutput.usageMetric ??
      input.valuationOutput.usage_metric ??
      input.valuationOutput.usageMetricType ??
      input.valuationOutput.usage_metric_type ??
      pick(input.row, ['usage_metric', 'usage_metric_type']),
    input.asset.kind,
  );
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

function calculateTractorSnapshot(input: {
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

function calculateUsageBasedSnapshot(input: {
  targetYear: number;
  baseYear: number;
  replacementPriceExVat: number;
  yearModel: number;
  usageStart: number;
  extraUsage: number;
  condition: ConditionKey;
  maxLifetimeUsage: number;
  inflationRatePct: number;
}): { snapshot: ProjectionSnapshot } {
  const yearsForward = Math.max(0, input.targetYear - input.baseYear);
  const inflator = inflationFactor(input.inflationRatePct, yearsForward);
  const usage = Math.max(0, input.usageStart + input.extraUsage);
  const replacementPriceExVat = input.replacementPriceExVat * inflator;
  const baseValueExVat = calculateEngineHoursValue({
    replacementPriceExVat,
    yearModel: input.yearModel,
    hours: usage,
    condition: input.condition,
    maxLifetimeHours: input.maxLifetimeUsage,
    baseYear: input.targetYear,
  }).finalValueExVat;

  return {
    snapshot: {
      retailExVat: baseValueExVat,
      hours: usage,
      tractorExVat: baseValueExVat,
      loaderExVat: 0,
      gpsExVat: 0,
    },
  };
}

function calculatePercentBasedSnapshot(input: {
  targetYear: number;
  baseYear: number;
  replacementPriceExVat: number;
  percentUsed: number;
  condition: ConditionKey;
  inflationRatePct: number;
}): { snapshot: ProjectionSnapshot } {
  const yearsForward = Math.max(0, input.targetYear - input.baseYear);
  const inflator = inflationFactor(input.inflationRatePct, yearsForward);
  const percentUsed = Math.min(100, Math.max(0, Math.round(input.percentUsed * 10) / 10));
  const replacementPriceExVat = input.replacementPriceExVat * inflator;
  const baseValueExVat = calculatePercentUsedValue({
    replacementPriceExVat,
    percentUsed,
    condition: input.condition,
  }).finalValueExVat;

  return {
    snapshot: {
      retailExVat: baseValueExVat,
      hours: 0,
      tractorExVat: baseValueExVat,
      loaderExVat: 0,
      gpsExVat: 0,
      lifeWorkedPercent: percentUsed,
    },
  };
}

function scaleSnapshotFromCurrentSavedValue(
  snapshot: ProjectionSnapshot,
  anchorFactor: number,
  forcedRetailExVat?: number,
): ProjectionSnapshot {
  const safeFactor = Number.isFinite(anchorFactor) && anchorFactor > 0 ? anchorFactor : 1;
  const retailExVat = Math.max(0, Math.round(forcedRetailExVat ?? snapshot.retailExVat * safeFactor));
  const loaderExVat = Math.max(0, roundMoney(snapshot.loaderExVat * safeFactor));
  const gpsExVat = Math.max(0, roundMoney(snapshot.gpsExVat * safeFactor));
  const scaledTractorExVat = Math.max(0, roundMoney(snapshot.tractorExVat * safeFactor));
  const componentAdjustment = retailExVat - (scaledTractorExVat + loaderExVat + gpsExVat);
  const tractorExVat = Math.max(0, scaledTractorExVat + componentAdjustment);

  return {
    retailExVat,
    hours: snapshot.hours,
    tractorExVat,
    loaderExVat,
    gpsExVat,
    lifeWorkedPercent: snapshot.lifeWorkedPercent ?? null,
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
  fallbackModelId?: unknown;
}): Promise<number | null> {
  const candidateKeys = [asText(input.equipmentModelId), asText(input.fallbackModelId)].filter(Boolean);
  const uniqueKeys = [...new Set(candidateKeys)];

  if (!uniqueKeys.length) {
    return null;
  }

  const db = getDb();

  for (const modelKey of uniqueKeys) {
    const modelResult = await db.query<{ aim4price_replacement_price_ex_vat: unknown }>(
      `
        select aim4price_replacement_price_ex_vat
        from public.equipment_models
        where id::text = $1
          and is_active = true
        limit 1
      `,
      [modelKey],
    );

    const replacement = asNumber(modelResult.rows[0]?.aim4price_replacement_price_ex_vat);
    if (replacement && replacement > 0) {
      return replacement;
    }
  }

  return null;
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

function getFamilyKey(input: {
  asset: AssetRegisterItem;
  row: GenericDbRow;
  valuationInput: Record<string, unknown>;
}): string {
  const specs = asObject(input.asset.specsJson);

  return asText(
    input.asset.equipmentFamilyKey ||
      specs.familyKey ||
      specs.family_key ||
      input.valuationInput.familyKey ||
      input.valuationInput.family_key ||
      pick(input.row, ['family_key', 'equipment_family_key']),
  ).toLowerCase();
}

function getSectorKey(input: {
  asset: AssetRegisterItem;
  row: GenericDbRow;
  valuationInput: Record<string, unknown>;
}): string {
  const specs = asObject(input.asset.specsJson);

  return asText(
    specs.sectorKey ||
      specs.sector_key ||
      input.valuationInput.sectorKey ||
      input.valuationInput.sector_key ||
      pick(input.row, ['sector_key']),
  ).toLowerCase();
}

function readLifeWorkedPercentForProjection(input: {
  asset: AssetRegisterItem;
  row: GenericDbRow;
  valuationInput: Record<string, unknown>;
  valuationOutput: Record<string, unknown>;
}): number | null {
  const specs = asObject(input.asset.specsJson);
  const selectedCalculation = asObject(input.valuationOutput.selectedCalculation);
  const nestedResult = asObject(input.valuationOutput.result);

  return firstPercentNumber(
    input.asset.lifeWorkedPercent,
    firstPercentNumberFromRecords(
      [specs, input.valuationInput, input.valuationOutput, selectedCalculation, nestedResult, input.row],
      LIFE_WORKED_PERCENT_KEYS,
    ),
  );
}

function isPercentProjectionCandidate(input: {
  asset: AssetRegisterItem;
  row: GenericDbRow;
  valuationInput: Record<string, unknown>;
  valuationOutput: Record<string, unknown>;
}): boolean {
  if (input.asset.kind === 'vehicle') {
    return false;
  }

  const specs = asObject(input.asset.specsJson);
  const mode = firstUsageModeFromRecords([specs, input.valuationInput, input.valuationOutput, input.row]);
  const depreciationMethod = asText(
    input.asset.depreciationMethodUsed ||
      specs.depreciationMethodUsed ||
      specs.depreciation_method_used ||
      input.valuationInput.depreciationMethodUsed ||
      input.valuationInput.depreciation_method_used ||
      input.valuationOutput.depreciationMethodUsed ||
      input.valuationOutput.depreciation_method_used ||
      pick(input.row, ['depreciation_method_used', 'depreciation_method']),
  ).toLowerCase();

  return (
    mode === 'percent' ||
    mode === 'percentage' ||
    mode === 'percent_used' ||
    mode === 'percentage_depreciation' ||
    mode === 'wear_class' ||
    depreciationMethod === 'percentage_depreciation' ||
    readLifeWorkedPercentForProjection(input) !== null
  );
}

function isMotorProjectionCandidate(input: {
  asset: AssetRegisterItem;
  row: GenericDbRow;
  valuationInput: Record<string, unknown>;
  valuationOutput: Record<string, unknown>;
}): boolean {
  const sectorKey = getSectorKey(input);
  const usageMetric = readUsageMetric(input);

  return input.asset.kind === 'vehicle' || sectorKey === 'motor' || usageMetric === 'km';
}

function readReplacementPriceForProjection(input: {
  asset: AssetRegisterItem;
  row: GenericDbRow;
  valuationInput: Record<string, unknown>;
  valuationOutput: Record<string, unknown>;
}): number | null {
  const specs = asObject(input.asset.specsJson);
  const selectedCalculation = asObject(input.valuationOutput.selectedCalculation);
  const nestedResult = asObject(input.valuationOutput.result);

  return firstPositiveNumber(
    input.asset.replacementPriceExVat,
    firstPositiveNumberFromRecords(
      [specs, input.valuationOutput, selectedCalculation, nestedResult, input.valuationInput, input.row],
      REPLACEMENT_PRICE_KEYS,
    ),
  );
}

function resolveMotorLifetimeFallback(familyKey: string): number {
  if (familyKey.includes('car') || familyKey.includes('suv')) return 300_000;
  if (familyKey.includes('bakkie') || familyKey.includes('ldv') || familyKey.includes('pickup')) return 350_000;
  if (familyKey.includes('light_commercial') || familyKey.includes('van')) return 450_000;
  if (familyKey.includes('truck')) return 800_000;
  if (familyKey.includes('bus')) return 900_000;
  if (familyKey.includes('trailer')) return 700_000;
  return 350_000;
}

function readMotorLifetimeUsage(input: {
  asset: AssetRegisterItem;
  row: GenericDbRow;
  valuationInput: Record<string, unknown>;
  valuationOutput: Record<string, unknown>;
  familyKey: string;
}): number {
  const specs = asObject(input.asset.specsJson);
  const selectedCalculation = asObject(input.valuationOutput.selectedCalculation);
  const inputAdvancedAssumptions = asObject(input.valuationInput.advancedAssumptions);
  const outputAdvancedAssumptions = asObject(input.valuationOutput.advancedAssumptions);

  return firstPositiveNumber(
    input.asset.maxLifetimeHours,
    firstPositiveNumberFromRecords(
      [inputAdvancedAssumptions, outputAdvancedAssumptions, specs, input.valuationOutput, selectedCalculation, input.valuationInput, input.row],
      MAX_LIFETIME_USAGE_KEYS,
    ),
  ) ?? resolveMotorLifetimeFallback(input.familyKey);
}

function readUsageAmount(input: {
  asset: AssetRegisterItem;
  row: GenericDbRow;
  valuationInput: Record<string, unknown>;
  valuationOutput: Record<string, unknown>;
}): number {
  return Math.max(
    0,
    Math.round(
      firstPositiveNumber(
        input.asset.hours,
        input.asset.estimatedHours,
        input.valuationInput.usageAmount,
        input.valuationInput.usage_amount,
        input.valuationInput.hours,
        input.valuationOutput.usageAmount,
        input.valuationOutput.usage_amount,
        input.valuationOutput.estimatedHours,
        input.valuationOutput.estimated_hours,
        pick(input.row, ['hours', 'usage_amount', 'estimated_hours']),
      ) ?? 0,
    ),
  );
}

function buildProjectionResult(input: {
  asset: AssetRegisterItem;
  selectedMethod: AssetRegisterItemMethod;
  currentRegisterValueExVat: number;
  baseYear: number;
  targetYear: number;
  inflationRatePct: number;
  extraUsage: number;
  usageMetric: UsageMetric;
  currentCondition: ConditionKey;
  targetCondition: ConditionKey;
  currentModelSnapshot: ProjectionSnapshot;
  projectedModelSnapshot: ProjectionSnapshot;
}): AssetFutureProjection {
  const anchorFactor = input.currentRegisterValueExVat > 0 && input.currentModelSnapshot.retailExVat > 0
    ? input.currentRegisterValueExVat / input.currentModelSnapshot.retailExVat
    : 1;
  const current = scaleSnapshotFromCurrentSavedValue(
    input.currentModelSnapshot,
    anchorFactor,
    input.currentRegisterValueExVat || input.currentModelSnapshot.retailExVat,
  );
  const projected = scaleSnapshotFromCurrentSavedValue(input.projectedModelSnapshot, anchorFactor);

  return {
    assetId: input.asset.id,
    assetTitle: input.asset.title,
    selectedMethod: input.selectedMethod,
    currentRegisterValueExVat: input.currentRegisterValueExVat,
    baseYear: input.baseYear,
    targetYear: input.targetYear,
    inflationRatePct: input.inflationRatePct,
    yearsForward: Math.max(0, input.targetYear - input.baseYear),
    extraHours: input.extraUsage,
    extraUsage: input.extraUsage,
    targetLifeWorkedPercent: input.projectedModelSnapshot.lifeWorkedPercent ?? null,
    usageMetric: input.usageMetric,
    usageUnitLabel: input.usageMetric === 'percent' ? '%' : input.usageMetric === 'km' ? 'km' : 'hours',
    condition: input.targetCondition,
    currentCondition: input.currentCondition,
    targetCondition: input.targetCondition,
    current,
    projected,
  };
}

function calculatePercentProjection(input: {
  asset: AssetRegisterItem;
  row: GenericDbRow;
  valuationInput: Record<string, unknown>;
  valuationOutput: Record<string, unknown>;
  selectedMethod: AssetRegisterItemMethod;
  currentRegisterValueExVat: number;
  baseYear: number;
  targetYear: number;
  inflationRatePct: number;
  targetLifeWorkedPercent: number | null;
  targetCondition: ConditionKey | null;
}): AssetFutureProjection {
  const replacementPriceExVat = readReplacementPriceForProjection(input);

  if (!replacementPriceExVat || replacementPriceExVat <= 0) {
    throw new Error('REPLACEMENT_PRICE_NOT_AVAILABLE');
  }

  const currentLifeWorkedPercent = readLifeWorkedPercentForProjection(input);
  if (currentLifeWorkedPercent === null) {
    throw new Error('FUTURE_PRICE_UNAVAILABLE');
  }

  const targetLifeWorkedPercent = input.targetLifeWorkedPercent === null
    ? currentLifeWorkedPercent
    : Math.round(input.targetLifeWorkedPercent * 10) / 10;

  if (targetLifeWorkedPercent < 0 || targetLifeWorkedPercent > 100) {
    throw new Error('TARGET_PERCENT_INVALID');
  }

  if (targetLifeWorkedPercent < currentLifeWorkedPercent) {
    throw new Error('TARGET_PERCENT_BELOW_CURRENT');
  }

  const currentCondition = normalizeCondition(input.asset.condition || pick(input.row, ['condition']) || input.valuationInput.condition);
  const targetCondition = input.targetCondition ?? currentCondition;

  const currentModelSnapshot = calculatePercentBasedSnapshot({
    targetYear: input.baseYear,
    baseYear: input.baseYear,
    replacementPriceExVat,
    percentUsed: currentLifeWorkedPercent,
    condition: currentCondition,
    inflationRatePct: 0,
  }).snapshot;

  const projectedModelSnapshot = calculatePercentBasedSnapshot({
    targetYear: input.targetYear,
    baseYear: input.baseYear,
    replacementPriceExVat,
    percentUsed: targetLifeWorkedPercent,
    condition: targetCondition,
    inflationRatePct: input.inflationRatePct,
  }).snapshot;

  return buildProjectionResult({
    asset: input.asset,
    selectedMethod: input.selectedMethod,
    currentRegisterValueExVat: input.currentRegisterValueExVat,
    baseYear: input.baseYear,
    targetYear: input.targetYear,
    inflationRatePct: input.inflationRatePct,
    extraUsage: 0,
    usageMetric: 'percent',
    currentCondition,
    targetCondition,
    currentModelSnapshot,
    projectedModelSnapshot,
  });
}

function calculateMotorProjection(input: {
  asset: AssetRegisterItem;
  row: GenericDbRow;
  valuationInput: Record<string, unknown>;
  valuationOutput: Record<string, unknown>;
  selectedMethod: AssetRegisterItemMethod;
  currentRegisterValueExVat: number;
  baseYear: number;
  targetYear: number;
  inflationRatePct: number;
  extraUsage: number;
  targetCondition: ConditionKey | null;
}): AssetFutureProjection {
  const familyKey = getFamilyKey(input);
  const replacementPriceExVat = readReplacementPriceForProjection(input);

  if (!replacementPriceExVat || replacementPriceExVat <= 0) {
    throw new Error('REPLACEMENT_PRICE_NOT_AVAILABLE');
  }

  const yearModel = Math.round(
    asNumber(input.asset.yearModel) ?? asNumber(pick(input.row, ['year_model'])) ?? asNumber(input.valuationInput.year) ?? input.baseYear,
  );
  const usageStart = readUsageAmount(input);
  const currentCondition = normalizeCondition(input.asset.condition || pick(input.row, ['condition']) || input.valuationInput.condition);
  const targetCondition = input.targetCondition ?? currentCondition;
  const maxLifetimeUsage = readMotorLifetimeUsage({ ...input, familyKey });
  const usageMetric: UsageMetric = 'km';

  const currentModelSnapshot = calculateUsageBasedSnapshot({
    targetYear: input.baseYear,
    baseYear: input.baseYear,
    replacementPriceExVat,
    yearModel,
    usageStart,
    extraUsage: 0,
    condition: currentCondition,
    maxLifetimeUsage,
    inflationRatePct: 0,
  }).snapshot;

  const projectedModelSnapshot = calculateUsageBasedSnapshot({
    targetYear: input.targetYear,
    baseYear: input.baseYear,
    replacementPriceExVat,
    yearModel,
    usageStart,
    extraUsage: input.extraUsage,
    condition: targetCondition,
    maxLifetimeUsage,
    inflationRatePct: input.inflationRatePct,
  }).snapshot;

  return buildProjectionResult({
    asset: input.asset,
    selectedMethod: input.selectedMethod,
    currentRegisterValueExVat: input.currentRegisterValueExVat,
    baseYear: input.baseYear,
    targetYear: input.targetYear,
    inflationRatePct: input.inflationRatePct,
    extraUsage: input.extraUsage,
    usageMetric,
    currentCondition,
    targetCondition,
    currentModelSnapshot,
    projectedModelSnapshot,
  });
}

async function calculateTractorProjection(input: {
  asset: AssetRegisterItem;
  row: GenericDbRow;
  valuationInput: Record<string, unknown>;
  selectedMethod: AssetRegisterItemMethod;
  currentRegisterValueExVat: number;
  baseYear: number;
  targetYear: number;
  inflationRatePct: number;
  extraHours: number;
  targetCondition: ConditionKey | null;
}): Promise<AssetFutureProjection> {
  requireTractorProjectionAsset(input.asset);

  const yearModel = Math.round(
    asNumber(input.asset.yearModel) ?? asNumber(pick(input.row, ['year_model'])) ?? asNumber(input.valuationInput.year) ?? input.baseYear,
  );
  const hoursStart = Math.max(
    0,
    Math.round(
      asNumber(input.asset.hours) ?? asNumber(pick(input.row, ['hours'])) ?? asNumber(input.valuationInput.hours) ?? 0,
    ),
  );
  const currentCondition = normalizeCondition(
    input.asset.condition ?? pick(input.row, ['condition']) ?? input.valuationInput.condition,
  );
  const targetCondition = input.targetCondition ?? currentCondition;
  const tractorType = normalizeTractorType(input.asset.tractorType ?? pick(input.row, ['tractor_type']));
  const powerKw = Math.max(
    0,
    Math.round(asNumber(input.asset.powerKw) ?? asNumber(pick(input.row, ['power_kw'])) ?? 0),
  );

  const frontPtoEnabled = asBoolean(pick(input.row, ['front_pto'])) || asBoolean(input.valuationInput.frontPto);
  const frontLoaderEnabled = asBoolean(pick(input.row, ['front_loader'])) || asBoolean(input.valuationInput.frontLoader);
  const gpsEnabled = asBoolean(pick(input.row, ['gps_enabled'])) || asBoolean(input.valuationInput.gpsEnabled);
  const gpsType = normalizeGpsType(pick(input.row, ['gps_type']) ?? input.valuationInput.gpsType);
  const gpsYear = Math.max(
    1950,
    Math.round(
      asNumber(pick(input.row, ['gps_year'])) ?? asNumber(input.valuationInput.gpsYear) ?? yearModel,
    ),
  );

  const replacementPriceExVat = await fetchCatalogReplacementPrice({
    equipmentModelId: input.asset.equipmentModelId ?? pick(input.row, ['equipment_model_id']),
    fallbackModelId: pick(input.row, ['model_id']),
  });

  if (!replacementPriceExVat || replacementPriceExVat <= 0) {
    throw new Error('REPLACEMENT_PRICE_NOT_AVAILABLE');
  }

  const currentModelSnapshot = calculateTractorSnapshot({
    targetYear: input.baseYear,
    baseYear: input.baseYear,
    replacementPriceExVat,
    yearModel,
    powerKw,
    tractorType,
    hoursStart,
    extraHours: 0,
    condition: currentCondition,
    frontPtoEnabled,
    frontLoaderEnabled,
    gpsEnabled,
    gpsType,
    gpsYear,
    inflationRatePct: 0,
  }).snapshot;

  const projectedModelSnapshot = calculateTractorSnapshot({
    targetYear: input.targetYear,
    baseYear: input.baseYear,
    replacementPriceExVat,
    yearModel,
    powerKw,
    tractorType,
    hoursStart,
    extraHours: input.extraHours,
    condition: targetCondition,
    frontPtoEnabled,
    frontLoaderEnabled,
    gpsEnabled,
    gpsType,
    gpsYear,
    inflationRatePct: input.inflationRatePct,
  }).snapshot;

  return buildProjectionResult({
    asset: input.asset,
    selectedMethod: input.selectedMethod,
    currentRegisterValueExVat: input.currentRegisterValueExVat,
    baseYear: input.baseYear,
    targetYear: input.targetYear,
    inflationRatePct: input.inflationRatePct,
    extraUsage: input.extraHours,
    usageMetric: 'hours',
    currentCondition,
    targetCondition,
    currentModelSnapshot,
    projectedModelSnapshot,
  });
}

export async function calculateFuturePriceForAsset(input: {
  userId: string;
  assetId: string;
  targetYear: number;
  inflationRatePct: number;
  extraHours?: number;
  targetLifeWorkedPercent?: number | null;
  targetCondition?: ConditionKey | null;
}): Promise<AssetFutureProjection> {
  const asset = await getAssetRegisterItemById(input.userId, input.assetId);

  if (!asset) {
    throw new Error('ASSET_NOT_FOUND');
  }

  if (!asset.valuationRunId || asset.selectedMethod === 'manual') {
    throw new Error('FUTURE_PRICE_UNAVAILABLE');
  }

  const valuationRow = await fetchValuationRunRow(input.userId, asset.valuationRunId);
  if (!valuationRow) {
    throw new Error('VALUATION_RUN_NOT_FOUND');
  }

  const valuationPayload = parseValuationPayload(pick(valuationRow, ['valuation_payload', 'payload']));
  const valuationInput = valuationPayload.input;
  const valuationOutput = valuationPayload.output;

  const selectedMethod = asset.selectedMethod;
  const currentRegisterValueExVat = Math.max(0, Math.round(asNumber(asset.value) ?? asNumber(asset.selectedValueExVat) ?? 0));
  const baseYear = new Date().getFullYear();
  const targetYear = Math.max(baseYear, Math.round(input.targetYear));
  const inflationRatePct = Number.isFinite(input.inflationRatePct) ? Number(input.inflationRatePct) : 0;
  const extraUsage = Math.max(0, Math.round(Number(input.extraHours ?? 0) || 0));
  const targetLifeWorkedPercent = typeof input.targetLifeWorkedPercent === 'number' && Number.isFinite(input.targetLifeWorkedPercent)
    ? Math.round(input.targetLifeWorkedPercent * 10) / 10
    : null;
  const targetCondition = input.targetCondition ? normalizeCondition(input.targetCondition) : null;

  const baseContext = {
    asset,
    row: valuationRow,
    valuationInput,
    valuationOutput,
    selectedMethod,
    currentRegisterValueExVat,
    baseYear,
    targetYear,
    inflationRatePct,
    targetCondition,
  };

  if (isPercentProjectionCandidate({ asset, row: valuationRow, valuationInput, valuationOutput })) {
    return calculatePercentProjection({
      ...baseContext,
      targetLifeWorkedPercent,
    });
  }

  if (targetLifeWorkedPercent !== null) {
    throw new Error('TARGET_PERCENT_UNSUPPORTED');
  }

  if (isMotorProjectionCandidate({ asset, row: valuationRow, valuationInput, valuationOutput })) {
    return calculateMotorProjection({
      ...baseContext,
      extraUsage,
    });
  }

  return calculateTractorProjection({
    ...baseContext,
    extraHours: extraUsage,
  });
}
