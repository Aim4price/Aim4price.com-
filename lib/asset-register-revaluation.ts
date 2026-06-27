import {
  getAssetRegisterItemById,
  updateAssetRegisterItemFromGenericValuation,
  updateAssetRegisterItemFromValuation,
  type AssetRegisterItem,
} from './asset-register-db';
import { getDb } from './db';
import { isSectorKey, type SectorKey } from './equipment-types';
import {
  getGenericSelectedMethodValue,
  runGenericValuation,
  type GenericCondition,
  type GenericSelectedMethod,
} from './generic-valuation';
import { getSelectedMethodValue, saveGenericValuationRunFromResult, saveValuationRunFromResult, type MethodKey } from './valuation-runs';
import { runServerValuation } from './server-valuation';
import type { GpsType, RunValuationInput } from './tractor-logic';
import type { ConditionKey } from './tractor-data';
import type { AdvancedAssumptionsInput } from './valuation/shared';

export type AssetRevaluationMarketSource = {
  id: string | number;
  title: string;
  sourceName: string;
  sourceUrl?: string | null;
  advertisedPriceExVat: number;
  yearModel?: number | null;
  hours?: number | null;
  usageAmount?: number | null;
  location?: string | null;
  province?: string | null;
  area?: string | null;
  condition?: string | null;
  matchReason?: string | null;
  dateAdvertised?: string | null;
};

export type AssetRevaluationResult = {
  item: AssetRegisterItem;
  valuationRunId: number;
  selectedMethod: MethodKey | GenericSelectedMethod;
  oldValueExVat: number;
  newValueExVat: number;
  warning?: string;
  previewOnly?: boolean;
  marketAverageExVat?: number | null;
  marketLowExVat?: number | null;
  marketHighExVat?: number | null;
  marketCount?: number;
  marketSources?: AssetRevaluationMarketSource[];
  marketMatchStrategy?: string;
  marketAdjustmentExVat?: number | null;
  marketRawAverageExVat?: number | null;
  marketValueMode?: 'aim4price_delta' | 'market_average';
  replacementPriceUsedExVat?: number | null;
};

type ValuationRunRow = Record<string, unknown> & {
  id: string | number;
  valuation_payload?: unknown;
  model_id?: string | number | null;
  equipment_model_id?: string | number | null;
  sector_key?: string | null;
  family_key?: string | null;
  brand_slug?: string | null;
  year_model?: string | number | null;
  hours?: string | number | null;
  condition?: string | null;
  selected_method?: string | null;
  front_pto?: boolean | string | number | null;
  front_loader?: boolean | string | number | null;
  gps_enabled?: boolean | string | number | null;
  gps_type?: string | null;
  gps_year?: string | number | null;
  user_replacement_price_ex_vat?: string | number | null;
  user_replacement_price_year?: string | number | null;
  typed_model_name?: string | null;
  normalized_typed_model_name?: string | null;
  specs_json?: unknown;
};

