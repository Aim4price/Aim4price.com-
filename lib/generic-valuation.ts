import { getBasicCatalogueFamily } from './basic-catalogue';
import { resolveCatalogueGuide } from './basic-catalogue-guide';
import type { BasicSpecificationLevel } from './basic-estimate';
import { getDb } from './db';
import {
  DEFAULT_ENGINE_FLOOR_PERCENT,
  DEFAULT_FALLBACK_LIFETIME_USED_PERCENT,
  DEFAULT_NON_PROPELLED_FLOOR_PERCENT,
  applyCondition,
  calculateEngineHoursValue,
  clamp,
  currentBaseYear,
  getValuationConditionFactorOverride,
  normalizeAdvancedAssumptions,
  tractorAgeDepPct,
  tractorLifetimeHours,
  type AdvancedAssumptionsInput,
  type NormalizedAdvancedAssumptions,
} from './valuation/shared';
import {
  calculateOlderPassengerCarMarketability,
  resolveSalvageValue,
} from './valuation/valuation-rules';
import {
  getUsageSentenceLabel,
  isUsageAmountMetric,
  type CatalogMode,
  type EquipmentFamilyKey,
  type SectorKey,
  type UsageMetricType,
  type ValuationMode,
} from './equipment-types';

export type GenericCondition = 'excellent' | 'good' | 'fair' | 'used' | 'serious';
export type GenericSelectedMethod = 'aim4price';
export type DepreciationMethodUsed = 'full_depreciation' | 'semi_depreciation' | 'percentage_depreciation';
export type ReplacementPriceBasis = 'aim4price' | 'user';

export type GenericValuationCalculation = {
  replacementPriceBasis: ReplacementPriceBasis;
  replacementPriceExVat: number | null;
  depreciationMethodUsed: DepreciationMethodUsed;
  depreciationBaseValueExVat: number | null;
  aim4priceValueExVat: number | null;
  valuationLowExVat: number | null;
  valuationMidExVat: number | null;
  valuationHighExVat: number | null;
  marketWeight: number;
  lifeWorkedPercent: number | null;
  lifeRemainingPercent: number | null;
  estimatedHours: number | null;
  maxLifetimeHours: number | null;
  ageDepPct: number | null;
  usageDepPct: number | null;
  averageDepPct: number | null;
  marketabilityFactor: number;
  marketabilityReductionPercent: number;
  salvagePercent: number | null;
  salvageValueExVat: number | null;
  isSalvageEstimate: boolean;
  advancedAssumptions: NormalizedAdvancedAssumptions | null;
};

export type SpecQuestion = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  familyId: number;
  familyKey: EquipmentFamilyKey;
  specKey: string;
  label: string;
  inputType: 'number' | 'select' | 'boolean' | 'text' | 'money';
  unit: string | null;
  isRequired: boolean;
  affectsValue: boolean;
  useForMarketMatching: boolean;
  sortOrder: number;
  helpText: string | null;
  options: SpecOption[];
};

export type SpecOption = {
  id: number;
  specQuestionId: number;
  optionValue: string;
  optionLabel: string;
  sortOrder: number;
};

export type ReplacementPriceBand = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  familyId: number;
  familyKey: EquipmentFamilyKey;
  brandId: number | null;
  brandSlug: string | null;
  brandName: string | null;
  bandKey: string;
  bandLabel: string;
  specMatchJson: Record<string, unknown>;
  replacementMinExVat: number;
  replacementMaxExVat: number;
  replacementPriceYear: number;
  confidence: number;
  sortOrder: number;
  notes: string | null;
};

export type MarketMatch = {
  id: number;
  title: string;
  brandName: string;
  modelName: string;
  normalizedModelName: string;
  advertisedPriceExVat: number;
  yearModel: number | null;
  usageAmount: number | null;
  condition: string | null;
  sourceName: string;
  sourceUrl: string;
  dateAdvertised: string | null;
  specsJson: Record<string, unknown>;
  matchScore: number;
  matchReason: string;
};

export type GenericValuationInput = {
  sectorKey: SectorKey;
  familyKey: EquipmentFamilyKey;
  brandSlug: string;
  equipmentModelId?: number | null;
  typedModelName?: string | null;
  saveModelCandidate?: boolean | null;
  specsJson?: Record<string, unknown> | null;
  year: number;
  yearModelUnknown?: boolean | null;
  usageAmount?: number | null;
  lifeWorkedPercent?: number | null;
  condition: GenericCondition;
  userReplacementPriceExVat?: number | null;
  userReplacementPriceYear?: number | null;
  advancedAssumptions?: AdvancedAssumptionsInput | null;
};

export type GenericValuationResult = {
  catalogModeUsed: CatalogMode;
  sector: { id: number; key: SectorKey; label: string };
  family: {
    id: number | null;
    key: EquipmentFamilyKey;
    label: string;
    usageMetricType: UsageMetricType;
    valuationMode: ValuationMode;
    isPropelled: boolean;
    catalogMode: CatalogMode;
  };
  brand: { id: number; slug: string; name: string };
  typedModelName: string | null;
  normalizedTypedModelName: string | null;
  specsJson: Record<string, unknown>;
  year: number;
  yearModelUnknown?: boolean | null;
  usageAmount: number | null;
  condition: GenericCondition;
  replacementPriceBand: ReplacementPriceBand | null;
  replacementPriceMinExVat: number | null;
  replacementPriceMaxExVat: number | null;
  replacementPriceUsedExVat: number | null;
  userReplacementPriceExVat: number | null;
  userReplacementPriceYear: number | null;
  replacementPriceBasis: ReplacementPriceBasis;
  depreciationMethodUsed: DepreciationMethodUsed;
  lifeWorkedPercent: number | null;
  lifeRemainingPercent: number | null;
  estimatedHours: number | null;
  maxLifetimeHours: number | null;
  advancedAssumptions: NormalizedAdvancedAssumptions | null;
  aim4priceReplacementCalculation: GenericValuationCalculation | null;
  userReplacementCalculation: GenericValuationCalculation | null;
  selectedCalculation: GenericValuationCalculation | null;
  genericEstimateExVat: number | null;
  aim4priceValueExVat: number | null;
  marketAverageExVat: number | null;
  marketAverageCount: number;
  marketMatchStrategy: 'exact_model' | 'typed_model' | 'brand_specs' | 'family_specs' | 'none';
  marketSources: MarketMatch[];
  valuationLowExVat: number | null;
  valuationMidExVat: number | null;
  valuationHighExVat: number | null;
  confidenceScore: number;
  confidenceLabel: 'High' | 'Medium' | 'Low';
  notes: string[];
};

type DbRecord = Record<string, unknown>;

type FamilyContext = GenericValuationResult['family'] & {
  sectorId: number;
  sectorKey: SectorKey;
  sectorLabel: string;
};

type BrandContext = GenericValuationResult['brand'];

type EquipmentModelContext = {
  id: number;
  brandId: number | null;
  aim4ModelKey: string | null;
  modelName: string;
  displayName: string;
  normalizedModelName: string;
  specsJson: Record<string, unknown>;
};

type MotorPricingMatrixRow = {
  id: number;
  equipmentFamilyId: number;
  equipmentModelId: number;
  modelKey: string;
  typeKey: string;
  typeLabel: string;
  driveType: string;
  transmission: string;
  specLevel: 'Entry' | 'Mid' | 'Luxury';
  replacementPriceExVat: number | null;
  replacementPriceIncVat: number | null;
  priceLowExVat: number | null;
  priceMidExVat: number | null;
  priceHighExVat: number | null;
  priceLowIncVat: number | null;
  priceMidIncVat: number | null;
  priceHighIncVat: number | null;
  defaultVatDisplay: 'incl' | 'excl';
  sourcePriceBasis: string | null;
  confidenceScore: number | null;
  sourceUrls: string | null;
  sourceNotes: string | null;
};

type MotorUsageProfile = {
  id: number;
  familyKey: string;
  typeKey: string;
  usefulLifeKm: number | null;
  highUsageWarningKm: number | null;
  extremeUsageWarningKm: number | null;
  hardInputCapKm: number | null;
  residualFloorPct: number | null;
  notes: string | null;
};

export function normalizeModelKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function toNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toInteger(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : null;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', 'f', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
}

function asObject(value: unknown): Record<string, unknown> {
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

function roundMoney(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.round(value);
}

function normalizeCondition(value: unknown): GenericCondition {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === 'excellent' || normalized === 'good' || normalized === 'fair' || normalized === 'used' || normalized === 'serious') {
    return normalized;
  }
  return 'good';
}


function coerceSpecValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const numeric = Number(trimmed.replace(',', '.'));
    if (Number.isFinite(numeric) && /^-?\d+(?:[.,]\d+)?$/.test(trimmed)) return numeric;
    if (['true', 'yes', 'y'].includes(trimmed.toLowerCase())) return true;
    if (['false', 'no', 'n'].includes(trimmed.toLowerCase())) return false;
    return trimmed;
  }
  return value;
}

export function normalizeSpecsJson(value: unknown): Record<string, unknown> {
  const source = asObject(value);
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, rawValue]) => [key.trim(), coerceSpecValue(rawValue)] as const)
      .filter(([key, rawValue]) => key && rawValue !== '' && rawValue !== null && typeof rawValue !== 'undefined'),
  );
}

function compareSpecValue(expected: unknown, actual: unknown): boolean {
  if (expected === null || typeof expected === 'undefined') return true;

  if (typeof expected === 'boolean') {
    return toBoolean(actual) === expected;
  }

  const expectedNumber = toNumber(expected);
  const actualNumber = toNumber(actual);

  if (expectedNumber !== null && actualNumber !== null) {
    return Math.abs(expectedNumber - actualNumber) < 0.0001;
  }

  return cleanText(expected).toLowerCase() === cleanText(actual).toLowerCase();
}

