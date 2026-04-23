import type { ConditionKey, TractorType } from '../tractor-data';

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

export type EngineHoursMethodInput = {
  replacementPriceExVat: number;
  yearModel: number;
  hours?: number | null;
  condition: ConditionKey;
  maxLifetimeHours: number;
  fallbackLifetimeUsedPercent?: number;
  floorPercent?: number;
  baseYear?: number;
};

export type EngineHoursMethodResult = {
  hoursUsed: number;
  ageDepPct: number;
  usageDepPct: number;
  averageDepPct: number;
  depreciatedValueExVat: number;
  conditionAdjustedValueExVat: number;
  finalValueExVat: number;
};

export type YearConditionMethodInput = {
  replacementPriceExVat: number;
  yearModel: number;
  condition: ConditionKey;
  floorPercent?: number;
  baseYear?: number;
};

export type YearConditionMethodResult = {
  ageDepPct: number;
  depreciatedValueExVat: number;
  conditionAdjustedValueExVat: number;
  finalValueExVat: number;
};

export type PercentUsedMethodInput = {
  replacementPriceExVat: number;
  percentUsed: number;
  condition: ConditionKey;
  floorPercent?: number;
};

export type PercentUsedMethodResult = {
  percentUsed: number;
  remainingPercent: number;
  baseValueExVat: number;
  conditionAdjustedValueExVat: number;
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

export function applyCondition(value: number, condition: ConditionKey): number {
  return value * CONDITION_FACTORS[condition];
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
  const conditionAdjustedValueExVat = applyCondition(depreciatedValueExVat, input.condition);
  const finalValueExVat = roundMoney(
    applyFloor(
      conditionAdjustedValueExVat,
      replacementPriceExVat,
      input.floorPercent ?? DEFAULT_ENGINE_FLOOR_PERCENT,
    ),
  );

  return {
    hoursUsed,
    ageDepPct,
    usageDepPct,
    averageDepPct,
    depreciatedValueExVat: roundMoney(depreciatedValueExVat),
    conditionAdjustedValueExVat: roundMoney(conditionAdjustedValueExVat),
    finalValueExVat,
  };
}

export function calculateYearConditionValue(input: YearConditionMethodInput): YearConditionMethodResult {
  const replacementPriceExVat = Math.max(0, Number(input.replacementPriceExVat) || 0);
  const ageDepPct = tractorAgeDepPct(input.yearModel, input.baseYear ?? currentBaseYear());
  const depreciatedValueExVat = replacementPriceExVat * (1 - ageDepPct / 100);
  const conditionAdjustedValueExVat = applyCondition(depreciatedValueExVat, input.condition);
  const finalValueExVat = roundMoney(
    applyFloor(
      conditionAdjustedValueExVat,
      replacementPriceExVat,
      input.floorPercent ?? DEFAULT_NON_PROPELLED_FLOOR_PERCENT,
    ),
  );

  return {
    ageDepPct,
    depreciatedValueExVat: roundMoney(depreciatedValueExVat),
    conditionAdjustedValueExVat: roundMoney(conditionAdjustedValueExVat),
    finalValueExVat,
  };
}

export function calculatePercentUsedValue(input: PercentUsedMethodInput): PercentUsedMethodResult {
  const replacementPriceExVat = Math.max(0, Number(input.replacementPriceExVat) || 0);
  const percentUsed = clamp(Math.round(Number(input.percentUsed) || 0), 0, 100);
  const remainingPercent = 100 - percentUsed;
  const baseValueExVat = replacementPriceExVat * (remainingPercent / 100);
  const conditionAdjustedValueExVat = applyCondition(baseValueExVat, input.condition);
  const finalValueExVat = roundMoney(
    applyFloor(
      conditionAdjustedValueExVat,
      replacementPriceExVat,
      input.floorPercent ?? DEFAULT_NON_PROPELLED_FLOOR_PERCENT,
    ),
  );

  return {
    percentUsed,
    remainingPercent,
    baseValueExVat: roundMoney(baseValueExVat),
    conditionAdjustedValueExVat: roundMoney(conditionAdjustedValueExVat),
    finalValueExVat,
  };
}
