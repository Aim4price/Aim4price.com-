import {
  listings,
  tractors,
  type ConditionKey,
  type MarketplaceListing,
  type TractorCatalogRow,
  type TractorType,
} from './tractor-data';

export type GpsType = 'full-autosteer' | 'guidance-only';

export type RunValuationInput = {
  modelId: string;
  year: number;
  hours: number;
  condition: ConditionKey;
  frontPto?: boolean;
  frontLoader?: boolean;
  gpsEnabled?: boolean;
  gpsType?: GpsType | null;
  gpsYear?: number | string | null;
};

export type Result = {
  model: TractorCatalogRow;
  aim4priceValueExVat: number | null;
  marketLow: number | null;
  marketHigh: number | null;
  marketMid: number | null;
  marketCount: number;
  marketSources: MarketplaceListing[];
  coverageBand: 'green' | 'amber' | 'red';
  previewValueExVat: number | null;
  previewLabel: 'Market average' | 'Aim4price Value';
  baseAim4priceValueExVat: number | null;
  baseMarketLow: number | null;
  baseMarketHigh: number | null;
  baseMarketMid: number | null;
  extrasValueExVat: number;
  frontPtoValueExVat: number;
  frontLoaderValueExVat: number;
  gpsValueExVat: number;
};

const CONDITION_FACTORS: Record<ConditionKey, number> = {
  excellent: 0.95,
  good: 0.85,
  fair: 0.75,
  used: 0.65,
  serious: 0.55,
};

const FALLBACK_TRACTOR_FLOOR_PERCENT = 0.05;
const FRONT_PTO_REPLACEMENT_EX_VAT = 250_000;
const GPS_FULL_AUTOSTEER_REPLACEMENT_EX_VAT = 250_000;
const GPS_GUIDANCE_REPLACEMENT_EX_VAT = 100_000;

export const conditionLabel = (key: ConditionKey): string =>
  ({
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    used: 'Used',
    serious: 'Requires Attention',
  })[key];

export function money(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'N/A';
  }

  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function range(low: number | null, high: number | null): string {
  if (low === null || high === null) {
    return 'N/A';
  }

  return `${money(low)} - ${money(high)}`;
}

export function getModel(id: string): TractorCatalogRow | undefined {
  return tractors.find((tractor) => tractor.id === id);
}

