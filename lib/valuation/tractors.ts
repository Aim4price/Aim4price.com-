import type { ConditionKey, TractorType } from '../tractor-data';
import type { GpsType } from '../tractor-logic';
import {
  DEFAULT_ENGINE_FLOOR_PERCENT,
  applyFloor,
  calculateEngineHoursValue,
  clamp,
  currentBaseYear,
  roundMoney,
  tractorLifetimeHours,
} from './shared';

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

export function calculateTractorAim4priceValue(
  model: TractorValuationModel,
  yearModel: number,
  hours: number,
  condition: ConditionKey,
): number {
  return calculateEngineHoursValue({
    replacementPriceExVat: model.aim4priceReplacementExVat,
    yearModel,
    hours,
    condition,
    maxLifetimeHours: tractorLifetimeHours(model.tractorType, model.powerKw),
    floorPercent: DEFAULT_ENGINE_FLOOR_PERCENT,
  }).finalValueExVat;
}

export function calculateTractorFrontPtoValue(
  model: TractorValuationModel,
  yearModel: number,
  hours: number,
  condition: ConditionKey,
  enabled: boolean,
): number {
  if (!enabled || !model.frontPtoSupported || model.powerKw < 70) {
    return 0;
  }

  return calculateEngineHoursValue({
    replacementPriceExVat: FRONT_PTO_REPLACEMENT_EX_VAT,
    yearModel,
    hours,
    condition,
    maxLifetimeHours: tractorLifetimeHours(model.tractorType, model.powerKw),
    floorPercent: DEFAULT_ENGINE_FLOOR_PERCENT,
  }).finalValueExVat;
}

function loaderReplacementPrice(powerKw: number): number {
  if (powerKw < 80) return 175_000;
  if (powerKw <= 120) return 225_000;
  return 340_000;
}

export function calculateTractorLoaderValue(
  model: TractorValuationModel,
  yearModel: number,
  enabled: boolean,
): number {
  if (!enabled || !model.frontLoaderSupported) {
    return 0;
  }

  const replacementPrice = loaderReplacementPrice(model.powerKw);
  const age = Math.max(0, currentBaseYear() - Math.round(yearModel));
  const depreciation = clamp(age * 10, 0, 75);
  const currentValue = replacementPrice * (1 - depreciation / 100);

  return roundMoney(applyFloor(currentValue, replacementPrice, 0.25));
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
): number {
  if (!enabled || !model.gpsSupported) {
    return 0;
  }

  const normalizedType: GpsType = gpsType === 'full-autosteer' ? 'full-autosteer' : 'guidance-only';
  const replacementPrice =
    normalizedType === 'full-autosteer'
      ? GPS_FULL_AUTOSTEER_REPLACEMENT_EX_VAT
      : GPS_GUIDANCE_REPLACEMENT_EX_VAT;

  const actualGpsYear = parseGpsYear(gpsYear, fallbackYear);
  const age = Math.max(0, currentBaseYear() - actualGpsYear);
  const depreciation = clamp(age * 10, 0, 80);
  const currentValue = replacementPrice * (1 - depreciation / 100);

  return roundMoney(applyFloor(currentValue, replacementPrice, 0.2));
}
