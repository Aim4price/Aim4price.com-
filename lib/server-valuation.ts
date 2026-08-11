import { getDb } from './db';
import {
  calculateTractorAim4priceDetails,
  calculateTractorFrontPtoValue,
  calculateTractorGpsValue,
  calculateTractorLoaderValue,
  getTractorFrontPtoReplacementPrice,
  getTractorGpsReplacementPrice,
  getTractorLoaderReplacementPrice,
} from './valuation/tractors';
import {
  getValuationConditionFactorOverride,
  normalizeAdvancedAssumptions,
  tractorLifetimeHours,
} from './valuation/shared';
import type {
  CabType,
  DriveType,
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

function addExtras(value: number | null, extrasValue: number): number | null {
  if (value === null) return null;
  return roundMoney(value + extrasValue);
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

export async function runServerValuation(input: RunValuationInput): Promise<Result> {
  const model = await fetchModel(String(input.modelId));
  if (!model) {
    throw new Error('MODEL_NOT_FOUND');
  }

  const safeYear = Math.round(input.year);
  const safeHours = Math.max(0, Number(input.hours) || 0);
  const userReplacementPriceExVat =
    typeof input.userReplacementPriceExVat === 'number' && Number.isFinite(input.userReplacementPriceExVat) && input.userReplacementPriceExVat > 0
      ? Math.round(input.userReplacementPriceExVat)
      : null;
  const replacementPriceBasis: Result['replacementPriceBasis'] = userReplacementPriceExVat ? 'user' : 'aim4price';
  const replacementPriceUsedExVat = userReplacementPriceExVat ?? model.aim4priceReplacementExVat ?? null;
  const defaultMaxLifetimeHours = tractorLifetimeHours(model.tractorType, model.powerKw);
  const advancedAssumptions = normalizeAdvancedAssumptions(input.advancedAssumptions, 'hours');
  const maxLifetimeHours = advancedAssumptions?.maxLifetimeUsage ?? defaultMaxLifetimeHours;
  const conditionFactorOverride = getValuationConditionFactorOverride(input.condition, advancedAssumptions);
  const assumptionOptions = { maxLifetimeHours, conditionFactorOverride };

  const baseCalculation = calculateTractorAim4priceDetails(
    model,
    safeYear,
    safeHours,
    input.condition,
    userReplacementPriceExVat,
    assumptionOptions,
  );
  const baseAim4priceValueExVat = baseCalculation.finalValueExVat;

  const frontPtoReplacementPriceExVat = input.frontPto
    ? getTractorFrontPtoReplacementPrice(toPositiveNumber(input.frontPtoReplacementPriceExVat))
    : null;
  const frontLoaderReplacementPriceExVat = input.frontLoader
    ? getTractorLoaderReplacementPrice(model, toPositiveNumber(input.frontLoaderReplacementPriceExVat))
    : null;
  const gpsReplacementPriceExVat = input.gpsEnabled
    ? getTractorGpsReplacementPrice(input.gpsType, toPositiveNumber(input.gpsReplacementPriceExVat))
    : null;
  const otherExtraName = normalizeText(input.otherExtraName).slice(0, 100) || null;
  const otherExtraValueExVat = otherExtraName ? roundMoney(toPositiveNumber(input.otherExtraValueExVat) ?? 0) : 0;
  const frontPtoValueExVat = calculateTractorFrontPtoValue(
    model,
    safeYear,
    safeHours,
    input.condition,
    Boolean(input.frontPto),
    assumptionOptions,
    frontPtoReplacementPriceExVat,
  );
  const frontLoaderValueExVat = calculateTractorLoaderValue(
    model,
    safeYear,
    Boolean(input.frontLoader),
    frontLoaderReplacementPriceExVat,
  );
  const gpsValueExVat = calculateTractorGpsValue(
    model,
    Boolean(input.gpsEnabled),
    input.gpsType,
    input.gpsYear,
    safeYear,
    gpsReplacementPriceExVat,
  );
  const extrasValueExVat = frontPtoValueExVat + frontLoaderValueExVat + gpsValueExVat + otherExtraValueExVat;

  const aim4priceValueExVat = addExtras(baseAim4priceValueExVat, extrasValueExVat);
  const previewValueExVat = aim4priceValueExVat;
  const previewLabel: Result['previewLabel'] = 'Aim4price Value';

  return {
    model,
    aim4priceValueExVat,
    marketLow: null,
    marketHigh: null,
    marketMid: null,
    marketCount: 0,
    marketSources: [],
    coverageBand: 'red',
    previewValueExVat,
    previewLabel,
    baseAim4priceValueExVat,
    baseMarketLow: null,
    baseMarketHigh: null,
    baseMarketMid: null,
    extrasValueExVat,
    frontPtoValueExVat,
    frontLoaderValueExVat,
    gpsValueExVat,
    frontPtoReplacementPriceExVat,
    frontLoaderReplacementPriceExVat,
    gpsReplacementPriceExVat,
    otherExtraName,
    otherExtraValueExVat,
    replacementPriceBasis,
    replacementPriceUsedExVat,
    userReplacementPriceExVat,
    maxLifetimeHours,
    advancedAssumptions,
    salvagePercent: baseCalculation.salvagePercent,
    salvageValueExVat: baseCalculation.salvageValueExVat,
    isSalvageEstimate: baseCalculation.isSalvageEstimate && extrasValueExVat === 0,
  };
}