function roundMoney(value: number): number {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function currentBaseYear(): number {
  return new Date().getFullYear();
}

function toPositiveNumber(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}

function lifetime(type: TractorType, kw: number): number {
  if (type === 'orchard') return 10_000;
  if (kw <= 25) return 8_000;
  if (kw <= 75) return 12_000;
  return 14_000;
}

function ageDep(year: number, baseYear = currentBaseYear()): number {
  const safeYear = Number.isFinite(year) ? Math.round(year) : baseYear;
  const age = Math.max(0, baseYear - safeYear);

  let depreciation = 0;
  if (age >= 1) depreciation += 20;
  if (age >= 2) depreciation += 15;
  if (age >= 3) depreciation += 10;
  if (age >= 4) depreciation += (age - 3) * 2.5;

  return clamp(depreciation, 0, 100);
}

function usageDep(type: TractorType, hours: number, kw: number): number {
  const safeHours = Math.max(0, Number(hours) || 0);
  const percentage = (safeHours / lifetime(type, kw)) * 100;
  return clamp(percentage, 0, 100);
}

function averageDep(model: TractorCatalogRow, year: number, hours: number): number {
  return Math.round((ageDep(year) + usageDep(model.tractorType, hours, model.powerKw)) / 2);
}

function applyCondition(value: number, condition: ConditionKey): number {
  return value * CONDITION_FACTORS[condition];
}

function applyFloor(value: number, replacementBase: number, floorPercent: number): number {
  return Math.max(value, replacementBase * floorPercent);
}

function aim4BaseValue(
  model: TractorCatalogRow,
  year: number,
  hours: number,
  condition: ConditionKey,
): number {
  const depreciation = averageDep(model, year, hours);
  const afterDep = model.aim4priceReplacementExVat * (1 - depreciation / 100);
  const afterCondition = applyCondition(afterDep, condition);
  return roundMoney(applyFloor(afterCondition, model.aim4priceReplacementExVat, FALLBACK_TRACTOR_FLOOR_PERCENT));
}

type MarketSnapshot = {
  low: number | null;
  high: number | null;
  mid: number | null;
  count: number;
  source: MarketplaceListing[];
};

function market(model: TractorCatalogRow, year: number, hours: number): MarketSnapshot {
  const exactWithCab = listings.filter(
    (listing) =>
      listing.brandSlug === model.brandSlug &&
      listing.modelName === model.modelName &&
      listing.tractorType === model.tractorType &&
      listing.drive === model.drive &&
      listing.cab === model.cab,
  );

  const exactWithoutCab = exactWithCab.length
    ? exactWithCab
    : listings.filter(
        (listing) =>
          listing.brandSlug === model.brandSlug &&
          listing.modelName === model.modelName &&
          listing.tractorType === model.tractorType &&
          listing.drive === model.drive,
      );

  const tightMatches = exactWithoutCab.filter(
    (listing) => Math.abs(listing.yearModel - year) <= 2 && Math.abs(listing.hours - hours) <= 1_000,
  );

  const source = tightMatches.length ? tightMatches : exactWithoutCab;
  if (!source.length) {
    return { low: null, high: null, mid: null, count: 0, source };
  }

  const prices = source
    .map((listing) =>
      toPositiveNumber(listing.advertisedPriceExVat) ??
      toPositiveNumber(listing.askingPriceExVat) ??
      toPositiveNumber(listing.priceExVat) ??
      toPositiveNumber(listing.price),
    )
    .filter((value): value is number => value !== null);

  if (!prices.length) {
    return { low: null, high: null, mid: null, count: source.length, source };
  }

  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const total = prices.reduce((sum, value) => sum + value, 0);
  const mid = Math.round(total / prices.length);

  return {
    low: Math.round(low),
    high: Math.round(high),
    mid,
    count: source.length,
    source,
  };
}

function frontPtoValue(
  model: TractorCatalogRow,
  year: number,
  hours: number,
  condition: ConditionKey,
  enabled: boolean,
): number {
  if (!enabled || model.powerKw < 70) {
    return 0;
  }

  const depreciation = averageDep(model, year, hours);
  const afterDep = FRONT_PTO_REPLACEMENT_EX_VAT * (1 - depreciation / 100);
  const afterCondition = applyCondition(afterDep, condition);

  return Math.round(applyFloor(afterCondition, FRONT_PTO_REPLACEMENT_EX_VAT, FALLBACK_TRACTOR_FLOOR_PERCENT));
}

function loaderReplacementPrice(kw: number): number {
  if (kw < 80) return 175_000;
  if (kw <= 120) return 225_000;
  return 340_000;
}

function loaderValue(model: TractorCatalogRow, year: number, enabled: boolean): number {
  if (!enabled) {
    return 0;
  }

  const replacementPrice = loaderReplacementPrice(model.powerKw);
  const age = Math.max(0, currentBaseYear() - Math.round(year));
  const depreciation = clamp(age * 10, 0, 75);
  const currentValue = replacementPrice * (1 - depreciation / 100);

  return Math.round(applyFloor(currentValue, replacementPrice, 0.25));
}

function parseGpsYear(value: number | string | null | undefined, fallbackYear: number): number {
  const parsed = Number(typeof value === 'string' ? value.trim() : value);

  if (!Number.isInteger(parsed) || parsed < 1950 || parsed > currentBaseYear() + 1) {
    return fallbackYear;
  }

  return parsed;
}

function gpsValue(
  enabled: boolean,
  gpsType: GpsType | null | undefined,
  gpsYear: number | string | null | undefined,
  fallbackYear: number,
): number {
  if (!enabled) {
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

  return Math.round(applyFloor(currentValue, replacementPrice, 0.2));
}

function addExtras(value: number | null, extrasValue: number): number | null {
  if (value === null) {
    return null;
  }

  return Math.round(value + extrasValue);
}

function getCoverageBand(marketCount: number): Result['coverageBand'] {
  if (marketCount >= 5) return 'green';
  if (marketCount >= 2) return 'amber';
  return 'red';
}

export function runValuation(input: RunValuationInput): Result {
  const model = getModel(input.modelId);
  if (!model) {
    throw new Error('MODEL_NOT_FOUND');
  }

  const safeYear = Math.round(input.year);
  const safeHours = Math.max(0, Number(input.hours) || 0);

  const baseAim4priceValueExVat = aim4BaseValue(model, safeYear, safeHours, input.condition);
  const baseMarket = market(model, safeYear, safeHours);

  const frontPtoValueExVat = frontPtoValue(model, safeYear, safeHours, input.condition, Boolean(input.frontPto));
  const frontLoaderValueExVat = loaderValue(model, safeYear, Boolean(input.frontLoader));
  const gpsValueExVat = gpsValue(Boolean(input.gpsEnabled), input.gpsType, input.gpsYear, safeYear);
  const extrasValueExVat = frontPtoValueExVat + frontLoaderValueExVat + gpsValueExVat;

  const aim4priceValueExVat = addExtras(baseAim4priceValueExVat, extrasValueExVat);
  const marketLow = addExtras(baseMarket.low, extrasValueExVat);
  const marketHigh = addExtras(baseMarket.high, extrasValueExVat);
  const marketMid = addExtras(baseMarket.mid, extrasValueExVat);

  const previewValueExVat = marketMid ?? aim4priceValueExVat;
  const previewLabel: Result['previewLabel'] = marketMid !== null ? 'Market average' : 'Aim4price Value';

  return {
    model,
    aim4priceValueExVat,
    marketLow,
    marketHigh,
    marketMid,
    marketCount: baseMarket.count,
    marketSources: baseMarket.source,
    coverageBand: getCoverageBand(baseMarket.count),
    previewValueExVat,
    previewLabel,
    baseAim4priceValueExVat,
    baseMarketLow: baseMarket.low,
    baseMarketHigh: baseMarket.high,
    baseMarketMid: baseMarket.mid,
    extrasValueExVat,
    frontPtoValueExVat,
    frontLoaderValueExVat,
    gpsValueExVat,
  };
}
