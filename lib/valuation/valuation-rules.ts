export type SalvageScalePoint = {
  replacementPriceExVat: number;
  salvagePercent: number;
};

export type SalvageResolution = {
  rawValueExVat: number;
  finalValueExVat: number;
  salvagePercent: number;
  salvageValueExVat: number;
  isSalvageEstimate: boolean;
};

export type OlderPassengerCarMarketability = {
  applies: boolean;
  factor: number;
  reductionPercent: number;
  yearsAfterThreshold: number;
};

export type InstalledExtraValueInput = {
  replacementPriceExVat: number;
  yearAdded: number | string | null | undefined;
  fallbackYear: number;
  baseYear?: number;
  annualDepreciationPercent?: number;
};

export const MAX_SALVAGE_PERCENT = 3;
export const OLDER_PASSENGER_CAR_AGE_THRESHOLD = 15;
export const OLDER_PASSENGER_CAR_ANNUAL_REDUCTION = 0.055;

// Interpolation between these points keeps the percentage and salvage amount
// smooth. A replacement price that crosses a point can never produce a lower
// salvage value simply because it moved into a new band.
export const SALVAGE_SCALE_POINTS: readonly SalvageScalePoint[] = [
  { replacementPriceExVat: 0, salvagePercent: 3 },
  { replacementPriceExVat: 100_000, salvagePercent: 3 },
  { replacementPriceExVat: 250_000, salvagePercent: 2.85 },
  { replacementPriceExVat: 500_000, salvagePercent: 2.6 },
  { replacementPriceExVat: 800_000, salvagePercent: 2.25 },
  { replacementPriceExVat: 1_200_000, salvagePercent: 2 },
  { replacementPriceExVat: 2_000_000, salvagePercent: 1.7 },
  { replacementPriceExVat: 3_500_000, salvagePercent: 1.45 },
  { replacementPriceExVat: 5_000_000, salvagePercent: 1.25 },
  { replacementPriceExVat: 7_500_000, salvagePercent: 1.1 },
  { replacementPriceExVat: 10_000_000, salvagePercent: 1 },
] as const;

const OLDER_PASSENGER_CAR_BODY_TYPES = new Set([
  'sedan',
  'fastback',
  'hatchback',
  'station_wagon',
  'station wagon',
  'estate',
]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
}

export function calculateSalvagePercent(replacementPriceExVat: number): number {
  const price = Math.max(0, Number(replacementPriceExVat) || 0);

  for (let index = 1; index < SALVAGE_SCALE_POINTS.length; index += 1) {
    const lower = SALVAGE_SCALE_POINTS[index - 1];
    const upper = SALVAGE_SCALE_POINTS[index];
    if (price > upper.replacementPriceExVat) continue;

    const span = upper.replacementPriceExVat - lower.replacementPriceExVat;
    if (span <= 0) return clamp(upper.salvagePercent, 0, MAX_SALVAGE_PERCENT);
    const progress = (price - lower.replacementPriceExVat) / span;
    const interpolated = lower.salvagePercent + progress * (upper.salvagePercent - lower.salvagePercent);
    return Math.round(clamp(interpolated, 0, MAX_SALVAGE_PERCENT) * 1000) / 1000;
  }

  return SALVAGE_SCALE_POINTS[SALVAGE_SCALE_POINTS.length - 1].salvagePercent;
}

export function calculateSalvageValue(replacementPriceExVat: number): number {
  const price = Math.max(0, Number(replacementPriceExVat) || 0);
  return Math.round(price * (calculateSalvagePercent(price) / 100));
}

export function resolveSalvageValue(rawValueExVat: number, replacementPriceExVat: number): SalvageResolution {
  const rawValue = Math.max(0, Number(rawValueExVat) || 0);
  const salvagePercent = calculateSalvagePercent(replacementPriceExVat);
  const salvageValueExVat = calculateSalvageValue(replacementPriceExVat);
  const isSalvageEstimate = salvageValueExVat > 0 && rawValue <= salvageValueExVat;

  return {
    rawValueExVat: Math.round(rawValue),
    finalValueExVat: isSalvageEstimate ? salvageValueExVat : Math.round(rawValue),
    salvagePercent,
    salvageValueExVat,
    isSalvageEstimate,
  };
}

export function calculateInstalledExtraValue(input: InstalledExtraValueInput): number {
  const baseYear = Number.isInteger(input.baseYear) ? Math.round(Number(input.baseYear)) : new Date().getFullYear();
  const parsedYear = Number(typeof input.yearAdded === 'string' ? input.yearAdded.trim() : input.yearAdded);
  const parsedFallbackYear = Number.isInteger(input.fallbackYear) ? Math.round(input.fallbackYear) : baseYear;
  const fallbackYear = parsedFallbackYear >= 1950 && parsedFallbackYear <= baseYear + 1 ? parsedFallbackYear : baseYear;
  const yearAdded = Number.isInteger(parsedYear) && parsedYear >= 1950 && parsedYear <= baseYear + 1
    ? parsedYear
    : fallbackYear;
  const replacementPriceExVat = Math.max(0, Number(input.replacementPriceExVat) || 0);
  const annualDepreciationPercent = Math.max(0, Number(input.annualDepreciationPercent) || 0);
  const age = Math.max(0, baseYear - yearAdded);
  const depreciationPercent = clamp(age * annualDepreciationPercent, 0, 100);
  const currentValueExVat = replacementPriceExVat * (1 - depreciationPercent / 100);

  return resolveSalvageValue(currentValueExVat, replacementPriceExVat).finalValueExVat;
}

export function calculateOlderPassengerCarMarketability(input: {
  sectorKey?: unknown;
  familyKey?: unknown;
  bodyType?: unknown;
  yearModel: number;
  yearModelUnknown?: boolean | null;
  baseYear?: number;
}): OlderPassengerCarMarketability {
  const sectorKey = normalizeKey(input.sectorKey);
  const familyKey = normalizeKey(input.familyKey);
  const bodyType = normalizeKey(input.bodyType);
  const baseYear = Number.isInteger(input.baseYear) ? Number(input.baseYear) : new Date().getFullYear();
  const yearModel = Number.isInteger(input.yearModel) ? Math.round(input.yearModel) : baseYear;
  const age = Math.max(0, baseYear - yearModel);
  const appliesToVehicle = sectorKey === 'motor'
    && ((familyKey === 'cars_suvs' && OLDER_PASSENGER_CAR_BODY_TYPES.has(bodyType))
      || ['sedan_fastback', 'hatchback', 'station_wagon'].includes(familyKey));
  const yearsAfterThreshold = Math.max(0, age - OLDER_PASSENGER_CAR_AGE_THRESHOLD);

  if (!appliesToVehicle || input.yearModelUnknown || yearsAfterThreshold === 0) {
    return { applies: false, factor: 1, reductionPercent: 0, yearsAfterThreshold };
  }

  const factor = Math.pow(1 - OLDER_PASSENGER_CAR_ANNUAL_REDUCTION, yearsAfterThreshold);
  return {
    applies: true,
    factor,
    reductionPercent: Math.round((1 - factor) * 1000) / 10,
    yearsAfterThreshold,
  };
}
