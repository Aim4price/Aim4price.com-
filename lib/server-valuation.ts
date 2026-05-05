import { getDb } from './db';
import {
  calculateTractorAim4priceValue,
  calculateTractorFrontPtoValue,
  calculateTractorGpsValue,
  calculateTractorLoaderValue,
} from './valuation/tractors';
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
  equipmentModelId: number;
  legacyTractorCatalogId: number | null;
  frontPtoSupported: boolean;
  frontLoaderSupported: boolean;
  gpsSupported: boolean;
  isGenericFallback: boolean;
};

type EquipmentModelDbRow = {
  id: string | number;
  brand_slug: string | null;
  brand_name: string | null;
  model_name: string;
  tractor_type: string | null;
  drive_type: string | null;
  cab_type: string | null;
  power_kw: string | number | null;
  year_start: string | number | null;
  year_end: string | number | null;
  aim4price_replacement_price_ex_vat: string | number | null;
  replacement_price_year: string | number | null;
  is_generic_fallback: boolean | string | number | null;
  specs_json: Record<string, unknown> | null;
};

type MarketListingDbRow = {
  id: string | number;
  equipment_type: string | null;
  equipment_model_id: string | number | null;
  brand_name: string;
  model_name: string;
  tractor_type: string | null;
  drive_type: string | null;
  cab_type: string | null;
  power_kw: string | number | null;
  year_model: string | number | null;
  hours: string | number | null;
  advertised_price_ex_vat: string | number | null;
  source_name: string;
  source_url: string | null;
  province: string | null;
  area: string | null;
  date_advertised: string | null;
  is_sold: boolean | string | number | null;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeKey(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeModelKey(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
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

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function roundMoney(value: number): number {
  return Math.round(value);
}

function mapModelRow(row: EquipmentModelDbRow): DbTractorCatalogRow {
  const powerKw = toNumber(row.power_kw);
  const powerHp = Math.round(powerKw * 1.341);
  const replacement = toNumber(row.aim4price_replacement_price_ex_vat);
  const brandName = normalizeText(row.brand_name);
  const modelName = normalizeText(row.model_name);
  const specs = asObject(row.specs_json);

  return {
    id: String(row.id),
    title: `${brandName} ${modelName}`.trim(),
    name: `${brandName} ${modelName}`.trim(),
    brandName,
    brandSlug: normalizeText(row.brand_slug) || slugify(brandName),
    modelName,
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
    equipmentModelId: toNumber(row.id),
    legacyTractorCatalogId: null,
    frontPtoSupported: toBoolean(specs.front_pto_supported),
    frontLoaderSupported: toBoolean(specs.front_loader_supported),
    gpsSupported: toBoolean(specs.gps_supported),
    isGenericFallback: toBoolean(row.is_generic_fallback),
  };
}

function mapListingRow(row: MarketListingDbRow, model: TractorCatalogRow): MarketplaceListing {
  const brandName = normalizeText(row.brand_name) || model.brandName;
  const modelName = normalizeText(row.model_name) || model.modelName;
  const powerKw = toNumber(row.power_kw) || model.powerKw;
  const powerHp = Math.round(powerKw * 1.341);
  const province = normalizeText(row.province) || 'Unknown';
  const area = normalizeText(row.area) || province;
  const cab = normalizeCabTypeNullable(row.cab_type) ?? model.cab;

  return {
    id: String(row.id),
    modelId: model.id,
    title: `${brandName} ${modelName}`.trim(),
    brandName,
    brandSlug: slugify(brandName),
    modelName,
    tractorType: normalizeTractorType(row.tractor_type || model.tractorType),
    drive: normalizeDriveType(row.drive_type || model.drive),
    cab,
    powerKw,
    powerHp,
    horsepowerHp: powerHp,
    yearModel: toNumber(row.year_model),
    year: toNumber(row.year_model),
    hours: toNumber(row.hours),
    province,
    area,
    location: `${area}, ${province}`,
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

function addExtras(value: number | null, extrasValue: number): number | null {
  if (value === null) return null;
  return roundMoney(value + extrasValue);
}

type PricedMarketListing = {
  listing: MarketplaceListing;
  price: number;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function listingDedupeKey(listing: MarketplaceListing): string {
  const urlKey = normalizeKey(listing.sourceUrl);
  if (urlKey) return `url:${urlKey}`;

  return [
    normalizeKey(listing.sourceName),
    normalizeModelKey(listing.title),
    Math.round(listing.advertisedPriceExVat || listing.priceExVat || 0),
    listing.yearModel || 0,
    listing.hours || 0,
  ].join('|');
}

function uniqueListings(sourceRows: MarketplaceListing[]): MarketplaceListing[] {
  const seen = new Set<string>();
  const output: MarketplaceListing[] = [];

  for (const listing of sourceRows) {
    const key = listingDedupeKey(listing);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(listing);
  }

  return output;
}

function countDistinctMarketSources(sourceRows: MarketplaceListing[]): number {
  const sourceKeys = new Set(
    sourceRows.map((listing) => normalizeKey(listing.sourceName || listing.sourceUrl || listing.title)).filter(Boolean),
  );

  return sourceKeys.size;
}

function getCoverageBand(input: {
  pricedCount: number;
}): Result['coverageBand'] {
  if (input.pricedCount > 5) return 'green';
  if (input.pricedCount >= 3) return 'amber';
  return 'red';
}

function marketSnapshot(model: TractorCatalogRow, year: number, hours: number, sourceRows: MarketplaceListing[]) {
  const dedupedRows = uniqueListings(sourceRows);
  const exactWithCab = dedupedRows.filter((listing) => listing.cab === model.cab);
  const exactWithoutCab = exactWithCab.length ? exactWithCab : dedupedRows;

  const tightMatches = exactWithoutCab.filter((listing) => {
    const hasValidYear = Number.isFinite(listing.yearModel) && listing.yearModel >= 1950;
    const hasValidHours = Number.isFinite(listing.hours) && listing.hours > 0;
    const yearMatches = hasValidYear && Math.abs(listing.yearModel - year) <= 2;
    const hoursMatch = hasValidHours && Math.abs(listing.hours - hours) <= 1_000;

    return yearMatches && hoursMatch;
  });

  const candidateSource = tightMatches;
  if (!candidateSource.length) {
    return { low: null, high: null, mid: null, count: 0, source: candidateSource, coverageBand: 'red' as Result['coverageBand'] };
  }

  const pricedCandidates = candidateSource
    .map((listing): PricedMarketListing | null => {
      const price = toPositiveNumber(listing.advertisedPriceExVat) ?? toPositiveNumber(listing.priceExVat);
      return price === null ? null : { listing, price };
    })
    .filter((value): value is PricedMarketListing => value !== null);

  if (!pricedCandidates.length) {
    return { low: null, high: null, mid: null, count: candidateSource.length, source: candidateSource, coverageBand: 'red' as Result['coverageBand'] };
  }

  const medianPrice = median(pricedCandidates.map((item) => item.price));
  const consistentCandidates =
    medianPrice && pricedCandidates.length >= 3
      ? pricedCandidates.filter((item) => Math.abs(item.price - medianPrice) / medianPrice <= 0.25)
      : pricedCandidates;
  const valuationCandidates = consistentCandidates.length >= 2 ? consistentCandidates : pricedCandidates;
  const prices = valuationCandidates.map((item) => item.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const total = prices.reduce((sum, price) => sum + price, 0);
  const mid = roundMoney(total / prices.length);

  return {
    low: roundMoney(low),
    high: roundMoney(high),
    mid,
    count: valuationCandidates.length,
    source: valuationCandidates.map((item) => item.listing),
    coverageBand: getCoverageBand({
      pricedCount: valuationCandidates.length,
    }),
  };
}

async function fetchModel(modelId: string): Promise<DbTractorCatalogRow | null> {
  const db = getDb();
  const result = await db.query<EquipmentModelDbRow>(
    `
      select
        em.id,
        b.slug as brand_slug,
        b.name as brand_name,
        em.model_name,
        em.tractor_type,
        em.drive_type,
        em.cab_type,
        em.power_kw,
        em.year_start,
        em.year_end,
        em.aim4price_replacement_price_ex_vat,
        em.replacement_price_year,
        em.is_generic_fallback,
        em.specs_json
      from public.equipment_models em
      join public.equipment_families ef
        on ef.id = em.equipment_family_id
      join public.sectors s
        on s.id = ef.sector_id
      left join public.brands b
        on b.id = em.brand_id
      where s.sector_key = 'agricultural'
        and ef.family_key = 'tractors'
        and em.is_active = true
        and coalesce(em.is_generic_fallback, false) = false
        and em.id::text = $1
      order by em.id asc
      limit 1
    `,
    [modelId],
  );

  const row = result.rows[0];
  return row ? mapModelRow(row) : null;
}

async function fetchMarketListings(model: DbTractorCatalogRow): Promise<MarketplaceListing[]> {
  const db = getDb();
  const normalizedModelKey = normalizeModelKey(model.modelName);
  const values: Array<string | number> = [
    model.equipmentModelId,
    model.brandName.toLowerCase(),
    normalizedModelKey,
    model.tractorType,
    model.drive,
  ];

  const result = await db.query<MarketListingDbRow>(
    `
      with normalized_market as (
        select
          m.id,
          m.equipment_type,
          m.equipment_model_id,
          coalesce(b.name, m.brand_name_snapshot, m.brand_name, '') as brand_name,
          coalesce(m.model_name_raw, m.model_name, '') as model_name,
          m.tractor_type,
          m.drive_type,
          m.cab_type,
          m.power_kw,
          m.year_model,
          m.hours,
          m.advertised_price_ex_vat,
          m.source_name,
          m.source_url,
          m.province,
          m.area,
          m.date_advertised,
          m.is_sold,
          ef.family_key,
          lower(trim(coalesce(b.name, m.brand_name_snapshot, m.brand_name, ''))) as normalized_brand_name,
          regexp_replace(lower(trim(coalesce(m.model_name_raw, m.model_name, ''))), '[^a-z0-9]+', '', 'g') as normalized_listing_model_name,
          case
            when lower(trim(coalesce(m.tractor_type, ''))) in ('orchard', 'vineyard') then 'orchard'
            else 'field'
          end as normalized_tractor_type,
          case
            when lower(regexp_replace(trim(coalesce(m.drive_type, '')), '[^a-z0-9]+', '', 'g')) in ('2wd', '2x4', 'twowheeldrive') then '2wd'
            when lower(regexp_replace(trim(coalesce(m.drive_type, '')), '[^a-z0-9]+', '', 'g')) in ('track', 'tracks', 'tracked') then 'tracks'
            else '4wd'
          end as normalized_drive_type
        from public.market_vault_listings m
        left join public.equipment_families ef
          on ef.id = m.equipment_family_id
        left join public.brands b
          on b.id = m.brand_id
        where coalesce(m.is_sold, false) = false
          and m.advertised_price_ex_vat is not null
          and m.advertised_price_ex_vat > 0
      )
      select
        id,
        equipment_type,
        equipment_model_id,
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
        area,
        date_advertised,
        is_sold
      from normalized_market
      where
        equipment_model_id = $1
        or (
          normalized_brand_name = $2
          and normalized_listing_model_name <> ''
          and $3 <> ''
          and (
            normalized_listing_model_name = $3
            or normalized_listing_model_name like $3 || '%'
            or normalized_listing_model_name like '%' || $3 || '%'
          )
          and normalized_tractor_type = $4
          and normalized_drive_type = $5
          and (
            family_key = 'tractors'
            or lower(trim(coalesce(equipment_type, ''))) in ('tractor', 'tractors')
            or tractor_type is not null
            or equipment_model_id is not null
          )
        )
      order by date_advertised desc nulls last, year_model desc nulls last, hours asc nulls last, id desc
    `,
    values,
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

  const userReplacementPriceExVat =
    typeof input.userReplacementPriceExVat === 'number' && Number.isFinite(input.userReplacementPriceExVat) && input.userReplacementPriceExVat > 0
      ? Math.round(input.userReplacementPriceExVat)
      : null;
  const replacementPriceBasis: Result['replacementPriceBasis'] = userReplacementPriceExVat ? 'user' : 'aim4price';
  const replacementPriceUsedExVat = userReplacementPriceExVat ?? model.aim4priceReplacementExVat ?? null;

  const baseAim4priceValueExVat = calculateTractorAim4priceValue(model, safeYear, safeHours, input.condition, userReplacementPriceExVat);
  const baseMarket = marketSnapshot(model, safeYear, safeHours, marketListings);

  const frontPtoValueExVat = calculateTractorFrontPtoValue(model, safeYear, safeHours, input.condition, Boolean(input.frontPto));
  const frontLoaderValueExVat = calculateTractorLoaderValue(model, safeYear, Boolean(input.frontLoader));
  const gpsValueExVat = calculateTractorGpsValue(model, Boolean(input.gpsEnabled), input.gpsType, input.gpsYear, safeYear);
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
    coverageBand: baseMarket.coverageBand,
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
    replacementPriceBasis,
    replacementPriceUsedExVat,
    userReplacementPriceExVat,
  };
}
