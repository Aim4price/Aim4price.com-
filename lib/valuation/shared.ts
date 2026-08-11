import type { ConditionKey, TractorType } from '../tractor-data';
import {
  applyPopularityToConditionFactor,
  dealerAssessmentWasRequested,
  getDealerConditionFactor,
  normalizeDealerAssessment,
  normalizePopularityStars,
  type DealerAssessmentInput,
  type NormalizedDealerAssessment,
  type PopularityStars,
} from './dealer-assessment';
import { resolveSalvageValue } from './valuation-rules';

export const CONDITION_FACTORS: Record<ConditionKey, number> = {
  excellent: 0.95,
  good: 0.85,
  fair: 0.75,
  used: 0.65,
  serious: 0.55,
};

export const DEFAULT_ENGINE_FLOOR_PERCENT = 0.05;
export const DEFAULT_NON_PROPELLED_FLOOR_PERCENT = 0.10;
export const DEFAULT_FALLBACK_LIFETIME_USED_PERCENT = 0.65;

export const ADVANCED_CONDITION_FACTOR_MIN_PERCENT = 30;
export const ADVANCED_CONDITION_FACTOR_MAX_PERCENT = 110;
export const ADVANCED_LIFETIME_HOURS_MIN = 500;
export const ADVANCED_LIFETIME_HOURS_MAX = 50_000;
export const ADVANCED_LIFETIME_KM_MIN = 50_000;
export const ADVANCED_LIFETIME_KM_MAX = 2_000_000;

export type AdvancedAssumptionsInput = {
  maxLifetimeUsage?: number | string | null;
  maxLifetimeHours?: number | string | null;
  conditionFactorPercent?: number | string | null;
  dealerAssessment?: DealerAssessmentInput;
  popularityStars?: number | string | null;
} | null | undefined;

export type NormalizedAdvancedAssumptions = {
  maxLifetimeUsage: number | null;
  conditionFactorPercent: number | null;
  dealerAssessment: NormalizedDealerAssessment | null;
  popularityStars: PopularityStars | null;
};

export type EngineHoursMethodInput = {
  replacementPriceExVat: number;
  yearModel: number;
  hours?: number | null;
  condition: ConditionKey;
  maxLifetimeHours: number;
  fallbackLifetimeUsedPercent?: number;
  floorPercent?: number;
  baseYear?: number;
  conditionFactorOverride?: number | null;
  marketabilityFactor?: number | null;
};

export type EngineHoursMethodResult = {
  hoursUsed: number;
  ageDepPct: number;
  usageDepPct: number;
  averageDepPct: number;
  depreciatedValueExVat: number;
  conditionAdjustedValueExVat: number;
  marketabilityAdjustedValueExVat: number;
  salvagePercent: number;
  salvageValueExVat: number;
  isSalvageEstimate: boolean;
  finalValueExVat: number;
};

export type YearConditionMethodInput = {
  replacementPriceExVat: number;
  yearModel: number;
  condition: ConditionKey;
  floorPercent?: number;
  baseYear?: number;
  conditionFactorOverride?: number | null;
  marketabilityFactor?: number | null;
};

export type YearConditionMethodResult = {
  ageDepPct: number;
  depreciatedValueExVat: number;
  conditionAdjustedValueExVat: number;
  marketabilityAdjustedValueExVat: number;
  salvagePercent: number;
  salvageValueExVat: number;
  isSalvageEstimate: boolean;
  finalValueExVat: number;
};

export type PercentUsedMethodInput = {
  replacementPriceExVat: number;
  percentUsed: number;
  condition: ConditionKey;
  floorPercent?: number;
  conditionFactorOverride?: number | null;
  marketabilityFactor?: number | null;
};

export type PercentUsedMethodResult = {
  percentUsed: number;
  remainingPercent: number;
  baseValueExVat: number;
  conditionAdjustedValueExVat: number;
  marketabilityAdjustedValueExVat: number;
  salvagePercent: number;
  salvageValueExVat: number;
  isSalvageEstimate: boolean;
  finalValueExVat: number;
};

