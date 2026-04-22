import { getDb } from './db';
import type {
  CabType,
  ConditionKey,
  DriveType,
  MarketplaceListing,
  TractorCatalogRow,
  TractorType,
} from './tractor-data';
import type { GpsType, Result, RunValuationInput } from './tractor-logic';

type DbTractorCatalogRow = TractorCatalogRow & {
  frontPtoSupported: boolean;
  frontLoaderSupported: boolean;
  gpsSupported: boolean;
};

type TractorCatalogDbRow = {
  id: string | number;
  brand_slug: string;
  brand_name: string;
  model_name: string;
  tractor_type: string;
  drive_type: string;
  cab_type: string;
  power_kw: string | number;
  year_start: string | number;
  year_end: string | number;
  aim4price_replacement_price_ex_vat: string | number;
  front_pto_supported: boolean | string | number | null;
  front_loader_supported: boolean | string | number | null;
  gps_supported: boolean | string | number | null;
};

type MarketListingDbRow = {
  id: string | number;
  equipment_type: string | null;
  brand_name: string;
  model_name: string;
  tractor_type: string;
  drive_type: string;
  cab_type: string | null;
  power_kw: string | number;
  year_model: string | number;
  hours: string | number;
  advertised_price_ex_vat: string | number | null;
  source_name: string;
  source_url: string | null;
  province: string | null;
  date_advertised: string | null;
  is_sold: boolean | string | number | null;
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

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeKey(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTractorType(value: unknown): TractorType {
  const normalized = normalizeKey(value);
  return normalized === 'orchard' || normalized === 'vineyard' ? 'orchard' : 'field';
}

function normalizeDriveType(value: unknown): DriveType {
  const normalized = normalizeKey(value).replace(/\s+/g, '');

  if (normalized === '2wd' || normalized === '2-wheel-drive' || normalized === 'twowheeldrive') {
    return '2wd';
  }

  if (normalized === 'tracks' || normalized === 'track' || normalized === 'tracked') {
    return 'tracks';
  }

  return '4wd';
}

function normalizeCabType(value: unknown): CabType {
  const normalized = normalizeKey(value).replace(/[_-]+/g, ' ');
  return normalized.includes('open') ? 'open-station' : 'cab';
}

function normalizeCabTypeNullable(value: unknown): CabType | null {
  const text = normalizeText(value);
  if (!text) return null;
  return normalizeCabType(text);
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toPositiveNumber(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = normalizeKey(value);
  return normalized === 'true' || normalized === 't' || normalized === '1' || normalized === 'yes';
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

function addExtras(value: number | null, extrasValue: number): number | null {
  if (value === null) return null;
  return roundMoney(value + extrasValue);
}

function parseGpsYear(value: number | string | null | undefined, fallbackYear: number): number {
  const parsed = Number(typeof value === 'string' ? value.trim() : value);

  if (!Number.isInteger(parsed) || parsed < 1950 || parsed > currentBaseYear() + 1) {
    return fallbackYear;
  }

  return parsed;
}

function loaderReplacementPrice(kw: number): number {
  if (kw < 80) return 175_000;
  if (kw <= 120) return 225_000;
  return 340_000;
}

function mapModelRow(row: TractorCatalogDbRow): DbTractorCatalogRow {
  const powerKw = toNumber(row.power_kw);
  const powerHp = Math.round(powerKw * 1.341);
  const replacement = toNumber(row.aim4price_replacement_price_ex_vat);
  const brandName = normalizeText(row.brand_name);

  return {
    id: String(row.id),
    title: `${brandName} ${normalizeText(row.model_name)}`,
    name: `${brandName} ${normalizeText(row.model_name)}`,
    brandName,
    brandSlug: normalizeText(row.brand_slug) || slugify(brandName),
    modelName: normalizeText(row.model_name),
    tractorType: normalizeTractorType(row.tractor_type),
    drive: normalizeDriveType(row.drive_type),
    cab: normalizeCabType(row.cab_type),
    powerKw,
    powerHp,
    horsepowerHp: powerHp,
    yearStart: toNumber(row.year_start),
    yearEnd: toNumber(row.year_end),
    startYear: toNumber(row.year_start),
    endYear: toNumber(row.year_end),
    aim4priceReplacementExVat: replacement,
    replacementPriceExVat: replacement,
    imageSrc: '/brand/Tractor.png',
    frontPtoSupported: toBoolean(row.front_pto_supported),
    frontLoaderSupported: toBoolean(row.front_loader_supported),
    gpsSupported: toBoolean(row.gps_supported),
  };
}

function mapListingRow(row: MarketListingDbRow, model: TractorCatalogRow): MarketplaceListing {
  const brandName = normalizeText(row.brand_name);
  const modelName = normalizeText(row.model_name);
  const powerKw = toNumber(row.power_kw);
  const powerHp = Math.round(powerKw * 1.341);
  const province = normalizeText(row.province) || 'Unknown';
  const cab = normalizeCabTypeNullable(row.cab_type) ?? model.cab;

  return {
    id: String(row.id),
    modelId: model.id,
    title: `${brandName} ${modelName}`,
    brandName,
    brandSlug: slugify(brandName),
    modelName,
    tractorType: normalizeTractorType(row.tractor_type),
    drive: normalizeDriveType(row.drive_type),
    cab,
    powerKw,
    powerHp,
    horsepowerHp: powerHp,
    yearModel: toNumber(row.year_model),
    year: toNumber(row.year_model),
    hours: toNumber(row.hours),
    province,
    area: province,
    location: province,
    sourceName: normalizeText(row.source_name),
    sourceUrl: normalizeText(row.source_url),
    dateAdvertised: normalizeText(row.date_advertised),
    advertisedPriceExVat: toNumber(row.advertised_price_ex_vat),
    priceExVat: toNumber(row.advertised_price_ex_vat),
    askingPriceExVat: toNumber(row.advertised_price_ex_vat),
    price: toNumber(row.advertised_price_ex_vat),
    imageSrc: '/brand/Tractor.png',
  };
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

function marketSnapshot(model: TractorCatalogRow, year: number, hours: number, sourceRows: MarketplaceListing[]) {
  const exactWithCab = sourceRows.filter((listing) => listing.cab === model.cab);
  const exactWithoutCab = exactWithCab.length ? exactWithCab : sourceRows;

  const tightMatches = exactWithoutCab.filter(
    (listing) => Math.abs(listing.yearModel - year) <= 2 && Math.abs(listing.hours - hours) <= 1_000,
  );

  const source = tightMatches.length ? tightMatches : exactWithoutCab;
  if (!source.length) {
    return { low: null, high: null, mid: null, count: 0, source };
  }

  const prices = source
    .map((listing) => toPositiveNumber(listing.advertisedPriceExVat) ?? toPositiveNumber(listing.priceExVat) ?? null)
    .filter((value): value is number => value !== null);

  if (!prices.length) {
    return { low: null, high: null, mid: null, count: source.length, source };
  }

  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const total = prices.reduce((sum, price) => sum + price, 0);
  const mid = roundMoney(total / prices.length);

  return {
    low: roundMoney(low),
    high: roundMoney(high),
    mid,
    count: source.length,
    source,
  };
}

function getCoverageBand(marketCount: number): Result['coverageBand'] {
  if (marketCount >= 5) return 'green';
  if (marketCount >= 2) return 'amber';
  return 'red';
}

function frontPtoValue(
  model: DbTractorCatalogRow,
  year: number,
  hours: number,
  condition: ConditionKey,
  enabled: boolean,
): number {
  if (!enabled || !model.frontPtoSupported || model.powerKw < 70) {
    return 0;
  }

  const depreciation = averageDep(model, year, hours);
  const afterDep = FRONT_PTO_REPLACEMENT_EX_VAT * (1 - depreciation / 100);
  const afterCondition = applyCondition(afterDep, condition);

  return roundMoney(applyFloor(afterCondition, FRONT_PTO_REPLACEMENT_EX_VAT, FALLBACK_TRACTOR_FLOOR_PERCENT));
}

function loaderValue(model: DbTractorCatalogRow, year: number, enabled: boolean): number {
  if (!enabled || !model.frontLoaderSupported) {
    return 0;
  }

  const replacementPrice = loaderReplacementPrice(model.powerKw);
  const age = Math.max(0, currentBaseYear() - Math.round(year));
  const depreciation = clamp(age * 10, 0, 75);
  const currentValue = replacementPrice * (1 - depreciation / 100);

  return roundMoney(applyFloor(currentValue, replacementPrice, 0.25));
}

function gpsValue(
  model: DbTractorCatalogRow,
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

async function fetchModel(modelId: string): Promise<DbTractorCatalogRow | null> {
  const db = getDb();
  const result = await db.query<TractorCatalogDbRow>(
    `
      select
        tc.id,
        b.slug as brand_slug,
        b.name as brand_name,
        tc.model_name,
        tc.tractor_type,
        tc.drive_type,
        tc.cab_type,
        tc.power_kw,
        tc.year_start,
        tc.year_end,
        tc.aim4price_replacement_price_ex_vat,
        tc.front_pto_supported,
        tc.front_loader_supported,
        tc.gps_supported
      from tractor_catalog tc
      join brands b on b.id = tc.brand_id
      where tc.id::text = $1
      limit 1
    `,
    [modelId],
  );

  const row = result.rows[0];
  return row ? mapModelRow(row) : null;
}

async function fetchMarketListings(model: TractorCatalogRow): Promise<MarketplaceListing[]> {
  const db = getDb();
  const result = await db.query<MarketListingDbRow>(
    `
      select
        id,
        equipment_type,
        brand_name,
        model_name,
        tractor_type,
        drive_type,
        cab_type,
        power_kw,
        year_model,
        hours,
        advertised_price_ex_vat,
        source_name,
        source_url,
        province,
        date_advertised,
        is_sold
      from market_vault_listings
      where lower(trim(coalesce(equipment_type, 'tractor'))) = 'tractor'
        and lower(trim(brand_name)) = $1
        and lower(trim(model_name)) = $2
        and lower(trim(tractor_type)) = $3
        and lower(replace(trim(drive_type), ' ', '')) = $4
        and coalesce(is_sold, false) = false
      order by date_advertised desc nulls last, year_model desc, hours asc
    `,
    [model.brandName.toLowerCase(), model.modelName.toLowerCase(), model.tractorType, model.drive],
  );

  return result.rows.map((row) => mapListingRow(row, model));
}

export async function runServerValuation(input: RunValuationInput): Promise<Result> {
  const model = await fetchModel(String(input.modelId));
  if (!model) {
    throw new Error('MODEL_NOT_FOUND');
  }

  const safeYear = Math.round(input.year);
  const safeHours = Math.max(0, Number(input.hours) || 0);

  const marketListings = await fetchMarketListings(model);

  const baseAim4priceValueExVat = aim4BaseValue(model, safeYear, safeHours, input.condition);
  const baseMarket = marketSnapshot(model, safeYear, safeHours, marketListings);

  const frontPtoValueExVat = frontPtoValue(model, safeYear, safeHours, input.condition, Boolean(input.frontPto));
  const frontLoaderValueExVat = loaderValue(model, safeYear, Boolean(input.frontLoader));
  const gpsValueExVat = gpsValue(model, Boolean(input.gpsEnabled), input.gpsType, input.gpsYear, safeYear);
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