type RevaluePreference = MethodKey | GenericSelectedMethod | null;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function asNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asInteger(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function roundMoneyValue(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function roundFiniteValue(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function positiveMoneyValue(value: unknown): number | null {
  const parsed = roundFiniteValue(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function requireSelectedValue(value: unknown): number {
  const parsed = roundMoneyValue(value);
  if (parsed === null) {
    throw new Error('SELECTED_METHOD_NOT_AVAILABLE');
  }

  return parsed;
}

function resolveReplacementPrice(value: unknown): number {
  const parsed = roundMoneyValue(value);
  if (parsed === null || parsed <= 0) {
    throw new Error('REPLACEMENT_PRICE_REQUIRED');
  }

  return parsed;
}

function optionalReplacementPrice(value: unknown): number | null {
  const parsed = roundMoneyValue(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function neutralMarketEvidence(): Pick<
  AssetRevaluationResult,
  'marketAverageExVat' | 'marketLowExVat' | 'marketHighExVat' | 'marketCount' | 'marketSources' | 'marketMatchStrategy'
> {
  return {
    marketAverageExVat: null,
    marketLowExVat: null,
    marketHighExVat: null,
    marketCount: 0,
    marketSources: [],
    marketMatchStrategy: 'none',
  };
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
  }

  return false;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function readNestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  return asRecord(source[key]);
}

function firstNonEmptyRecord(...records: Record<string, unknown>[]): Record<string, unknown> | null {
  return records.find((record) => Object.keys(record).length > 0) ?? null;
}

function readSavedAdvancedAssumptions(
  payloadInput: Record<string, unknown>,
  payloadOutput?: Record<string, unknown>,
): Record<string, unknown> | null {
  return firstNonEmptyRecord(
    readNestedRecord(payloadInput, 'advancedAssumptions'),
    payloadOutput ? readNestedRecord(payloadOutput, 'advancedAssumptions') : {},
  );
}

function normalizeCondition(value: unknown): ConditionKey | null {
  const normalized = asText(value).toLowerCase();

  if (
    normalized === 'excellent' ||
    normalized === 'good' ||
    normalized === 'fair' ||
    normalized === 'used' ||
    normalized === 'serious'
  ) {
    return normalized;
  }

  return null;
}

function normalizeGenericCondition(value: unknown): GenericCondition | null {
  return normalizeCondition(value) as GenericCondition | null;
}

function normalizeMethod(value: unknown): MethodKey | null {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'aim4price' || normalized === 'market') return 'aim4price';
  return null;
}

function normalizeGpsType(value: unknown): GpsType | null {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'full-autosteer' || normalized === 'guidance-only') return normalized;
  return null;
}

function cleanSpecsForValuation(specs: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...specs };
  [
    'valuationNeedsUpdate',
    'valuation_needs_update',
    'valuationStaleSince',
    'valuation_stale_since',
    'valuationStaleReason',
    'valuation_stale_reason',
    'valuationStaleReasons',
    'valuation_stale_reasons',
    'valuationLastUpdatedAt',
    'valuation_last_updated_at',
    'valuationLastRunId',
    'valuation_last_run_id',
    'valuationLastValueExVat',
    'valuation_last_value_ex_vat',
    'valuationLastHours',
    'valuation_last_hours',
    'valuationLastLifeWorkedPercent',
    'valuation_last_life_worked_percent',
    'valuationLastCondition',
    'valuation_last_condition',
  ].forEach((key) => {
    delete cleaned[key];
  });

  return cleaned;
}

function readLifeWorkedPercent(asset: AssetRegisterItem, payloadInput: Record<string, unknown>): number | null {
  const direct = asNumber(asset.lifeWorkedPercent);
  if (direct !== null) return Math.max(0, Math.min(100, direct));

  const specs = asset.specsJson ?? {};
  const fromSpecs =
    asNumber(specs.life_worked_percent) ??
    asNumber(specs.worked_percent) ??
    asNumber(specs.lifetime_worked_percent) ??
    asNumber(specs.percent_worked) ??
    asNumber(specs.lifetime_used_percent);

  if (fromSpecs !== null) return Math.max(0, Math.min(100, fromSpecs));

  const fromPayload = asNumber(payloadInput.lifeWorkedPercent);
  return fromPayload === null ? null : Math.max(0, Math.min(100, fromPayload));
}

function assetUsesPercentUsageForRevaluation(asset: AssetRegisterItem): boolean {
  const specs = asset.specsJson ?? {};
  const rawUsageMode = asText(
    specs.usageMode ??
      specs.usage_mode ??
      specs.usageMetricType ??
      specs.usage_metric_type ??
      specs.valuationMode ??
      specs.valuation_mode,
  )
    .toLowerCase();
  const depreciationMethod = asText(asset.depreciationMethodUsed).toLowerCase();
  const percent = readLifeWorkedPercent(asset, {});
  const hours = asNumber(asset.hours);

  if (
    rawUsageMode === 'percent' ||
    rawUsageMode === 'percentage' ||
    rawUsageMode === 'percent_used' ||
    rawUsageMode === 'percentage_depreciation' ||
    rawUsageMode === 'wear_class'
  ) {
    return true;
  }

  if (asset.kind === 'vehicle') {
    return false;
  }

  if (depreciationMethod === 'percentage_depreciation') {
    return true;
  }

  return percent !== null && ((!hours || hours <= 0) || depreciationMethod === 'semi_depreciation');
}

function buildPreviewAssetFromTractorValuation(input: {
  asset: AssetRegisterItem;
  result: Awaited<ReturnType<typeof runServerValuation>>;
  selectedMethod: MethodKey;
  selectedValueExVat: number;
  year: number;
  hours: number;
  condition: ConditionKey;
}): AssetRegisterItem {
  const model = input.result.model;
  const replacementPriceExVat = resolveReplacementPrice(input.result.replacementPriceUsedExVat);

  return {
    ...input.asset,
    kind: 'tractor',
    value: input.selectedValueExVat,
    selectedValueExVat: input.selectedValueExVat,
    selectedMethod: input.selectedMethod,
    replacementPriceExVat,
    brandName: model.brandName,
    modelName: model.modelName,
    drive: model.drive,
    tractorType: model.tractorType,
    cab: model.cab,
    powerKw: model.powerKw,
    yearModel: Math.round(input.year),
    hours: Math.max(0, Math.round(input.hours)),
    condition: input.condition,
    estimatedHours: Math.max(0, Math.round(input.hours)),
    maxLifetimeHours: roundFiniteValue(input.result.maxLifetimeHours),
    aim4priceValueExVat: roundMoneyValue(input.result.aim4priceValueExVat),
    marketMidExVat: null,
    updatedAtIso: new Date().toISOString(),
  };
}

function buildPreviewAssetFromGenericValuation(input: {
  asset: AssetRegisterItem;
  result: Awaited<ReturnType<typeof runGenericValuation>>;
  selectedMethod: GenericSelectedMethod;
  selectedValueExVat: number;
}): AssetRegisterItem {
  const replacementPriceExVat = resolveReplacementPrice(input.result.replacementPriceUsedExVat);

  return {
    ...input.asset,
    sectorId: input.result.sector.id,
    equipmentFamilyId: input.result.family.id,
    equipmentFamilyKey: input.result.family.key,
    equipmentFamilyLabel: input.result.family.label,
    equipmentModelId: null,
    typedModelName: input.result.typedModelName ?? '',
    normalizedTypedModelName: input.result.normalizedTypedModelName ?? '',
    specsJson: {
      ...(input.asset.specsJson ?? {}),
      ...(input.result.specsJson ?? {}),
    },
    depreciationMethodUsed: input.result.depreciationMethodUsed,
    lifeWorkedPercent: input.result.lifeWorkedPercent,
    lifeRemainingPercent: input.result.lifeRemainingPercent,
    estimatedHours: input.result.estimatedHours,
    maxLifetimeHours: input.result.maxLifetimeHours,
    kind: input.result.sector.key === 'motor' || input.result.family.usageMetricType === 'km' ? 'vehicle' : 'equipment',
    value: input.selectedValueExVat,
    selectedValueExVat: input.selectedValueExVat,
    selectedMethod: input.selectedMethod,
    replacementPriceExVat,
    brandName: input.result.brand.name,
    modelName: input.result.typedModelName || 'Specs-based valuation',
    yearModel: input.result.year,
    hours: input.result.usageAmount ?? null,
    condition: input.result.condition,
    aim4priceValueExVat: roundMoneyValue(input.result.aim4priceValueExVat),
    marketMidExVat: null,
    updatedAtIso: new Date().toISOString(),
  };
}

function requireNumber(value: unknown, message: string): number {
  const parsed = asNumber(value);
  if (parsed === null) {
    throw new Error(message);
  }
  return parsed;
}

function requireText(value: unknown, message: string): string {
  const text = asText(value);
  if (!text) {
    throw new Error(message);
  }
  return text;
}

async function fetchValuationRun(userId: string, runId: number): Promise<ValuationRunRow | null> {
  const db = getDb();
  const result = await db.query<ValuationRunRow>(
    `
      select
        vr.*,
        s.sector_key,
        ef.family_key,
        coalesce(b.slug, vr.brand_slug) as brand_slug
      from valuation_runs vr
      left join sectors s
        on s.id = vr.sector_id
      left join equipment_families ef
        on ef.id = vr.equipment_family_id
      left join brands b
        on b.id = vr.brand_id
      where vr.user_id = $1
        and vr.id = $2
      limit 1
    `,
    [userId, runId],
  );

  return result.rows[0] ?? null;
}

function resolvePreferredMethod(asset: AssetRegisterItem, row: ValuationRunRow, preferredMethod?: unknown): RevaluePreference {
  return normalizeMethod(preferredMethod) ?? normalizeMethod(asset.selectedMethod) ?? normalizeMethod(row.selected_method) ?? 'aim4price';
}

function resolveTractorMethod(
  _preferredMethod: RevaluePreference,
  result: Awaited<ReturnType<typeof runServerValuation>>,
): MethodKey {
  if (result.aim4priceValueExVat !== null) {
    return 'aim4price';
  }

  throw new Error('No valuation method is available for this asset right now.');
}

function resolveGenericMethod(
  _preferredMethod: RevaluePreference,
  result: Awaited<ReturnType<typeof runGenericValuation>>,
): GenericSelectedMethod {
  if (result.aim4priceValueExVat !== null || result.valuationMidExVat !== null) {
    return 'aim4price';
  }

  throw new Error('No valuation method is available for this asset right now.');
}

async function revalueTractorAsset(input: {
  userId: string;
  asset: AssetRegisterItem;
  row: ValuationRunRow;
  preferredMethod: RevaluePreference;
  previewOnly?: boolean;
  replacementPriceExVat?: number | null;
  saveReplacementPrice?: boolean;
  advancedAssumptions?: AdvancedAssumptionsInput;
  usageAmountOverride?: number | null;
  allowUsageDecrease?: boolean;
}): Promise<AssetRevaluationResult> {
  const payload = asRecord(input.row.valuation_payload);
  const payloadInput = readNestedRecord(payload, 'input');
  const payloadOutput = readNestedRecord(payload, 'output');
  const advancedAssumptions = typeof input.advancedAssumptions === 'undefined'
    ? readSavedAdvancedAssumptions(payloadInput, payloadOutput)
    : input.advancedAssumptions;
  const modelId = requireText(
    payloadInput.modelId ?? input.row.equipment_model_id ?? input.row.model_id ?? input.asset.equipmentModelId,
    'This tractor is missing its original model link, so Aim4price cannot re-run the estimate yet.',
  );
  const assetSpecs = asRecord(input.asset.specsJson);
  const rowSpecs = asRecord(input.row.specs_json);
  const yearModelUnknown = asBoolean(
    payloadInput.yearModelUnknown ??
      payloadInput.year_model_unknown ??
      assetSpecs.year_model_unknown ??
      assetSpecs.yearModelUnknown ??
      rowSpecs.year_model_unknown ??
      rowSpecs.yearModelUnknown,
  );
  const year = Math.round(
    yearModelUnknown
      ? asNumber(payloadInput.year) ?? asNumber(payloadInput.calculationYear) ?? asNumber(input.row.year_model) ?? new Date().getFullYear()
      : requireNumber(
          input.asset.yearModel ?? payloadInput.year ?? input.row.year_model,
          'This tractor is missing its year model, so Aim4price cannot re-run the estimate yet.',
        ),
  );
  const savedHours = asNumber(input.asset.hours) ?? asNumber(payloadInput.hours) ?? asNumber(input.row.hours);
  const usageAmountOverride = input.usageAmountOverride;
  const hasUsageAmountOverride = typeof usageAmountOverride !== 'undefined';
  const nextHoursInput = hasUsageAmountOverride ? usageAmountOverride : savedHours;

  if (
    hasUsageAmountOverride &&
    usageAmountOverride !== null &&
    savedHours !== null &&
    usageAmountOverride < savedHours &&
    input.allowUsageDecrease !== true
  ) {
    throw new Error('USAGE_READING_CANNOT_DECREASE');
  }

  const hours = Math.max(
    0,
    Math.round(
      requireNumber(
        nextHoursInput,
        'This tractor is missing its latest hours, so Aim4price cannot re-run the estimate yet.',
      ),
    ),
  );
  const condition = normalizeCondition(input.asset.condition || payloadInput.condition || input.row.condition);

  if (!condition) {
    throw new Error('This tractor is missing its condition, so Aim4price cannot re-run the estimate yet.');
  }

  const replacementPriceOverrideExVat = optionalReplacementPrice(input.replacementPriceExVat);

  const valuationInput: RunValuationInput = {
    modelId,
    year,
    hours,
    condition,
    frontPto: asBoolean(payloadInput.frontPto ?? input.row.front_pto),
    frontLoader: asBoolean(payloadInput.frontLoader ?? input.row.front_loader),
    gpsEnabled: asBoolean(payloadInput.gpsEnabled ?? input.row.gps_enabled),
    gpsType: normalizeGpsType(payloadInput.gpsType ?? input.row.gps_type),
    gpsYear: asText(payloadInput.gpsYear ?? input.row.gps_year) || null,
    userReplacementPriceExVat:
      replacementPriceOverrideExVat ??
      asNumber(input.asset.replacementPriceExVat) ??
      asNumber(payloadInput.userReplacementPriceExVat) ??
      asNumber(payloadOutput.userReplacementPriceExVat) ??
      asNumber(input.row.user_replacement_price_ex_vat),
    advancedAssumptions,
  };

  const result = await runServerValuation(valuationInput);
  const selectedMethod = resolveTractorMethod(input.preferredMethod, result);
  const selectedValueExVat = requireSelectedValue(getSelectedMethodValue(result, selectedMethod));
  const warning = undefined;
  const marketEvidence = neutralMarketEvidence();

  if (input.previewOnly) {
    return {
      item: buildPreviewAssetFromTractorValuation({
        asset: input.asset,
        result,
        selectedMethod,
        selectedValueExVat,
        year,
        hours,
        condition,
      }),
      valuationRunId: input.asset.valuationRunId ?? Number(input.row.id),
      selectedMethod,
      oldValueExVat: input.asset.value,
      newValueExVat: selectedValueExVat,
      warning,
      previewOnly: true,
      marketAdjustmentExVat: null,
      marketRawAverageExVat: null,
      replacementPriceUsedExVat: roundMoneyValue(result.replacementPriceUsedExVat),
      ...marketEvidence,
    };
  }

  const saved = await saveValuationRunFromResult(
    {
      ...valuationInput,
      selectedMethod,
      selectedValueOverrideExVat: selectedValueExVat,
      yearModelUnknown,
      valuationVersion: 'v1-revalue',
      userId: input.userId,
    },
    result,
  );
  const item = await updateAssetRegisterItemFromValuation({
    userId: input.userId,
    assetId: input.asset.id,
    valuationRunId: saved.runId,
    result,
    selectedMethod,
    selectedValueExVat,
    year,
    yearModelUnknown,
    hours,
    condition,
    saveReplacementPrice: input.saveReplacementPrice === true,
    allowUsageDecrease: input.allowUsageDecrease === true,
  });

  return {
    item,
    valuationRunId: saved.runId,
    selectedMethod,
    oldValueExVat: input.asset.value,
    newValueExVat: selectedValueExVat,
    warning,
    marketAdjustmentExVat: null,
    marketRawAverageExVat: null,
    replacementPriceUsedExVat: roundMoneyValue(result.replacementPriceUsedExVat),
    ...marketEvidence,
  };
}

async function revalueGenericAsset(input: {
  userId: string;
  asset: AssetRegisterItem;
  row: ValuationRunRow;
  preferredMethod: RevaluePreference;
  previewOnly?: boolean;
  replacementPriceExVat?: number | null;
  saveReplacementPrice?: boolean;
  advancedAssumptions?: AdvancedAssumptionsInput;
  lifeWorkedPercentOverride?: number | null;
  usageAmountOverride?: number | null;
  allowUsageDecrease?: boolean;
}): Promise<AssetRevaluationResult> {
  const payload = asRecord(input.row.valuation_payload);
  const payloadInput = readNestedRecord(payload, 'input');
  const payloadOutput = readNestedRecord(payload, 'output');
  const advancedAssumptions = typeof input.advancedAssumptions === 'undefined'
    ? readSavedAdvancedAssumptions(payloadInput, payloadOutput)
    : input.advancedAssumptions;
  const sectorKeyRaw = payloadInput.sectorKey ?? input.row.sector_key;

  if (!isSectorKey(sectorKeyRaw)) {
    throw new Error('This asset is missing its sector link, so Aim4price cannot re-run the estimate yet.');
  }

  const sectorKey: SectorKey = sectorKeyRaw;
  const familyKey = requireText(
    payloadInput.familyKey ?? input.row.family_key ?? input.asset.equipmentFamilyKey,
    'This asset is missing its equipment-family link, so Aim4price cannot re-run the estimate yet.',
  );
  const brandSlug = requireText(
    payloadInput.brandSlug ?? input.row.brand_slug,
    'This asset is missing its brand link, so Aim4price cannot re-run the estimate yet.',
  );
  const assetSpecs = cleanSpecsForValuation(input.asset.specsJson ?? {});
  const rowSpecs = cleanSpecsForValuation(asRecord(input.row.specs_json));
  const payloadSpecs = cleanSpecsForValuation(asRecord(payloadInput.specsJson));
  const specsJson = {
    ...payloadSpecs,
    ...rowSpecs,
    ...assetSpecs,
  };
  const yearModelUnknown = asBoolean(
    payloadInput.yearModelUnknown ??
      payloadInput.year_model_unknown ??
      specsJson.year_model_unknown ??
      specsJson.yearModelUnknown,
  );
  const year = Math.round(
    yearModelUnknown
      ? asNumber(payloadInput.year) ?? asNumber(payloadInput.calculationYear) ?? asNumber(input.row.year_model) ?? new Date().getFullYear()
      : requireNumber(
          input.asset.yearModel ?? payloadInput.year ?? input.row.year_model,
          'This asset is missing its year model, so Aim4price cannot re-run the estimate yet.',
        ),
  );
  const condition = normalizeGenericCondition(input.asset.condition || payloadInput.condition || input.row.condition);

  if (!condition) {
    throw new Error('This asset is missing its condition, so Aim4price cannot re-run the estimate yet.');
  }
  const savedLifeWorkedPercent = readLifeWorkedPercent(input.asset, payloadInput);
  const usePercentUsage = assetUsesPercentUsageForRevaluation(input.asset);
  const lifeWorkedPercentOverride = input.lifeWorkedPercentOverride;
  const hasLifeWorkedPercentOverride = typeof lifeWorkedPercentOverride !== 'undefined';

  if (hasLifeWorkedPercentOverride && !usePercentUsage) {
    throw new Error('ASSET_DOES_NOT_USE_LIFE_WORKED_PERCENT');
  }

  if (
    hasLifeWorkedPercentOverride &&
    lifeWorkedPercentOverride !== null &&
    savedLifeWorkedPercent !== null &&
    lifeWorkedPercentOverride < savedLifeWorkedPercent &&
    input.allowUsageDecrease !== true
  ) {
    throw new Error('LIFE_WORKED_PERCENT_CANNOT_DECREASE');
  }

  const lifeWorkedPercent = hasLifeWorkedPercentOverride ? lifeWorkedPercentOverride ?? null : savedLifeWorkedPercent;
  const savedUsageAmount = asNumber(input.asset.hours) ?? asNumber(payloadInput.usageAmount) ?? asNumber(input.row.hours);
  const usageAmountOverride = input.usageAmountOverride;
  const hasUsageAmountOverride = typeof usageAmountOverride !== 'undefined';

  if (hasUsageAmountOverride && usePercentUsage) {
    throw new Error('ASSET_DOES_NOT_USE_USAGE_READING');
  }

  if (
    hasUsageAmountOverride &&
    usageAmountOverride !== null &&
    savedUsageAmount !== null &&
    usageAmountOverride < savedUsageAmount &&
    input.allowUsageDecrease !== true
  ) {
    throw new Error('USAGE_READING_CANNOT_DECREASE');
  }

  const usageAmount = usePercentUsage
    ? null
    : hasUsageAmountOverride
      ? usageAmountOverride ?? null
      : savedUsageAmount;
  const replacementPriceOverrideExVat = optionalReplacementPrice(input.replacementPriceExVat);
  const userReplacementPriceExVat =
    replacementPriceOverrideExVat ??
    asNumber(input.asset.replacementPriceExVat) ??
    asNumber(payloadInput.userReplacementPriceExVat) ??
    asNumber(input.row.user_replacement_price_ex_vat);

  const result = await runGenericValuation({
    sectorKey,
    familyKey,
    brandSlug,
    typedModelName: input.asset.typedModelName || asText(payloadInput.typedModelName) || asText(input.row.typed_model_name) || null,
    specsJson,
    year,
    yearModelUnknown,
    usageAmount,
    lifeWorkedPercent,
    condition,
    userReplacementPriceExVat,
    userReplacementPriceYear: asInteger(payloadInput.userReplacementPriceYear ?? input.row.user_replacement_price_year),
    advancedAssumptions,
  });
  const selectedMethod = resolveGenericMethod(input.preferredMethod, result);
  const selectedValueExVat = requireSelectedValue(getGenericSelectedMethodValue(result, selectedMethod));
  const warning = undefined;
  const marketEvidence = neutralMarketEvidence();

  if (input.previewOnly) {
    return {
      item: buildPreviewAssetFromGenericValuation({
        asset: input.asset,
        result,
        selectedMethod,
        selectedValueExVat,
      }),
      valuationRunId: input.asset.valuationRunId ?? Number(input.row.id),
      selectedMethod,
      oldValueExVat: input.asset.value,
      newValueExVat: selectedValueExVat,
      warning,
      previewOnly: true,
      marketAdjustmentExVat: null,
      marketRawAverageExVat: null,
      replacementPriceUsedExVat: roundMoneyValue(result.replacementPriceUsedExVat),
      ...marketEvidence,
    };
  }

  const saved = await saveGenericValuationRunFromResult({
    userId: input.userId,
    result,
    selectedMethod,
    selectedValueOverrideExVat: selectedValueExVat,
    valuationVersion: 'generic-v1-revalue',
  });
  const item = await updateAssetRegisterItemFromGenericValuation({
    userId: input.userId,
    assetId: input.asset.id,
    valuationRunId: saved.runId,
    result,
    selectedMethod,
    selectedValueExVat,
    saveReplacementPrice: input.saveReplacementPrice === true,
    allowUsageDecrease: input.allowUsageDecrease === true,
  });

  return {
    item,
    valuationRunId: saved.runId,
    selectedMethod,
    oldValueExVat: input.asset.value,
    newValueExVat: selectedValueExVat,
    warning,
    marketAdjustmentExVat: null,
    marketRawAverageExVat: null,
    replacementPriceUsedExVat: roundMoneyValue(result.replacementPriceUsedExVat),
    ...marketEvidence,
  };
}

export async function revalueAssetRegisterItem(input: {
  userId: string;
  assetId: string;
  selectedMethod?: unknown;
  previewOnly?: boolean;
  replacementPriceExVat?: number | null;
  saveReplacementPrice?: boolean;
  advancedAssumptions?: AdvancedAssumptionsInput;
  lifeWorkedPercentOverride?: number | null;
  usageAmountOverride?: number | null;
  allowUsageDecrease?: boolean;
}): Promise<AssetRevaluationResult> {
  const asset = await getAssetRegisterItemById(input.userId, input.assetId);

  if (!asset) {
    throw new Error('ASSET_NOT_FOUND');
  }

  if (!asset.valuationRunId || asset.selectedMethod === 'manual') {
    throw new Error('ASSET_NOT_REVALUEABLE');
  }

  const row = await fetchValuationRun(input.userId, asset.valuationRunId);

  if (!row) {
    throw new Error('VALUATION_RUN_NOT_FOUND');
  }

  const preferredMethod = resolvePreferredMethod(asset, row, input.selectedMethod);
  const familyKey = asText(row.family_key || asset.equipmentFamilyKey).toLowerCase();
  const equipmentType = asText(row.equipment_type).toLowerCase();
  const hasLifeWorkedPercentOverride = typeof input.lifeWorkedPercentOverride !== 'undefined';

  if (hasLifeWorkedPercentOverride && !assetUsesPercentUsageForRevaluation(asset)) {
    throw new Error('ASSET_DOES_NOT_USE_LIFE_WORKED_PERCENT');
  }

  if (asset.kind === 'tractor' || familyKey === 'tractors' || equipmentType === 'tractor') {
    if (hasLifeWorkedPercentOverride) {
      throw new Error('ASSET_DOES_NOT_USE_LIFE_WORKED_PERCENT');
    }
    return revalueTractorAsset({
      userId: input.userId,
      asset,
      row,
      preferredMethod,
      previewOnly: input.previewOnly,
      replacementPriceExVat: input.replacementPriceExVat,
      saveReplacementPrice: input.saveReplacementPrice,
      advancedAssumptions: input.advancedAssumptions,
      usageAmountOverride: input.usageAmountOverride,
      allowUsageDecrease: input.allowUsageDecrease,
    });
  }

  return revalueGenericAsset({
    userId: input.userId,
    asset,
    row,
    preferredMethod,
    previewOnly: input.previewOnly,
    replacementPriceExVat: input.replacementPriceExVat,
    saveReplacementPrice: input.saveReplacementPrice,
    advancedAssumptions: input.advancedAssumptions,
    lifeWorkedPercentOverride: input.lifeWorkedPercentOverride,
    usageAmountOverride: input.usageAmountOverride,
    allowUsageDecrease: input.allowUsageDecrease,
  });
}