export function roundMoney(value: number): number {
  return Math.round(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function currentBaseYear(): number {
  return new Date().getFullYear();
}


function asAdvancedObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function hasAdvancedValue(value: unknown): boolean {
  if (typeof value === 'undefined' || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

function parseAdvancedNumber(value: unknown): number | null {
  if (!hasAdvancedValue(value)) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/%/g, '');
    if (!trimmed) return null;
    const withoutSpaces = trimmed.replace(/\s+/g, '');
    const normalized = withoutSpaces.includes(',') && !withoutSpaces.includes('.')
      ? withoutSpaces.replace(/,/g, '')
      : withoutSpaces.replace(/,/g, '');
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function pickAdvancedValue(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
  }
  return undefined;
}

export function advancedAssumptionsWereRequested(value: unknown): boolean {
  const source = asAdvancedObject(value);
  if (!source) return false;
  return hasAdvancedValue(pickAdvancedValue(source, ['maxLifetimeUsage', 'maxLifetimeHours']))
    || hasAdvancedValue(pickAdvancedValue(source, ['conditionFactorPercent']))
    || dealerAssessmentWasRequested(pickAdvancedValue(source, ['dealerAssessment']))
    || hasAdvancedValue(pickAdvancedValue(source, ['popularityStars']));
}

export function advancedAssumptionsRequireActiveAccess(value: unknown): boolean {
  const source = asAdvancedObject(value);
  if (!source) return false;
  return hasAdvancedValue(pickAdvancedValue(source, ['maxLifetimeUsage', 'maxLifetimeHours']))
    || hasAdvancedValue(pickAdvancedValue(source, ['conditionFactorPercent']));
}

export function normalizeAdvancedAssumptions(
  value: AdvancedAssumptionsInput,
  usageMetricType: 'km' | 'hours' | 'wear_class' | string | null | undefined,
): NormalizedAdvancedAssumptions | null {
  const source = asAdvancedObject(value);
  if (!source || !advancedAssumptionsWereRequested(source)) return null;

  const lifetimeRaw = pickAdvancedValue(source, ['maxLifetimeUsage', 'maxLifetimeHours']);
  const conditionRaw = pickAdvancedValue(source, ['conditionFactorPercent']);
  const dealerAssessmentRaw = pickAdvancedValue(source, ['dealerAssessment']);
  const popularityRaw = pickAdvancedValue(source, ['popularityStars']);
  const lifetimeProvided = hasAdvancedValue(lifetimeRaw);
  const conditionProvided = hasAdvancedValue(conditionRaw);

  const normalized: NormalizedAdvancedAssumptions = {
    maxLifetimeUsage: null,
    conditionFactorPercent: null,
    dealerAssessment: null,
    popularityStars: null,
  };

  if (lifetimeProvided) {
    const lifetime = parseAdvancedNumber(lifetimeRaw);
    if (lifetime === null) {
      throw new Error('Expected lifetime usage must be a valid number.');
    }

    const unitLabel = usageMetricType === 'km' ? 'kilometres' : 'hours';
    if (lifetime <= 0) {
      throw new Error(`Expected lifetime ${unitLabel} must be greater than 0.`);
    }

    normalized.maxLifetimeUsage = Math.round(lifetime);
  }

  if (conditionProvided) {
    const conditionPercent = parseAdvancedNumber(conditionRaw);
    if (conditionPercent === null) {
      throw new Error('Condition retained value % must be a valid number.');
    }
    if (conditionPercent < ADVANCED_CONDITION_FACTOR_MIN_PERCENT || conditionPercent > ADVANCED_CONDITION_FACTOR_MAX_PERCENT) {
      throw new Error(`Condition retained value % must be between ${ADVANCED_CONDITION_FACTOR_MIN_PERCENT}% and ${ADVANCED_CONDITION_FACTOR_MAX_PERCENT}%.`);
    }

    normalized.conditionFactorPercent = Math.round(conditionPercent * 10) / 10;
  }

  normalized.dealerAssessment = normalizeDealerAssessment(dealerAssessmentRaw as DealerAssessmentInput);
  normalized.popularityStars = normalizePopularityStars(popularityRaw);

  return normalized.maxLifetimeUsage !== null
      || normalized.conditionFactorPercent !== null
      || normalized.dealerAssessment !== null
      || normalized.popularityStars !== null
    ? normalized
    : null;
}

export function getAdvancedConditionFactorOverride(advancedAssumptions?: NormalizedAdvancedAssumptions | null): number | null {
  if (!advancedAssumptions) return null;
  const dealerFactor = getDealerConditionFactor(advancedAssumptions.dealerAssessment);
  if (dealerFactor !== null) return dealerFactor;
  if (advancedAssumptions.conditionFactorPercent === null) return null;
  return advancedAssumptions.conditionFactorPercent / 100;
}

export function getValuationConditionFactorOverride(
  condition: ConditionKey,
  advancedAssumptions?: NormalizedAdvancedAssumptions | null,
): number {
  const detailedFactor = getDealerConditionFactor(advancedAssumptions?.dealerAssessment);
  if (detailedFactor !== null) {
    return applyPopularityToConditionFactor(detailedFactor, advancedAssumptions?.popularityStars);
  }

  const customConditionPercent = advancedAssumptions?.conditionFactorPercent;
  if (typeof customConditionPercent === 'number') {
    return applyPopularityToConditionFactor(
      customConditionPercent / 100,
      advancedAssumptions?.popularityStars,
      { min: ADVANCED_CONDITION_FACTOR_MIN_PERCENT / 100, max: ADVANCED_CONDITION_FACTOR_MAX_PERCENT / 100 },
    );
  }

  return applyPopularityToConditionFactor(CONDITION_FACTORS[condition], advancedAssumptions?.popularityStars);
}

export function applyCondition(value: number, condition: ConditionKey, conditionFactorOverride?: number | null): number {
  const override = Number(conditionFactorOverride);
  const factor = Number.isFinite(override) && override > 0 ? override : CONDITION_FACTORS[condition];
  return value * factor;
}

export function applyFloor(value: number, replacementBase: number, floorPercent: number): number {
  return Math.max(value, replacementBase * floorPercent);
}

export function tractorLifetimeHours(type: TractorType, powerKw: number): number {
  if (type === 'orchard') return 10_000;
  if (powerKw <= 25) return 8_000;
  if (powerKw <= 75) return 12_000;
  return 14_000;
}

export function fallbackEngineHours(
  maxLifetimeHours: number,
  fallbackLifetimeUsedPercent = DEFAULT_FALLBACK_LIFETIME_USED_PERCENT,
): number {
  return Math.round(maxLifetimeHours * clamp(fallbackLifetimeUsedPercent, 0, 1));
}

export function tractorAgeDepPct(yearModel: number, baseYear = currentBaseYear()): number {
  const safeYear = Number.isFinite(yearModel) ? Math.round(yearModel) : baseYear;
  const age = Math.max(0, baseYear - safeYear);

  let depreciation = 0;
  if (age >= 1) depreciation += 20;
  if (age >= 2) depreciation += 15;
  if (age >= 3) depreciation += 10;
  if (age >= 4) depreciation += (age - 3) * 2.5;

  return clamp(depreciation, 0, 100);
}

export function engineUsageDepPct(hours: number, maxLifetimeHours: number): number {
  const safeHours = Math.max(0, Number(hours) || 0);
  const safeLifetime = Math.max(1, Math.round(maxLifetimeHours));
  const percentage = (safeHours / safeLifetime) * 100;
  return clamp(percentage, 0, 100);
}

export function calculateEngineHoursValue(input: EngineHoursMethodInput): EngineHoursMethodResult {
  const replacementPriceExVat = Math.max(0, Number(input.replacementPriceExVat) || 0);
  const maxLifetimeHours = Math.max(1, Math.round(input.maxLifetimeHours));
  const hoursProvided = Number(input.hours);
  const hoursUsed = Number.isFinite(hoursProvided) && hoursProvided > 0
    ? Math.round(hoursProvided)
    : fallbackEngineHours(maxLifetimeHours, input.fallbackLifetimeUsedPercent);

  const ageDepPct = tractorAgeDepPct(input.yearModel, input.baseYear ?? currentBaseYear());
  const usageDepPct = engineUsageDepPct(hoursUsed, maxLifetimeHours);
  const averageDepPct = Math.round((ageDepPct + usageDepPct) / 2);
  const depreciatedValueExVat = replacementPriceExVat * (1 - averageDepPct / 100);
  const conditionAdjustedValueExVat = applyCondition(depreciatedValueExVat, input.condition, input.conditionFactorOverride);
  const marketabilityFactor = clamp(Number(input.marketabilityFactor) || 1, 0, 1);
  const marketabilityAdjustedValueExVat = conditionAdjustedValueExVat * marketabilityFactor;
  const salvage = resolveSalvageValue(marketabilityAdjustedValueExVat, replacementPriceExVat);

  return {
    hoursUsed,
    ageDepPct,
    usageDepPct,
    averageDepPct,
    depreciatedValueExVat: roundMoney(depreciatedValueExVat),
    conditionAdjustedValueExVat: roundMoney(conditionAdjustedValueExVat),
    marketabilityAdjustedValueExVat: roundMoney(marketabilityAdjustedValueExVat),
    salvagePercent: salvage.salvagePercent,
    salvageValueExVat: salvage.salvageValueExVat,
    isSalvageEstimate: salvage.isSalvageEstimate,
    finalValueExVat: salvage.finalValueExVat,
  };
}

export function calculateYearConditionValue(input: YearConditionMethodInput): YearConditionMethodResult {
  const replacementPriceExVat = Math.max(0, Number(input.replacementPriceExVat) || 0);
  const ageDepPct = tractorAgeDepPct(input.yearModel, input.baseYear ?? currentBaseYear());
  const depreciatedValueExVat = replacementPriceExVat * (1 - ageDepPct / 100);
  const conditionAdjustedValueExVat = applyCondition(depreciatedValueExVat, input.condition, input.conditionFactorOverride);
  const marketabilityFactor = clamp(Number(input.marketabilityFactor) || 1, 0, 1);
  const marketabilityAdjustedValueExVat = conditionAdjustedValueExVat * marketabilityFactor;
  const salvage = resolveSalvageValue(marketabilityAdjustedValueExVat, replacementPriceExVat);

  return {
    ageDepPct,
    depreciatedValueExVat: roundMoney(depreciatedValueExVat),
    conditionAdjustedValueExVat: roundMoney(conditionAdjustedValueExVat),
    marketabilityAdjustedValueExVat: roundMoney(marketabilityAdjustedValueExVat),
    salvagePercent: salvage.salvagePercent,
    salvageValueExVat: salvage.salvageValueExVat,
    isSalvageEstimate: salvage.isSalvageEstimate,
    finalValueExVat: salvage.finalValueExVat,
  };
}

export function calculatePercentUsedValue(input: PercentUsedMethodInput): PercentUsedMethodResult {
  const replacementPriceExVat = Math.max(0, Number(input.replacementPriceExVat) || 0);
  const percentUsed = clamp(Math.round(Number(input.percentUsed) || 0), 0, 100);
  const remainingPercent = 100 - percentUsed;
  const baseValueExVat = replacementPriceExVat * (remainingPercent / 100);
  const conditionAdjustedValueExVat = applyCondition(baseValueExVat, input.condition, input.conditionFactorOverride);
  const marketabilityFactor = clamp(Number(input.marketabilityFactor) || 1, 0, 1);
  const marketabilityAdjustedValueExVat = conditionAdjustedValueExVat * marketabilityFactor;
  const salvage = resolveSalvageValue(marketabilityAdjustedValueExVat, replacementPriceExVat);

  return {
    percentUsed,
    remainingPercent,
    baseValueExVat: roundMoney(baseValueExVat),
    conditionAdjustedValueExVat: roundMoney(conditionAdjustedValueExVat),
    marketabilityAdjustedValueExVat: roundMoney(marketabilityAdjustedValueExVat),
    salvagePercent: salvage.salvagePercent,
    salvageValueExVat: salvage.salvageValueExVat,
    isSalvageEstimate: salvage.isSalvageEstimate,
    finalValueExVat: salvage.finalValueExVat,
  };
}