function bandMatchesSpecs(band: ReplacementPriceBand, specs: Record<string, unknown>): boolean {
  const criteria = band.specMatchJson;

  for (const [rawKey, expected] of Object.entries(criteria)) {
    if (rawKey.endsWith('_min')) {
      const baseKey = rawKey.slice(0, -4);
      const actual = toNumber(specs[baseKey]);
      const minimum = toNumber(expected);
      if (minimum !== null && (actual === null || actual < minimum)) return false;
      continue;
    }

    if (rawKey.endsWith('_max')) {
      const baseKey = rawKey.slice(0, -4);
      const actual = toNumber(specs[baseKey]);
      const maximum = toNumber(expected);
      if (maximum !== null && (actual === null || actual > maximum)) return false;
      continue;
    }

    if (!compareSpecValue(expected, specs[rawKey])) {
      return false;
    }
  }

  return true;
}

function scoreBand(band: ReplacementPriceBand): number {
  return Object.keys(band.specMatchJson).length * 10 + (band.brandId ? 5 : 0) + band.confidence;
}

type DepreciationInput = {
  sectorKey: SectorKey;
  replacementPrice: number | null;
  year: number;
  yearModelUnknown?: boolean | null;
  usageAmount: number | null;
  lifeWorkedPercent: number | null;
  usageMetricType: UsageMetricType;
  valuationMode: ValuationMode;
  condition: GenericCondition;
  isPropelled: boolean;
  familyKey: EquipmentFamilyKey;
  specsJson: Record<string, unknown>;
  advancedAssumptions: NormalizedAdvancedAssumptions | null;
};

function positivePercent(value: unknown): number | null {
  const numeric = toNumber(value);
  if (numeric === null || numeric < 0) return null;
  return clamp(numeric, 0, 100);
}

function positiveUsageAmount(value: unknown): number | null {
  const numeric = toNumber(value);
  if (numeric === null || numeric <= 0) return null;
  return Math.round(numeric);
}

function resolveLifeWorkedPercent(input: DepreciationInput, fallbackPercent: number): number {
  const direct = positivePercent(input.lifeWorkedPercent);
  if (direct !== null) return direct;

  const specs = input.specsJson;
  const specPercent =
    positivePercent(specs.life_worked_percent) ??
    positivePercent(specs.worked_percent) ??
    positivePercent(specs.lifetime_worked_percent) ??
    positivePercent(specs.percent_worked) ??
    positivePercent(specs.lifetime_used_percent);

  if (specPercent !== null) return specPercent;
  return clamp(fallbackPercent, 0, 100);
}

function isPercentageBasisValue(value: unknown): boolean {
  const normalized = cleanText(value).toLowerCase();
  return (
    normalized === 'percent' ||
    normalized === 'percentage' ||
    normalized === 'percent_used' ||
    normalized === 'percentage_used' ||
    normalized === 'percentage_depreciation' ||
    normalized === 'life_worked_percent' ||
    normalized === 'worked_percent' ||
    normalized === 'lifetime_percent' ||
    normalized === 'wear_class'
  );
}

function specsUseExplicitPercentageBasis(specs: Record<string, unknown>): boolean {
  return (
    isPercentageBasisValue(specs.usageMode) ||
    isPercentageBasisValue(specs.usage_mode) ||
    isPercentageBasisValue(specs.usageBasis) ||
    isPercentageBasisValue(specs.usage_basis) ||
    isPercentageBasisValue(specs.valuationMode) ||
    isPercentageBasisValue(specs.valuation_mode) ||
    isPercentageBasisValue(specs.depreciationMethodUsed) ||
    isPercentageBasisValue(specs.depreciation_method_used) ||
    isPercentageBasisValue(specs.selectedDepreciationMethod) ||
    isPercentageBasisValue(specs.selected_depreciation_method) ||
    isPercentageBasisValue(specs.selectedUsageMode) ||
    isPercentageBasisValue(specs.selected_usage_mode)
  );
}

function resolveMaxLifetimeHours(input: DepreciationInput): number {
  const advancedLifetime = positiveUsageAmount(input.advancedAssumptions?.maxLifetimeUsage);
  if (advancedLifetime !== null) return advancedLifetime;

  const specs = input.specsJson;
  const explicit =
    positiveUsageAmount(specs.max_lifetime_hours) ??
    positiveUsageAmount(specs.expected_lifetime_hours) ??
    positiveUsageAmount(specs.lifetime_hours) ??
    positiveUsageAmount(specs.design_life_hours) ??
    positiveUsageAmount(specs.max_lifetime_km) ??
    positiveUsageAmount(specs.expected_lifetime_km) ??
    positiveUsageAmount(specs.lifetime_km) ??
    positiveUsageAmount(specs.design_life_km);

  if (explicit !== null) return explicit;

  const familyKey = cleanText(input.familyKey).toLowerCase();

  // Motor uses the existing engine-hours depreciation path. In this case
  // maxLifetimeHours is intentionally interpreted as max lifetime kilometres.
  if (input.usageMetricType === 'km') {
    if (familyKey.includes('car') || familyKey.includes('suv')) return 300_000;
    if (familyKey.includes('bakkie') || familyKey.includes('ldv') || familyKey.includes('pickup')) return 350_000;
    if (familyKey.includes('light_commercial') || familyKey.includes('van')) return 450_000;
    if (familyKey.includes('truck')) return 800_000;
    if (familyKey.includes('bus')) return 900_000;
    if (familyKey.includes('trailer')) return 700_000;
    return 350_000;
  }

  if (input.familyKey === 'tractors') {
    const powerKw = toNumber(specs.power_kw) ?? 75;
    const tractorType = cleanText(specs.tractor_type).toLowerCase() === 'orchard' ? 'orchard' : 'field';
    return tractorLifetimeHours(tractorType, powerKw);
  }

  if (familyKey.includes('harvester')) return 8_000;
  if (familyKey.includes('sprayer')) return 8_000;
  if (familyKey.includes('loader')) return 10_000;
  if (familyKey.includes('excavator')) return 12_000;
  if (familyKey.includes('forklift')) return 12_000;
  if (familyKey.includes('generator')) return 15_000;
  if (familyKey.includes('compressor')) return 12_000;
  if (familyKey.includes('telehandler')) return 10_000;
  if (familyKey.includes('grader')) return 12_000;
  if (familyKey.includes('roller') || familyKey.includes('compactor')) return 10_000;

  return 12_000;
}

function normalizeResidualFloorFactor(value: unknown, fallbackPercent: number): number {
  const numeric = toNumber(value);
  if (numeric === null || numeric < 0) return fallbackPercent;

  // Some catalogue rows store residual floors as whole percentages, for example
  // 12 for 12%. The depreciation engine expects a factor, for example 0.12.
  const factor = numeric > 1 ? numeric / 100 : numeric;
  return clamp(factor, 0, 1);
}

function resolveResidualFloorPercent(input: DepreciationInput, fallbackPercent: number): number {
  // Motor must stay on the same engine-hours depreciation mechanics as tractors.
  // Kilometres are passed through the existing "hours" input, but Motor must not
  // apply a separate motor-specific residual floor from catalogue/profile data.
  if (input.usageMetricType === 'km') return fallbackPercent;

  return normalizeResidualFloorFactor(input.specsJson.residual_floor_pct, fallbackPercent);
}


type AgeAwarePercentValueResult = {
  percentUsed: number;
  remainingPercent: number;
  ageDepPct: number | null;
  usageDepPct: number;
  averageDepPct: number;
  baseValueExVat: number;
  conditionAdjustedValueExVat: number;
  marketabilityAdjustedValueExVat: number;
  salvagePercent: number;
  salvageValueExVat: number;
  isSalvageEstimate: boolean;
  finalValueExVat: number;
};

function shouldBlendAgeIntoPercentageDepreciation(input: DepreciationInput): boolean {
  // Percentage-basis valuations must stay percentage-based, but a saved year
  // model should still move the preview value. Blend age depreciation with the
  // saved worked percentage instead of stacking both in full. This mirrors the
  // existing engine-hours convention of averaging age and usage depreciation.
  return !input.yearModelUnknown;
}

function calculateAgeAwarePercentValue(input: {
  replacementPriceExVat: number;
  percentUsed: number;
  yearModel: number;
  includeAgeDepreciation: boolean;
  condition: GenericCondition;
  floorPercent?: number;
  conditionFactorOverride?: number | null;
  marketabilityFactor?: number | null;
}): AgeAwarePercentValueResult {
  const replacementPriceExVat = Math.max(0, Number(input.replacementPriceExVat) || 0);
  const usageDepPct = clamp(Math.round(Number(input.percentUsed) || 0), 0, 100);
  const remainingPercent = 100 - usageDepPct;
  const ageDepPct = input.includeAgeDepreciation ? tractorAgeDepPct(input.yearModel) : null;
  const averageDepPct = ageDepPct === null ? usageDepPct : Math.round((ageDepPct + usageDepPct) / 2);
  const baseValueExVat = replacementPriceExVat * (1 - averageDepPct / 100);
  const conditionAdjustedValueExVat = applyCondition(baseValueExVat, input.condition, input.conditionFactorOverride);
  const marketabilityFactor = clamp(Number(input.marketabilityFactor) || 1, 0, 1);
  const marketabilityAdjustedValueExVat = conditionAdjustedValueExVat * marketabilityFactor;
  const salvage = resolveSalvageValue(marketabilityAdjustedValueExVat, replacementPriceExVat);

  return {
    percentUsed: usageDepPct,
    remainingPercent,
    ageDepPct,
    usageDepPct,
    averageDepPct,
    baseValueExVat: Math.round(baseValueExVat),
    conditionAdjustedValueExVat: Math.round(conditionAdjustedValueExVat),
    marketabilityAdjustedValueExVat: Math.round(marketabilityAdjustedValueExVat),
    salvagePercent: salvage.salvagePercent,
    salvageValueExVat: salvage.salvageValueExVat,
    isSalvageEstimate: salvage.isSalvageEstimate,
    finalValueExVat: salvage.finalValueExVat,
  };
}

