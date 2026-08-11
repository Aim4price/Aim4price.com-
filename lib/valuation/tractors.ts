import type { ConditionKey, TractorType } from '../tractor-data';
import type { GpsType } from '../tractor-logic';
import {
  DEFAULT_ENGINE_FLOOR_PERCENT,
  calculateEngineHoursValue,
  clamp,
  currentBaseYear,
  tractorLifetimeHours,
  type EngineHoursMethodResult,
} from './shared';
import { resolveSalvageValue } from './valuation-rules';

export const FRONT_PTO_REPLACEMENT_EX_VAT = 250_000;
export const GPS_FULL_AUTOSTEER_REPLACEMENT_EX_VAT = 250_000;
export const GPS_GUIDANCE_REPLACEMENT_EX_VAT = 100_000;

export type TractorValuationModel = {
  tractorType: TractorType;
  powerKw: number;
  aim4priceReplacementExVat: number;
  frontPtoSupported: boolean;
  frontLoaderSupported: boolean;
  gpsSupported: boolean;
};


type TractorAssumptionOptions = {
  maxLifetimeHours?: number | null;
  conditionFactorOverride?: number | null;
};

function resolveReplacementPrice(overrideExVat: number | null | undefined, fallbackExVat: number): number {
  return typeof overrideExVat === 'number' && Number.isFinite(overrideExVat) && overrideExVat > 0
    ? Math.round(overrideExVat)
    : fallbackExVat;
}

export function calculateTractorAim4priceValue(
  model: TractorValuationModel,
  yearModel: number,
  hours: number,
  condition: ConditionKey,
  replacementPriceOverrideExVat?: number | null,
  options?: TractorAssumptionOptions,
): number {
  return calculateTractorAim4priceDetails(
    model,
    yearModel,
    hours,
    condition,
    replacementPriceOverrideExVat,
    options,
  ).finalValueExVat;
}

export function calculateTractorAim4priceDetails(
  model: TractorValuationModel,
  yearModel: number,
  hours: number,
  condition: ConditionKey,
  replacementPriceOverrideExVat?: number | null,
  options?: TractorAssumptionOptions,
): EngineHoursMethodResult {
  const replacementPriceExVat =
    typeof replacementPriceOverrideExVat === 'number' && Number.isFinite(replacementPriceOverrideExVat) && replacementPriceOverrideExVat > 0
      ? replacementPriceOverrideExVat
      : model.aim4priceReplacementExVat;

  return calculateEngineHoursValue({
    replacementPriceExVat,
    yearModel,
    hours,
    condition,
    maxLifetimeHours: options?.maxLifetimeHours ?? tractorLifetimeHours(model.tractorType, model.powerKw),
    floorPercent: DEFAULT_ENGINE_FLOOR_PERCENT,
    conditionFactorOverride: options?.conditionFactorOverride,
  });
}

export function calculateTractorFrontPtoValue(
  model: TractorValuationModel,
  yearModel: number,
  hours: number,
  condition: ConditionKey,
  enabled: boolean,
  options?: TractorAssumptionOptions,
  replacementPriceOverrideExVat?: number | null,
): number {
  if (!enabled) {
    return 0;
  }

  return calculateEngineHoursValue({
    replacementPriceExVat: getTractorFrontPtoReplacementPrice(replacementPriceOverrideExVat),
    yearModel,
    hours,
    condition,
    maxLifetimeHours: options?.maxLifetimeHours ?? tractorLifetimeHours(model.tractorType, model.powerKw),
    floorPercent: DEFAULT_ENGINE_FLOOR_PERCENT,
    conditionFactorOverride: options?.conditionFactorOverride,
  }).finalValueExVat;
}

function loaderReplacementPrice(powerKw: number): number {
  if (powerKw < 80) return 175_000;
  if (powerKw <= 120) return 225_000;
  return 340_000;
}

export function getTractorFrontPtoReplacementPrice(overrideExVat?: number | null): number {
  return resolveReplacementPrice(overrideExVat, FRONT_PTO_REPLACEMENT_EX_VAT);
}

export function getTractorLoaderReplacementPrice(model: TractorValuationModel, overrideExVat?: number | null): number {
  return resolveReplacementPrice(overrideExVat, loaderReplacementPrice(model.powerKw));
}

export function getTractorGpsReplacementPrice(gpsType: GpsType | null | undefined, overrideExVat?: number | null): number {
  const fallback = gpsType === 'full-autosteer'
    ? GPS_FULL_AUTOSTEER_REPLACEMENT_EX_VAT
    : GPS_GUIDANCE_REPLACEMENT_EX_VAT;
  return resolveReplacementPrice(overrideExVat, fallback);
}

export function calculateTractorLoaderValue(
  model: TractorValuationModel,
  yearModel: number,
  enabled: boolean,
  replacementPriceOverrideExVat?: number | null,
): number {
  if (!enabled) {
    return 0;
  }

  const replacementPrice = getTractorLoaderReplacementPrice(model, replacementPriceOverrideExVat);
  const age = Math.max(0, currentBaseYear() - Math.round(yearModel));
  const depreciation = clamp(age * 10, 0, 100);
  const currentValue = replacementPrice * (1 - depreciation / 100);

  return resolveSalvageValue(currentValue, replacementPrice).finalValueExVat;
}

function parseGpsYear(value: number | string | null | undefined, fallbackYear: number): number {
  const parsed = Number(typeof value === 'string' ? value.trim() : value);

  if (!Number.isInteger(parsed) || parsed < 1950 || parsed > currentBaseYear() + 1) {
    return fallbackYear;
  }

  return parsed;
}

export function calculateTractorGpsValue(
  model: TractorValuationModel,
  enabled: boolean,
  gpsType: GpsType | null | undefined,
  gpsYear: number | string | null | undefined,
  fallbackYear: number,
  replacementPriceOverrideExVat?: number | null,
): number {
  if (!enabled) {
    return 0;
  }

  const normalizedType: GpsType = gpsType === 'full-autosteer' ? 'full-autosteer' : 'guidance-only';
  const replacementPrice = getTractorGpsReplacementPrice(normalizedType, replacementPriceOverrideExVat);

  const actualGpsYear = parseGpsYear(gpsYear, fallbackYear);
  const age = Math.max(0, currentBaseYear() - actualGpsYear);
  const depreciation = clamp(age * 10, 0, 100);
  const currentValue = replacementPrice * (1 - depreciation / 100);

  return resolveSalvageValue(currentValue, replacementPrice).finalValueExVat;
}