function resolveDepreciation(input: DepreciationInput): {
  method: DepreciationMethodUsed;
  depreciationBaseValueExVat: number | null;
  lifeWorkedPercent: number | null;
  lifeRemainingPercent: number | null;
  estimatedHours: number | null;
  maxLifetimeHours: number | null;
  ageDepPct: number | null;
  usageDepPct: number | null;
  averageDepPct: number | null;
  marketabilityFactor: number;
  marketabilityReductionPercent: number;
  salvagePercent: number | null;
  salvageValueExVat: number | null;
  isSalvageEstimate: boolean;
} {
  const marketability = calculateOlderPassengerCarMarketability({
    sectorKey: input.sectorKey,
    familyKey: input.familyKey,
    bodyType: input.specsJson.body_type ?? input.specsJson.vehicle_type,
    yearModel: input.year,
    yearModelUnknown: input.yearModelUnknown,
  });

  if (!input.replacementPrice || input.replacementPrice <= 0) {
    const fallbackMethod: DepreciationMethodUsed = input.valuationMode === 'year_condition' || input.isPropelled || isUsageAmountMetric(input.usageMetricType)
      ? 'semi_depreciation'
      : 'percentage_depreciation';

    return {
      method: fallbackMethod,
      depreciationBaseValueExVat: null,
      lifeWorkedPercent: null,
      lifeRemainingPercent: null,
      estimatedHours: null,
      maxLifetimeHours: input.valuationMode === 'year_condition' ? null : input.isPropelled || isUsageAmountMetric(input.usageMetricType) ? resolveMaxLifetimeHours(input) : null,
      ageDepPct: null,
      usageDepPct: null,
      averageDepPct: null,
      marketabilityFactor: marketability.factor,
      marketabilityReductionPercent: marketability.reductionPercent,
      salvagePercent: null,
      salvageValueExVat: null,
      isSalvageEstimate: false,
    };
  }

  const yearForDepreciation = input.yearModelUnknown ? currentBaseYear() : Math.round(input.year);

  // Family-first Basic Estimate can explicitly mark families where usage is not
  // a meaningful measurement. Keep the shared age, condition, marketability and
  // salvage mathematics, but do not invent a percentage-worked fallback.
  if (input.valuationMode === 'year_condition') {
    const ageDepPct = input.yearModelUnknown ? 0 : tractorAgeDepPct(yearForDepreciation);
    const ageAdjustedValue = input.replacementPrice * (1 - ageDepPct / 100);
    const conditionAdjustedValue = applyCondition(
      ageAdjustedValue,
      input.condition,
      getValuationConditionFactorOverride(input.condition, input.advancedAssumptions),
    );
    const marketabilityAdjustedValue = conditionAdjustedValue * marketability.factor;
    const salvage = resolveSalvageValue(marketabilityAdjustedValue, input.replacementPrice);

    return {
      method: 'semi_depreciation',
      depreciationBaseValueExVat: salvage.finalValueExVat,
      lifeWorkedPercent: null,
      lifeRemainingPercent: null,
      estimatedHours: null,
      maxLifetimeHours: null,
      ageDepPct,
      usageDepPct: null,
      averageDepPct: ageDepPct,
      marketabilityFactor: marketability.factor,
      marketabilityReductionPercent: marketability.reductionPercent,
      salvagePercent: salvage.salvagePercent,
      salvageValueExVat: salvage.salvageValueExVat,
      isSalvageEstimate: salvage.isSalvageEstimate,
    };
  }

  const explicitPercentageBasis =
    input.valuationMode === 'percent_used' ||
    specsUseExplicitPercentageBasis(input.specsJson) ||
    input.usageMetricType === 'wear_class';

  if (explicitPercentageBasis) {
    const lifeWorkedPercent = resolveLifeWorkedPercent(input, 50);
    const calculated = calculateAgeAwarePercentValue({
      replacementPriceExVat: input.replacementPrice,
      percentUsed: lifeWorkedPercent,
      yearModel: yearForDepreciation,
      includeAgeDepreciation: shouldBlendAgeIntoPercentageDepreciation(input),
      condition: input.condition,
      floorPercent: resolveResidualFloorPercent(input, DEFAULT_NON_PROPELLED_FLOOR_PERCENT),
      conditionFactorOverride: getValuationConditionFactorOverride(input.condition, input.advancedAssumptions),
      marketabilityFactor: marketability.factor,
    });

    return {
      method: 'percentage_depreciation',
      depreciationBaseValueExVat: calculated.finalValueExVat,
      lifeWorkedPercent: calculated.percentUsed,
      lifeRemainingPercent: calculated.remainingPercent,
      estimatedHours: null,
      maxLifetimeHours: null,
      ageDepPct: calculated.ageDepPct,
      usageDepPct: calculated.usageDepPct,
      averageDepPct: calculated.averageDepPct,
      marketabilityFactor: marketability.factor,
      marketabilityReductionPercent: marketability.reductionPercent,
      salvagePercent: calculated.salvagePercent,
      salvageValueExVat: calculated.salvageValueExVat,
      isSalvageEstimate: calculated.isSalvageEstimate,
    };
  }

  if (input.isPropelled || isUsageAmountMetric(input.usageMetricType)) {
    const maxLifetimeHours = resolveMaxLifetimeHours(input);
    const knownHours = positiveUsageAmount(input.usageAmount);

    if (knownHours !== null) {
      const calculated = calculateEngineHoursValue({
        replacementPriceExVat: input.replacementPrice,
        yearModel: yearForDepreciation,
        hours: knownHours,
        condition: input.condition,
        maxLifetimeHours,
        floorPercent: resolveResidualFloorPercent(input, DEFAULT_ENGINE_FLOOR_PERCENT),
        conditionFactorOverride: getValuationConditionFactorOverride(input.condition, input.advancedAssumptions),
        marketabilityFactor: marketability.factor,
      });
      const lifeWorkedPercent = clamp(Math.round((knownHours / maxLifetimeHours) * 100), 0, 100);

      return {
        method: 'full_depreciation',
        depreciationBaseValueExVat: calculated.finalValueExVat,
        lifeWorkedPercent,
        lifeRemainingPercent: 100 - lifeWorkedPercent,
        estimatedHours: knownHours,
        maxLifetimeHours,
        ageDepPct: calculated.ageDepPct,
        usageDepPct: calculated.usageDepPct,
        averageDepPct: calculated.averageDepPct,
        marketabilityFactor: marketability.factor,
        marketabilityReductionPercent: marketability.reductionPercent,
        salvagePercent: calculated.salvagePercent,
        salvageValueExVat: calculated.salvageValueExVat,
        isSalvageEstimate: calculated.isSalvageEstimate,
      };
    }

    const lifeWorkedPercent = resolveLifeWorkedPercent(input, DEFAULT_FALLBACK_LIFETIME_USED_PERCENT * 100);
    const estimatedHours = Math.round(maxLifetimeHours * (lifeWorkedPercent / 100));
    const calculated = calculateEngineHoursValue({
      replacementPriceExVat: input.replacementPrice,
      yearModel: yearForDepreciation,
      hours: estimatedHours,
      condition: input.condition,
      maxLifetimeHours,
      floorPercent: resolveResidualFloorPercent(input, DEFAULT_ENGINE_FLOOR_PERCENT),
      conditionFactorOverride: getValuationConditionFactorOverride(input.condition, input.advancedAssumptions),
      marketabilityFactor: marketability.factor,
    });

    return {
      method: 'semi_depreciation',
      depreciationBaseValueExVat: calculated.finalValueExVat,
      lifeWorkedPercent,
      lifeRemainingPercent: 100 - lifeWorkedPercent,
      estimatedHours,
      maxLifetimeHours,
      ageDepPct: calculated.ageDepPct,
      usageDepPct: calculated.usageDepPct,
      averageDepPct: calculated.averageDepPct,
      marketabilityFactor: marketability.factor,
      marketabilityReductionPercent: marketability.reductionPercent,
      salvagePercent: calculated.salvagePercent,
      salvageValueExVat: calculated.salvageValueExVat,
      isSalvageEstimate: calculated.isSalvageEstimate,
    };
  }

  const lifeWorkedPercent = resolveLifeWorkedPercent(input, 50);
  const calculated = calculateAgeAwarePercentValue({
    replacementPriceExVat: input.replacementPrice,
    percentUsed: lifeWorkedPercent,
    yearModel: yearForDepreciation,
    includeAgeDepreciation: shouldBlendAgeIntoPercentageDepreciation(input),
    condition: input.condition,
    floorPercent: resolveResidualFloorPercent(input, DEFAULT_NON_PROPELLED_FLOOR_PERCENT),
    conditionFactorOverride: getValuationConditionFactorOverride(input.condition, input.advancedAssumptions),
    marketabilityFactor: marketability.factor,
  });

  return {
    method: 'percentage_depreciation',
    depreciationBaseValueExVat: calculated.finalValueExVat,
    lifeWorkedPercent: calculated.percentUsed,
    lifeRemainingPercent: calculated.remainingPercent,
    estimatedHours: null,
    maxLifetimeHours: null,
    ageDepPct: calculated.ageDepPct,
    usageDepPct: calculated.usageDepPct,
    averageDepPct: calculated.averageDepPct,
    marketabilityFactor: marketability.factor,
    marketabilityReductionPercent: marketability.reductionPercent,
    salvagePercent: calculated.salvagePercent,
    salvageValueExVat: calculated.salvageValueExVat,
    isSalvageEstimate: calculated.isSalvageEstimate,
  };
}

function buildCalculation(input: DepreciationInput & {
  replacementPriceBasis: ReplacementPriceBasis;
}): GenericValuationCalculation {
  const depreciation = resolveDepreciation(input);
  const aim4priceValueExVat = depreciation.depreciationBaseValueExVat;
  const spread = 0.08;
  const valuationLowExVat = aim4priceValueExVat === null ? null : roundMoney(aim4priceValueExVat * (1 - spread));
  const valuationHighExVat = aim4priceValueExVat === null ? null : roundMoney(aim4priceValueExVat * (1 + spread));

  return {
    replacementPriceBasis: input.replacementPriceBasis,
    replacementPriceExVat: input.replacementPrice,
    depreciationMethodUsed: depreciation.method,
    depreciationBaseValueExVat: depreciation.depreciationBaseValueExVat,
    aim4priceValueExVat,
    valuationLowExVat,
    valuationMidExVat: aim4priceValueExVat,
    valuationHighExVat,
    marketWeight: 0,
    lifeWorkedPercent: depreciation.lifeWorkedPercent,
    lifeRemainingPercent: depreciation.lifeRemainingPercent,
    estimatedHours: depreciation.estimatedHours,
    maxLifetimeHours: depreciation.maxLifetimeHours,
    ageDepPct: depreciation.ageDepPct,
    usageDepPct: depreciation.usageDepPct,
    averageDepPct: depreciation.averageDepPct,
    marketabilityFactor: depreciation.marketabilityFactor,
    marketabilityReductionPercent: depreciation.marketabilityReductionPercent,
    salvagePercent: depreciation.salvagePercent,
    salvageValueExVat: depreciation.salvageValueExVat,
    isSalvageEstimate: depreciation.isSalvageEstimate,
    advancedAssumptions: input.advancedAssumptions ?? null,
  };
}

function confidenceLabel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 0.74) return 'High';
  if (score >= 0.50) return 'Medium';
  return 'Low';
}

export async function listFamilySpecQuestions(input: {
  sectorKey?: SectorKey | null;
  familyKey: EquipmentFamilyKey;
  includeInactive?: boolean;
}): Promise<SpecQuestion[]> {
  const db = getDb();
  const values: Array<string | boolean> = [input.familyKey];
  const conditions = ['ef.family_key = $1'];

  if (input.sectorKey) {
    values.push(input.sectorKey);
    conditions.push(`s.sector_key = $${values.length}`);
  }

  if (!input.includeInactive) {
    conditions.push('q.is_active = true');
    conditions.push('ef.is_active = true');
    conditions.push('s.is_active = true');
  }

  const result = await db.query<DbRecord>(
    `
      select
        q.id,
        s.id as sector_id,
        s.sector_key,
        ef.id as equipment_family_id,
        ef.family_key,
        q.spec_key,
        q.label,
        q.input_type,
        q.unit,
        q.is_required,
        q.affects_value,
        q.use_for_market_matching,
        q.sort_order,
        q.help_text,
        coalesce(
          json_agg(
            json_build_object(
              'id', o.id,
              'specQuestionId', o.spec_question_id,
              'optionValue', o.option_value,
              'optionLabel', o.option_label,
              'sortOrder', o.sort_order
            )
            order by o.sort_order asc, o.option_label asc
          ) filter (where o.id is not null),
          '[]'::json
        ) as options
      from public.equipment_family_spec_questions q
      join public.equipment_families ef on ef.id = q.equipment_family_id
      join public.sectors s on s.id = ef.sector_id
      left join public.equipment_family_spec_options o
        on o.spec_question_id = q.id
       and ($${values.length + 1}::boolean = true or o.is_active = true)
      where ${conditions.join(' and ')}
      group by q.id, s.id, s.sector_key, ef.id, ef.family_key
      order by q.sort_order asc, q.label asc
    `,
    [...values, Boolean(input.includeInactive)],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    sectorId: Number(row.sector_id),
    sectorKey: cleanText(row.sector_key) as SectorKey,
    familyId: Number(row.equipment_family_id),
    familyKey: cleanText(row.family_key),
    specKey: cleanText(row.spec_key),
    label: cleanText(row.label),
    inputType: (cleanText(row.input_type) || 'text') as SpecQuestion['inputType'],
    unit: cleanText(row.unit) || null,
    isRequired: toBoolean(row.is_required),
    affectsValue: toBoolean(row.affects_value, true),
    useForMarketMatching: toBoolean(row.use_for_market_matching, true),
    sortOrder: toInteger(row.sort_order) ?? 100,
    helpText: cleanText(row.help_text) || null,
    options: Array.isArray(row.options)
      ? row.options.map((option) => ({
          id: Number((option as DbRecord).id),
          specQuestionId: Number((option as DbRecord).specQuestionId),
          optionValue: cleanText((option as DbRecord).optionValue),
          optionLabel: cleanText((option as DbRecord).optionLabel),
          sortOrder: toInteger((option as DbRecord).sortOrder) ?? 100,
        }))
      : [],
  }));
}

async function fetchFamilyContext(sectorKey: SectorKey, familyKey: EquipmentFamilyKey): Promise<FamilyContext | null> {
  const db = getDb();
  const result = await db.query<DbRecord>(
    `
      select
        s.id as sector_id,
        s.sector_key,
        s.sector_label,
        ef.id as family_id,
        ef.family_key,
        ef.family_label,
        ef.usage_metric_type,
        ef.valuation_mode,
        ef.is_propelled,
        coalesce(ef.catalog_mode, 'generic_specs') as catalog_mode
      from public.equipment_families ef
      join public.sectors s on s.id = ef.sector_id
      where s.sector_key = $1
        and ef.family_key = $2
      limit 1
    `,
    [sectorKey, familyKey],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    sectorId: Number(row.sector_id),
    sectorKey: cleanText(row.sector_key) as SectorKey,
    sectorLabel: cleanText(row.sector_label),
    id: Number(row.family_id),
    key: cleanText(row.family_key),
    label: cleanText(row.family_label),
    usageMetricType: (cleanText(row.usage_metric_type) || 'wear_class') as UsageMetricType,
    valuationMode: (cleanText(row.valuation_mode) || 'year_condition') as ValuationMode,
    isPropelled: toBoolean(row.is_propelled),
    catalogMode: (cleanText(row.catalog_mode) || 'generic_specs') as CatalogMode,
  };
}

async function fetchBasicBrandContext(slug: string): Promise<BrandContext | null> {
  const result = await getDb().query('select id, slug, name from public.brands where slug = $1 and is_active = true limit 1', [slug]);
  const row = result.rows[0];
  return row ? { id: Number(row.id), slug: row.slug, name: row.name } : null;
}

async function fetchBrandContext(familyId: number, brandSlug: string): Promise<BrandContext | null> {
  const db = getDb();
  const result = await db.query<DbRecord>(
    `
      select b.id, b.slug, b.name
      from public.equipment_family_brands efb
      join public.brands b on b.id = efb.brand_id
      where efb.equipment_family_id = $1
        and b.slug = $2
        and coalesce(efb.is_active, true) = true
        and coalesce(b.is_active, true) = true
      limit 1
    `,
    [familyId, brandSlug],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    slug: cleanText(row.slug),
    name: cleanText(row.name),
  };
}


function normalizeMotorOption(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeMotorSpecLevel(value: unknown): 'Entry' | 'Mid' | 'Luxury' | null {
  const normalized = normalizeMotorOption(value);
  if (!normalized) return null;
  if (['entry', 'base', 'standard', 'low', 'workhorse', 'utility'].includes(normalized)) return 'Entry';
  if (['mid', 'medium', 'average', 'core'].includes(normalized)) return 'Mid';
  if (['luxury', 'premium', 'high', 'top', 'flagship'].includes(normalized)) return 'Luxury';
  return null;
}

function normalizeMotorDrive(value: unknown): string | null {
  const text = cleanText(value).toUpperCase().replace(/\s+/g, '');
  if (!text) return null;
  if (['4X2', '4×2', '2WD'].includes(text)) return '4x2';
  if (['4X4', '4×4'].includes(text)) return '4x4';
  if (text === 'AWD') return 'AWD';
  if (text === 'FWD') return 'FWD';
  if (text === 'RWD') return 'RWD';
  return cleanText(value) || null;
}

function normalizeMotorTransmission(value: unknown): string | null {
  const normalized = normalizeMotorOption(value);
  if (!normalized) return null;
  if (['manual', 'mt'].includes(normalized)) return 'Manual';
  if (['automatic', 'auto', 'at', 'dsg', 'cvt', 'dct'].includes(normalized)) return 'Automatic';
  return cleanText(value) || null;
}

function getSpecText(specsJson: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = cleanText(specsJson[key]);
    if (value) return value;
  }
  return null;
}

function getSpecTextCandidates(specsJson: Record<string, unknown>, keys: string[]): string[] {
  const output: string[] = [];
  for (const key of keys) {
    const value = specsJson[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = cleanText(item);
        if (text) output.push(text);
      }
      continue;
    }
    const text = cleanText(value);
    if (text) output.push(text);
  }
  return output;
}

function getRequestedMotorTypeKeys(specsJson: Record<string, unknown>): Set<string> {
  const candidates = getSpecTextCandidates(specsJson, [
    'type_key',
    'selected_type_key',
    'default_type_key',
    'cab_type',
    'body_type',
    'vehicle_type',
    'vehicle_segment',
    'truck_type',
    'trailer_type',
    'bus_type',
    'motorcycle_type',
    'quadbike_type',
    'side_by_side_type',
    'aim4_source_body_type',
  ]);

  return new Set(candidates.map(normalizeMotorOption).filter(Boolean));
}

function getMotorReplacementMid(row: MotorPricingMatrixRow): number | null {
  return row.priceMidExVat ?? row.replacementPriceExVat ?? (
    row.priceLowExVat !== null && row.priceHighExVat !== null
      ? Math.round((row.priceLowExVat + row.priceHighExVat) / 2)
      : null
  );
}

function buildMotorPricingBand(row: MotorPricingMatrixRow, family: FamilyContext, brand: BrandContext): ReplacementPriceBand {
  const mid = getMotorReplacementMid(row);
  const minPrice = row.priceLowExVat ?? row.replacementPriceExVat ?? mid ?? 0;
  const maxPrice = row.priceHighExVat ?? row.replacementPriceExVat ?? mid ?? minPrice;
  const bandLabelParts = [row.typeLabel, row.driveType, row.transmission, row.specLevel]
    .map(cleanText)
    .filter((part) => part && part.toLowerCase() !== 'any/unknown');

  return {
    // Motor pricing rows are not rows in replacement_price_bands, so this must
    // never be saved as a replacement_price_band_id foreign key.
    id: 0,
    sectorId: family.sectorId,
    sectorKey: family.sectorKey,
    familyId: family.id!,
    familyKey: family.key,
    brandId: brand.id,
    brandSlug: brand.slug,
    brandName: brand.name,
    bandKey: `motor_pricing_matrix_${row.id}`,
    bandLabel: bandLabelParts.length ? bandLabelParts.join(' • ') : 'Motor pricing matrix',
    specMatchJson: {
      type_key: row.typeKey,
      drive_type: row.driveType,
      transmission: row.transmission,
      spec_level: row.specLevel,
    },
    replacementMinExVat: minPrice,
    replacementMaxExVat: maxPrice,
    replacementPriceYear: currentBaseYear(),
    confidence: row.confidenceScore ?? 0.62,
    sortOrder: 0,
    notes: row.sourceNotes,
  };
}

async function fetchEquipmentModelContext(input: {
  sectorKey: SectorKey;
  familyKey: EquipmentFamilyKey;
  brandSlug: string;
  equipmentModelId?: number | null;
  typedModelName?: string | null;
}): Promise<EquipmentModelContext | null> {
  const equipmentModelId = toInteger(input.equipmentModelId);
  const typedModelKey = normalizeModelKey(input.typedModelName);

  if (!equipmentModelId && !typedModelKey) return null;

  const db = getDb();
  const result = await db.query<DbRecord>(
    `
      select
        em.id,
        em.brand_id,
        em.aim4_model_key,
        em.model_name,
        em.display_name,
        em.normalized_model_name,
        em.specs_json
      from public.equipment_models em
      join public.equipment_families ef on ef.id = em.equipment_family_id
      join public.sectors s on s.id = ef.sector_id
      left join public.brands b on b.id = em.brand_id
      where s.sector_key = $1
        and ef.family_key = $2
        and b.slug = $3
        and coalesce(em.is_active, true) = true
        and coalesce(em.is_generic_fallback, false) = false
        and (
          ($4::integer is not null and em.id = $4::integer)
          or (
            $5::text <> ''
            and (
              public.aim4price_normalize_key(coalesce(em.normalized_model_name, '')) = $5
              or public.aim4price_normalize_key(coalesce(em.model_name, '')) = $5
              or public.aim4price_normalize_key(coalesce(em.display_name, '')) = $5
              or exists (
                select 1
                from public.equipment_model_aliases ema
                where ema.equipment_model_id = em.id
                  and coalesce(ema.is_active, true) = true
                  and (
                    public.aim4price_normalize_key(coalesce(ema.normalized_alias, '')) = $5
                    or public.aim4price_normalize_key(coalesce(ema.alias_text, '')) = $5
                  )
              )
            )
          )
        )
      order by case when em.id = $4::integer then 0 else 1 end, em.id asc
      limit 1
    `,
    [input.sectorKey, input.familyKey, input.brandSlug, equipmentModelId, typedModelKey],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    brandId: toInteger(row.brand_id),
    aim4ModelKey: cleanText(row.aim4_model_key) || null,
    modelName: cleanText(row.model_name),
    displayName: cleanText(row.display_name),
    normalizedModelName: cleanText(row.normalized_model_name),
    specsJson: asObject(row.specs_json),
  };
}

async function fetchMotorPricingRows(equipmentModelId: number): Promise<MotorPricingMatrixRow[]> {
  const db = getDb();
  const result = await db.query<DbRecord>(
    `
      select
        id,
        equipment_family_id,
        equipment_model_id,
        model_key,
        type_key,
        type_label,
        drive_type,
        transmission,
        spec_level,
        replacement_price_ex_vat,
        replacement_price_inc_vat,
        price_low_ex_vat,
        price_mid_ex_vat,
        price_high_ex_vat,
        price_low_inc_vat,
        price_mid_inc_vat,
        price_high_inc_vat,
        default_vat_display,
        source_price_basis,
        confidence_score,
        source_urls,
        source_notes
      from public.motor_model_pricing_matrix
      where equipment_model_id = $1
        and coalesce(is_active, true) = true
      order by
        case spec_level when 'Mid' then 0 when 'Entry' then 1 when 'Luxury' then 2 else 3 end,
        id asc
    `,
    [equipmentModelId],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    equipmentFamilyId: Number(row.equipment_family_id),
    equipmentModelId: Number(row.equipment_model_id),
    modelKey: cleanText(row.model_key),
    typeKey: cleanText(row.type_key),
    typeLabel: cleanText(row.type_label),
    driveType: cleanText(row.drive_type) || 'Any/Unknown',
    transmission: cleanText(row.transmission) || 'Any/Unknown',
    specLevel: (cleanText(row.spec_level) || 'Mid') as MotorPricingMatrixRow['specLevel'],
    replacementPriceExVat: toNumber(row.replacement_price_ex_vat),
    replacementPriceIncVat: toNumber(row.replacement_price_inc_vat),
    priceLowExVat: toNumber(row.price_low_ex_vat),
    priceMidExVat: toNumber(row.price_mid_ex_vat),
    priceHighExVat: toNumber(row.price_high_ex_vat),
    priceLowIncVat: toNumber(row.price_low_inc_vat),
    priceMidIncVat: toNumber(row.price_mid_inc_vat),
    priceHighIncVat: toNumber(row.price_high_inc_vat),
    defaultVatDisplay: cleanText(row.default_vat_display) === 'excl' ? 'excl' : 'incl',
    sourcePriceBasis: cleanText(row.source_price_basis) || null,
    confidenceScore: toNumber(row.confidence_score),
    sourceUrls: cleanText(row.source_urls) || null,
    sourceNotes: cleanText(row.source_notes) || null,
  }));
}

function chooseMotorPricingRow(rows: MotorPricingMatrixRow[], specsJson: Record<string, unknown>): MotorPricingMatrixRow | null {
  if (!rows.length) return null;

  const requestedTypeKeys = getRequestedMotorTypeKeys(specsJson);
  const requestedSpecLevel = normalizeMotorSpecLevel(
    getSpecText(specsJson, ['spec_level', 'specification_level', 'trim_level', 'model_grade']),
  ) ?? 'Mid';
  const requestedDrive = normalizeMotorDrive(getSpecText(specsJson, ['drive_type', 'drivetrain', 'drive']));
  const requestedTransmission = normalizeMotorTransmission(getSpecText(specsJson, ['transmission', 'gearbox']));

  function score(row: MotorPricingMatrixRow): number {
    let total = 0;
    const rowTypeKey = normalizeMotorOption(row.typeKey);
    const rowDrive = normalizeMotorDrive(row.driveType);
    const rowTransmission = normalizeMotorTransmission(row.transmission);
    const rowHasAnyDrive = row.driveType.toLowerCase() === 'any/unknown';
    const rowHasAnyTransmission = row.transmission.toLowerCase() === 'any/unknown';

    if (requestedTypeKeys.size) {
      total += requestedTypeKeys.has(rowTypeKey) ? 80 : -30;
    } else {
      total += rowTypeKey === normalizeMotorOption(cleanText(specsJson.default_type_key)) ? 20 : 0;
    }

    total += row.specLevel === requestedSpecLevel ? 45 : row.specLevel === 'Mid' ? 15 : 0;

    if (requestedDrive) {
      total += rowDrive === requestedDrive ? 18 : rowHasAnyDrive ? 8 : -5;
    } else {
      total += rowHasAnyDrive ? 8 : 0;
    }

    if (requestedTransmission) {
      total += rowTransmission === requestedTransmission ? 18 : rowHasAnyTransmission ? 8 : -5;
    } else {
      total += rowHasAnyTransmission ? 8 : 0;
    }

    const price = getMotorReplacementMid(row);
    if (price !== null && price > 0) total += 10;
    total += Math.round((row.confidenceScore ?? 0.5) * 10);
    return total;
  }

  return [...rows].sort((left, right) => score(right) - score(left) || right.id - left.id)[0] ?? null;
}

async function fetchMotorUsageProfile(input: {
  familyId: number;
  familyKey: EquipmentFamilyKey;
  typeKey?: string | null;
}): Promise<MotorUsageProfile | null> {
  const db = getDb();
  const normalizedTypeKey = cleanText(input.typeKey);
  const result = await db.query<DbRecord>(
    `
      select
        id,
        family_key,
        type_key,
        useful_life_km,
        high_usage_warning_km,
        extreme_usage_warning_km,
        hard_input_cap_km,
        residual_floor_pct,
        notes
      from public.motor_usage_profiles
      where equipment_family_id = $1
        and coalesce(is_active, true) = true
      order by
        case when type_key = $2 then 0 else 1 end,
        id asc
      limit 1
    `,
    [input.familyId, normalizedTypeKey],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    familyKey: cleanText(row.family_key),
    typeKey: cleanText(row.type_key),
    usefulLifeKm: toInteger(row.useful_life_km),
    highUsageWarningKm: toInteger(row.high_usage_warning_km),
    extremeUsageWarningKm: toInteger(row.extreme_usage_warning_km),
    hardInputCapKm: toInteger(row.hard_input_cap_km),
    residualFloorPct: toNumber(row.residual_floor_pct),
    notes: cleanText(row.notes) || null,
  };
}

export async function listReplacementPriceBands(input: {
  sectorKey?: SectorKey | null;
  familyKey: EquipmentFamilyKey;
  brandSlug?: string | null;
  includeInactive?: boolean;
}): Promise<ReplacementPriceBand[]> {
  const db = getDb();
  const values: string[] = [input.familyKey];
  const conditions = ['ef.family_key = $1'];

  if (input.sectorKey) {
    values.push(input.sectorKey);
    conditions.push(`s.sector_key = $${values.length}`);
  }

  if (input.brandSlug) {
    values.push(input.brandSlug);
    conditions.push(`(b.slug = $${values.length} or rpb.brand_id is null)`);
  }

  if (!input.includeInactive) {
    conditions.push('rpb.is_active = true');
    conditions.push('ef.is_active = true');
    conditions.push('s.is_active = true');
  }

  const result = await db.query<DbRecord>(
    `
      select
        rpb.id,
        s.id as sector_id,
        s.sector_key,
        ef.id as family_id,
        ef.family_key,
        b.id as brand_id,
        b.slug as brand_slug,
        b.name as brand_name,
        rpb.band_key,
        rpb.band_label,
        rpb.spec_match_json,
        rpb.replacement_min_ex_vat,
        rpb.replacement_max_ex_vat,
        rpb.replacement_price_year,
        rpb.confidence,
        rpb.sort_order,
        rpb.notes
      from public.replacement_price_bands rpb
      join public.equipment_families ef on ef.id = rpb.equipment_family_id
      join public.sectors s on s.id = ef.sector_id
      left join public.brands b on b.id = rpb.brand_id
      where ${conditions.join(' and ')}
      order by
        case when rpb.brand_id is null then 1 else 0 end,
        rpb.sort_order asc,
        rpb.confidence desc,
        rpb.band_label asc
    `,
    values,
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    sectorId: Number(row.sector_id),
    sectorKey: cleanText(row.sector_key) as SectorKey,
    familyId: Number(row.family_id),
    familyKey: cleanText(row.family_key),
    brandId: toInteger(row.brand_id),
    brandSlug: cleanText(row.brand_slug) || null,
    brandName: cleanText(row.brand_name) || null,
    bandKey: cleanText(row.band_key),
    bandLabel: cleanText(row.band_label),
    specMatchJson: asObject(row.spec_match_json),
    replacementMinExVat: Number(row.replacement_min_ex_vat),
    replacementMaxExVat: Number(row.replacement_max_ex_vat),
    replacementPriceYear: toInteger(row.replacement_price_year) ?? new Date().getFullYear(),
    confidence: toNumber(row.confidence) ?? 0.5,
    sortOrder: toInteger(row.sort_order) ?? 100,
    notes: cleanText(row.notes) || null,
  }));
}

async function findReplacementBand(input: {
  sectorKey: SectorKey;
  familyKey: EquipmentFamilyKey;
  brandSlug: string;
  specsJson: Record<string, unknown>;
}): Promise<ReplacementPriceBand | null> {
  const bands = await listReplacementPriceBands({
    sectorKey: input.sectorKey,
    familyKey: input.familyKey,
    brandSlug: input.brandSlug,
  });

  const matched = bands
    .filter((band) => bandMatchesSpecs(band, input.specsJson))
    .sort((left, right) => scoreBand(right) - scoreBand(left));

  return matched[0] ?? bands.find((band) => Object.keys(band.specMatchJson).length === 0) ?? null;
}

export async function saveModelCandidate(input: {
  sectorKey: SectorKey;
  familyKey: EquipmentFamilyKey;
  brandSlug?: string | null;
  brandNameSnapshot?: string | null;
  rawModelName: string;
  sourceType: 'user_input' | 'market_listing' | 'scraper' | 'admin_import';
  sourceUrl?: string | null;
  specsJson?: Record<string, unknown> | null;
  confidence?: number | null;
  notes?: string | null;
}): Promise<void> {
  const rawModelName = cleanText(input.rawModelName);
  if (!rawModelName) return;

  const normalized = normalizeModelKey(rawModelName);
  if (!normalized) return;

  const db = getDb();
  const params = [
    input.sectorKey,
    input.familyKey,
    input.brandSlug ?? '',
    input.brandNameSnapshot ?? '',
    rawModelName,
    normalized,
    input.sourceType,
    input.sourceUrl ?? '',
    JSON.stringify(normalizeSpecsJson(input.specsJson)),
    Math.max(0.1, Math.min(0.99, Number(input.confidence ?? 0.55))),
    input.notes ?? '',
  ];

  try {
    const existingModel = await db.query(
      `
        select 1
        from public.equipment_models em
        join public.equipment_families ef
          on ef.id = em.equipment_family_id
        join public.sectors s
          on s.id = ef.sector_id
        left join public.brands b
          on b.id = em.brand_id
        where s.sector_key = $1
          and ef.family_key = $2
          and ($3::text = '' or b.slug = $3)
          and coalesce(em.is_generic_fallback, false) = false
          and (
            public.aim4price_normalize_key(coalesce(em.normalized_model_name, '')) = $6
            or public.aim4price_normalize_key(coalesce(em.model_name, '')) = $6
            or public.aim4price_normalize_key(coalesce(em.display_name, '')) = $6
            or exists (
              select 1
              from public.equipment_model_aliases ema
              where ema.equipment_model_id = em.id
                and (
                  public.aim4price_normalize_key(coalesce(ema.normalized_alias, '')) = $6
                  or public.aim4price_normalize_key(coalesce(ema.alias_text, '')) = $6
                )
            )
          )
        limit 1
      `,
      params.slice(0, 6),
    );

    if ((existingModel.rowCount ?? 0) > 0) return;

    const updated = await db.query(
      `
        with target as (
          select
            s.id as sector_id,
            ef.id as equipment_family_id,
            b.id as brand_id
          from public.sectors s
          join public.equipment_families ef on ef.sector_id = s.id and ef.family_key = $2
          left join public.brands b on b.slug = nullif($3, '')
          where s.sector_key = $1
          limit 1
        )
        update public.model_candidates mc
        set
          occurrence_count = coalesce(mc.occurrence_count, 0) + 1,
          raw_model_name = $5,
          brand_name_snapshot = coalesce(nullif($4, ''), mc.brand_name_snapshot),
          specs_json = case
            when $9::jsonb = '{}'::jsonb then coalesce(mc.specs_json, '{}'::jsonb)
            else coalesce(mc.specs_json, '{}'::jsonb) || $9::jsonb
          end,
          confidence = greatest(coalesce(mc.confidence, 0), $10),
          source_url = coalesce(nullif($8, ''), mc.source_url),
          notes = coalesce(nullif($11, ''), mc.notes),
          last_seen_at = now(),
          updated_at = now()
        from target
        where mc.equipment_family_id = target.equipment_family_id
          and mc.brand_id is not distinct from target.brand_id
          and mc.normalized_model_name = $6
        returning mc.id
      `,
      params,
    );

    if ((updated.rowCount ?? 0) > 0) return;

    await db.query(
      `
        insert into public.model_candidates (
          sector_id,
          equipment_family_id,
          brand_id,
          brand_name_snapshot,
          raw_model_name,
          normalized_model_name,
          source_type,
          source_url,
          specs_json,
          occurrence_count,
          confidence,
          candidate_status,
          notes,
          first_seen_at,
          last_seen_at,
          created_at,
          updated_at
        )
        select
          target.sector_id,
          target.equipment_family_id,
          target.brand_id,
          nullif($4, ''),
          $5,
          $6,
          $7,
          nullif($8, ''),
          $9::jsonb,
          1,
          $10,
          'pending',
          nullif($11, ''),
          now(),
          now(),
          now(),
          now()
        from (
          select
            s.id as sector_id,
            ef.id as equipment_family_id,
            b.id as brand_id
          from public.sectors s
          join public.equipment_families ef on ef.sector_id = s.id and ef.family_key = $2
          left join public.brands b on b.slug = nullif($3, '')
          where s.sector_key = $1
          limit 1
        ) target
        where not exists (
          select 1
          from public.model_candidates mc
          where mc.equipment_family_id = target.equipment_family_id
            and mc.brand_id is not distinct from target.brand_id
            and mc.normalized_model_name = $6
        )
        on conflict do nothing
      `,
      params,
    );
  } catch (error) {
    console.warn('[Aim4price] Model candidate save skipped so valuation can continue.', error);
  }
}

async function collectTypedModelKeys(input: {
  sectorKey: SectorKey;
  familyKey: EquipmentFamilyKey;
  brandSlug?: string | null;
  typedModelKey: string;
}): Promise<{ keys: string[]; hasApprovedAlias: boolean }> {
  if (!input.typedModelKey) return { keys: [], hasApprovedAlias: false };

  const db = getDb();
  const result = await db.query<DbRecord>(
    `
      select distinct public.aim4price_normalize_key(value) as normalized_key
      from (
        select em.normalized_model_name as value
        from public.equipment_models em
        join public.equipment_families ef on ef.id = em.equipment_family_id
        join public.sectors s on s.id = ef.sector_id
        left join public.brands b on b.id = em.brand_id
        where s.sector_key = $1
          and ef.family_key = $2
          and ($3::text is null or b.slug = $3)
          and public.aim4price_normalize_key(em.normalized_model_name) = $4

        union all

        select em.normalized_model_name as value
        from public.equipment_model_aliases ema
        join public.equipment_models em on em.id = ema.equipment_model_id
        join public.equipment_families ef on ef.id = em.equipment_family_id
        join public.sectors s on s.id = ef.sector_id
        left join public.brands b on b.id = em.brand_id
        where s.sector_key = $1
          and ef.family_key = $2
          and ($3::text is null or b.slug = $3)
          and public.aim4price_normalize_key(ema.normalized_alias) = $4

        union all

        select ema.normalized_alias as value
        from public.equipment_model_aliases ema
        join public.equipment_models em on em.id = ema.equipment_model_id
        join public.equipment_families ef on ef.id = em.equipment_family_id
        join public.sectors s on s.id = ef.sector_id
        left join public.brands b on b.id = em.brand_id
        where s.sector_key = $1
          and ef.family_key = $2
          and ($3::text is null or b.slug = $3)
          and em.id in (
            select em2.id
            from public.equipment_model_aliases ema2
            join public.equipment_models em2 on em2.id = ema2.equipment_model_id
            where public.aim4price_normalize_key(ema2.normalized_alias) = $4
               or public.aim4price_normalize_key(em2.normalized_model_name) = $4
          )
      ) aliases
      where value is not null and btrim(value) <> ''
    `,
    [input.sectorKey, input.familyKey, input.brandSlug || null, input.typedModelKey],
  );

  const keys = new Set<string>([input.typedModelKey]);
  for (const row of result.rows) {
    const key = normalizeModelKey(row.normalized_key);
    if (key) keys.add(key);
  }

  return { keys: [...keys], hasApprovedAlias: result.rows.length > 0 };
}

export async function runGenericValuation(input: GenericValuationInput): Promise<GenericValuationResult> {
  const rawSpecsJson = normalizeSpecsJson(input.specsJson);
  const lifeWorkedPercent = positivePercent(input.lifeWorkedPercent);
  const inputYear = Math.round(input.year);
  let specsJson: Record<string, unknown> = {
    ...rawSpecsJson,
    yearModelUnknown: Boolean(input.yearModelUnknown),
    year_model_unknown: Boolean(input.yearModelUnknown),
    ...(input.yearModelUnknown
      ? {}
      : {
          yearModel: inputYear,
          year_model: inputYear,
          displayYearModel: inputYear,
          display_year_model: inputYear,
          assetYearModel: inputYear,
          asset_year_model: inputYear,
          currentYearModel: inputYear,
          current_year_model: inputYear,
        }),
    ...(lifeWorkedPercent !== null
      ? {
          lifeWorkedPercent,
          life_worked_percent: lifeWorkedPercent,
          workedPercent: lifeWorkedPercent,
          worked_percent: lifeWorkedPercent,
          percentWorked: lifeWorkedPercent,
          percent_worked: lifeWorkedPercent,
          lifetimeWorkedPercent: lifeWorkedPercent,
          lifetime_worked_percent: lifeWorkedPercent,
          lifetimeUsedPercent: lifeWorkedPercent,
          lifetime_used_percent: lifeWorkedPercent,
        }
      : {}),
  };

  const basicRelease = rawSpecsJson.basic_catalogue_release;
  const basicRecord = basicRelease == null ? null
    : await getBasicCatalogueFamily(input.sectorKey, input.familyKey, basicRelease);
  const basicCatalogue = basicRecord?.basicCatalogue;
  const basicGuide = basicCatalogue
    ? resolveCatalogueGuide(basicCatalogue, rawSpecsJson.basic_specification_level as BasicSpecificationLevel)
    : null;
  if (basicCatalogue) {
    if (input.lifeWorkedPercent == null || !Number.isFinite(input.lifeWorkedPercent) || lifeWorkedPercent === null || Number(input.lifeWorkedPercent) > 100) throw new Error('Enter the percentage of useful life worked.');
    if (!Number.isFinite(input.userReplacementPriceExVat) || Number(input.userReplacementPriceExVat) <= 0) {
      throw new Error('Confirm a positive replacement price.');
    }
    // Do not accept model links or a caller-supplied catalogue snapshot as evidence.
    for (const key of ['catalog_model_id', 'equipment_model_id', 'equipmentModelId', 'aim4_model_key', 'selected_model_key']) delete specsJson[key];
    specsJson = { ...specsJson, basic_catalogue_release: basicCatalogue.releaseKey,
      basic_catalogue: basicCatalogue, basic_family_label: basicCatalogue.familyLabel,
      basic_calculation_profile: 'user_life_worked_v1',
      valuation_mode: 'percent_used', valuationMode: 'percent_used' };
  }
  const family: FamilyContext | null = basicRecord ? {
    id: null, key: basicRecord.familyKey, label: basicRecord.familyLabel,
    sectorId: basicRecord.sectorId, sectorKey: basicRecord.sectorKey, sectorLabel: basicRecord.sectorLabel,
    usageMetricType: basicRecord.usageMetricType, valuationMode: basicRecord.valuationMode,
    isPropelled: basicRecord.isPropelled, catalogMode: basicRecord.catalogMode,
  } : await fetchFamilyContext(input.sectorKey, input.familyKey);
  if (!family) throw new Error('FAMILY_NOT_FOUND');

  const advancedAssumptions = normalizeAdvancedAssumptions(input.advancedAssumptions, family.usageMetricType);

  const brand = basicRecord ? await fetchBasicBrandContext(input.brandSlug)
    : await fetchBrandContext(family.id!, input.brandSlug);
  if (!brand) throw new Error('BRAND_NOT_FOUND_FOR_FAMILY');

  let typedModelName = cleanText(input.typedModelName) || null;
  const userReplacementPriceExVatRaw = toNumber(input.userReplacementPriceExVat);
  const userReplacementPriceExVat = userReplacementPriceExVatRaw && userReplacementPriceExVatRaw > 0 ? userReplacementPriceExVatRaw : null;
  const userReplacementPriceYear = toInteger(input.userReplacementPriceYear) ?? null;

  const selectedEquipmentModel = basicRecord ? null : await fetchEquipmentModelContext({
    sectorKey: input.sectorKey,
    familyKey: input.familyKey,
    brandSlug: input.brandSlug,
    equipmentModelId: input.equipmentModelId ?? toInteger(specsJson.catalog_model_id),
    typedModelName,
  });

  if (selectedEquipmentModel) {
    typedModelName = selectedEquipmentModel.displayName || selectedEquipmentModel.modelName || typedModelName;
    specsJson = {
      ...selectedEquipmentModel.specsJson,
      ...specsJson,
      catalog_model_id: selectedEquipmentModel.id,
      aim4_model_key: selectedEquipmentModel.aim4ModelKey,
      selected_model_key: selectedEquipmentModel.aim4ModelKey,
    };
  }

  let motorPricingRow: MotorPricingMatrixRow | null = null;
  let motorUsageProfile: MotorUsageProfile | null = null;

  if (input.sectorKey === 'motor' && selectedEquipmentModel) {
    const pricingRows = await fetchMotorPricingRows(selectedEquipmentModel.id);
    motorPricingRow = chooseMotorPricingRow(pricingRows, specsJson);

    if (motorPricingRow) {
      motorUsageProfile = await fetchMotorUsageProfile({
        familyId: family.id!,
        familyKey: family.key,
        typeKey: motorPricingRow.typeKey,
      });

      specsJson = {
        ...specsJson,
        type_key: motorPricingRow.typeKey,
        type_label: motorPricingRow.typeLabel,
        drive_type: motorPricingRow.driveType,
        transmission: motorPricingRow.transmission,
        spec_level: motorPricingRow.specLevel,
        default_vat_display: motorPricingRow.defaultVatDisplay,
        motor_pricing_matrix_id: motorPricingRow.id,
        motor_pricing_confidence: motorPricingRow.confidenceScore,
        ...(motorUsageProfile?.usefulLifeKm ? { useful_life_km: motorUsageProfile.usefulLifeKm, max_lifetime_km: motorUsageProfile.usefulLifeKm } : {}),
        ...(motorUsageProfile?.residualFloorPct !== null && typeof motorUsageProfile?.residualFloorPct !== 'undefined'
          ? { residual_floor_pct: motorUsageProfile.residualFloorPct }
          : {}),
      };
    }
  }

  const replacementBand = basicRecord ? null : motorPricingRow
    ? buildMotorPricingBand(motorPricingRow, family, brand)
    : await findReplacementBand({
        sectorKey: input.sectorKey,
        familyKey: input.familyKey,
        brandSlug: input.brandSlug,
        specsJson,
      });

  const replacementPriceMinExVat = basicCatalogue?.minimumExVat ?? replacementBand?.replacementMinExVat ?? null;
  const replacementPriceMaxExVat = basicCatalogue?.maximumExVat ?? replacementBand?.replacementMaxExVat ?? null;
  const matrixMid = motorPricingRow ? getMotorReplacementMid(motorPricingRow) : null;
  const bandMid = basicGuide?.suggestedExVat ?? matrixMid ?? (
    replacementPriceMinExVat !== null && replacementPriceMaxExVat !== null
      ? Math.round((replacementPriceMinExVat + replacementPriceMaxExVat) / 2)
      : null
  );
  const normalizedTypedModelName = typedModelName ? normalizeModelKey(typedModelName) : null;

  const marketAverageExVat: number | null = null;
  const marketAverageCount = 0;
  const marketMatchStrategy: GenericValuationResult['marketMatchStrategy'] = selectedEquipmentModel ? 'exact_model' : 'none';
  const marketSources: MarketMatch[] = [];

  const commonCalculationInput = {
    sectorKey: family.sectorKey,
    year: inputYear,
    yearModelUnknown: input.yearModelUnknown,
    usageAmount: toNumber(input.usageAmount),
    lifeWorkedPercent,
    usageMetricType: family.usageMetricType,
    valuationMode: family.valuationMode,
    condition: normalizeCondition(input.condition),
    isPropelled: family.isPropelled,
    familyKey: family.key,
    specsJson,
    advancedAssumptions,
  };

  const aim4priceReplacementCalculation = buildCalculation({
    ...commonCalculationInput,
    replacementPriceBasis: 'aim4price',
    replacementPrice: bandMid,
  });
  const userReplacementCalculation = userReplacementPriceExVat
    ? buildCalculation({
        ...commonCalculationInput,
        replacementPriceBasis: 'user',
        replacementPrice: userReplacementPriceExVat,
      })
    : null;

  const selectedCalculation = userReplacementCalculation ?? aim4priceReplacementCalculation;
  const replacementPriceBasis = selectedCalculation.replacementPriceBasis;
  const replacementPriceUsedExVat = selectedCalculation.replacementPriceExVat;
  const genericEstimateExVat = selectedCalculation.depreciationBaseValueExVat;
  const aim4priceValueExVat = selectedCalculation.aim4priceValueExVat;
  const valuationLowExVat = selectedCalculation.valuationLowExVat;
  const valuationMidExVat = selectedCalculation.valuationMidExVat;
  const valuationHighExVat = selectedCalculation.valuationHighExVat;
  const usageAmountUsed = toNumber(input.usageAmount);
  const selectedLifeWorkedPercent = selectedCalculation.lifeWorkedPercent;
  const usesPercentageBasis =
    selectedCalculation.depreciationMethodUsed === 'percentage_depreciation' ||
    (usageAmountUsed === null && selectedLifeWorkedPercent !== null);
  const persistedUsageMode = family.valuationMode === 'year_condition'
    ? 'none'
    : usesPercentageBasis
      ? 'percent'
      : family.usageMetricType === 'km'
        ? 'km'
        : 'hours';

  specsJson = {
    ...specsJson,
    yearModelUnknown: Boolean(input.yearModelUnknown),
    year_model_unknown: Boolean(input.yearModelUnknown),
    ...(input.yearModelUnknown
      ? {
          yearModel: undefined,
          year_model: undefined,
          displayYearModel: undefined,
          display_year_model: undefined,
          assetYearModel: undefined,
          asset_year_model: undefined,
          currentYearModel: undefined,
          current_year_model: undefined,
        }
      : {
          yearModel: inputYear,
          year_model: inputYear,
          displayYearModel: inputYear,
          display_year_model: inputYear,
          assetYearModel: inputYear,
          asset_year_model: inputYear,
          currentYearModel: inputYear,
          current_year_model: inputYear,
        }),
    usageMode: persistedUsageMode,
    usage_mode: persistedUsageMode,
    usageBasis: family.valuationMode === 'year_condition' ? 'none' : usesPercentageBasis ? 'percent' : 'reading',
    usage_basis: family.valuationMode === 'year_condition' ? 'none' : usesPercentageBasis ? 'percent' : 'reading',
    depreciationMethodUsed: selectedCalculation.depreciationMethodUsed,
    depreciation_method_used: selectedCalculation.depreciationMethodUsed,
    ...(selectedLifeWorkedPercent !== null
      ? {
          lifeWorkedPercent: selectedLifeWorkedPercent,
          life_worked_percent: selectedLifeWorkedPercent,
          workedPercent: selectedLifeWorkedPercent,
          worked_percent: selectedLifeWorkedPercent,
          percentWorked: selectedLifeWorkedPercent,
          percent_worked: selectedLifeWorkedPercent,
          lifetimeWorkedPercent: selectedLifeWorkedPercent,
          lifetime_worked_percent: selectedLifeWorkedPercent,
          lifetimeUsedPercent: selectedLifeWorkedPercent,
          lifetime_used_percent: selectedLifeWorkedPercent,
        }
      : {}),
  };

  if (input.yearModelUnknown) {
    delete specsJson.yearModel;
    delete specsJson.year_model;
    delete specsJson.displayYearModel;
    delete specsJson.display_year_model;
    delete specsJson.assetYearModel;
    delete specsJson.asset_year_model;
    delete specsJson.currentYearModel;
    delete specsJson.current_year_model;
  }

  const confidenceScore = aim4priceValueExVat !== null
    ? clamp(basicCatalogue ? (basicCatalogue.confidence === 'medium' ? 0.6 : 0.4) : motorPricingRow?.confidenceScore ?? replacementBand?.confidence ?? 0.58, 0.18, 0.95)
    : 0.28;
  const calculatedConfidenceLabel = confidenceLabel(confidenceScore);

  const notes: string[] = [];
  if (basicCatalogue) notes.push('Rounded Basic ballpark pricing; useful life worked was supplied by the user.');
  if (!replacementBand && !userReplacementPriceExVat) notes.push('No replacement price matched yet. Add pricing data or enter a user replacement price.');
  if (motorPricingRow) {
    notes.push(`Motor pricing matrix matched: ${motorPricingRow.typeLabel}, ${motorPricingRow.specLevel} specification.`);
    if (motorUsageProfile?.usefulLifeKm) {
      notes.push(`Motor usage profile used ${motorUsageProfile.usefulLifeKm.toLocaleString('en-ZA')} lifetime kilometres.`);
    }
  }
  notes.push(
    family.valuationMode === 'year_condition'
      ? 'Aim4price used replacement price, age, condition and family assumptions; no usage reading was applied.'
      : 'Aim4price used replacement price, usage, age, condition and specs.',
  );
  if (advancedAssumptions && (advancedAssumptions.maxLifetimeUsage !== null || advancedAssumptions.conditionFactorPercent !== null)) {
    notes.push('Advanced assumptions were applied to this valuation run.');
  }
  if (advancedAssumptions?.dealerAssessment) notes.push('Detailed Asset Assessment applied to the condition adjustment.');
  if (advancedAssumptions?.popularityStars) notes.push(`Popularity rating applied: ${advancedAssumptions.popularityStars} of 5 stars.`);
  if (selectedCalculation.marketabilityReductionPercent > 0) {
    notes.push(`Older passenger-car marketability adjustment applied: ${selectedCalculation.marketabilityReductionPercent}% after 15 years.`);
  }
  if (selectedCalculation.isSalvageEstimate && selectedCalculation.salvagePercent !== null) {
    notes.push(`Depreciation reached the indicative salvage range of ${selectedCalculation.salvagePercent}% of replacement price.`);
  }

  const usageSentenceLabel = getUsageSentenceLabel(family.sectorKey, family.usageMetricType);

  if (family.valuationMode === 'year_condition') {
    notes.push('Year and condition depreciation used. This family does not require a usage or percentage-worked input.');
  } else if (selectedCalculation.depreciationMethodUsed === 'full_depreciation') {
    notes.push(`Full depreciation used: year, ${usageSentenceLabel} and condition.`);
  } else if (selectedCalculation.depreciationMethodUsed === 'semi_depreciation') {
    notes.push(
      `Semi depreciation used: ${usageSentenceLabel} were estimated from ${selectedCalculation.lifeWorkedPercent ?? 0}% worked of ${selectedCalculation.maxLifetimeHours ?? 0} lifetime ${usageSentenceLabel}.`,
    );
  } else {
    if (selectedCalculation.ageDepPct !== null) {
      notes.push('Age-aware percentage depreciation used: year model, worked percentage and condition were applied.');
    } else {
      notes.push('Percentage depreciation used: valuation is based on how much the equipment has worked, then adjusted for condition.');
    }
  }

  if (input.yearModelUnknown) {
    notes.push('Year model was marked unknown, so year was not used as the main depreciation driver.');
  }

  if (userReplacementCalculation && userReplacementPriceExVat) {
    if (bandMid && bandMid > 0) {
      const differencePct = Math.round(((userReplacementPriceExVat - bandMid) / bandMid) * 100);
      notes.push(
        `User replacement price was used. It is ${Math.abs(differencePct)}% ${differencePct >= 0 ? 'higher' : 'lower'} than the Aim4price replacement estimate.`,
      );
    } else {
      notes.push('User replacement price was used because no Aim4price replacement estimate was available.');
    }
  }

  if (!basicRecord && typedModelName && input.saveModelCandidate && !selectedEquipmentModel) {
    await saveModelCandidate({
      sectorKey: input.sectorKey,
      familyKey: input.familyKey,
      brandSlug: input.brandSlug,
      brandNameSnapshot: brand.name,
      rawModelName: typedModelName,
      sourceType: 'user_input',
      specsJson,
      confidence: 0.55,
    });
  }

  return {
    catalogModeUsed: family.catalogMode === 'hybrid' ? 'generic_specs' : family.catalogMode,
    sector: { id: family.sectorId, key: family.sectorKey, label: family.sectorLabel },
    family,
    brand,
    typedModelName,
    normalizedTypedModelName,
    specsJson,
    year: inputYear,
    yearModelUnknown: input.yearModelUnknown,
    usageAmount: toNumber(input.usageAmount),
    condition: normalizeCondition(input.condition),
    replacementPriceBand: replacementBand,
    replacementPriceMinExVat,
    replacementPriceMaxExVat,
    replacementPriceUsedExVat,
    userReplacementPriceExVat,
    userReplacementPriceYear,
    replacementPriceBasis,
    depreciationMethodUsed: selectedCalculation.depreciationMethodUsed,
    lifeWorkedPercent: selectedCalculation.lifeWorkedPercent,
    lifeRemainingPercent: selectedCalculation.lifeRemainingPercent,
    estimatedHours: selectedCalculation.estimatedHours,
    maxLifetimeHours: selectedCalculation.maxLifetimeHours,
    advancedAssumptions,
    aim4priceReplacementCalculation,
    userReplacementCalculation,
    selectedCalculation,
    genericEstimateExVat,
    aim4priceValueExVat,
    marketAverageExVat,
    marketAverageCount,
    marketMatchStrategy,
    marketSources,
    valuationLowExVat,
    valuationMidExVat,
    valuationHighExVat,
    confidenceScore,
    confidenceLabel: calculatedConfidenceLabel,
    notes,
  };
}

export function getGenericSelectedMethodValue(result: GenericValuationResult, _method: GenericSelectedMethod): number | null {
  return result.valuationMidExVat ?? result.aim4priceValueExVat;
}

