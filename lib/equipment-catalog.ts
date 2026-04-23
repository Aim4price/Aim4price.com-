import { getDb } from './db';
import type {
  EquipmentFamilyKey,
  SectorKey,
  UsageMetricType,
  ValuationMode,
} from './equipment-types';

export type EquipmentFamilyRecord = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  sectorLabel: string;
  familyKey: EquipmentFamilyKey;
  familyLabel: string;
  isPropelled: boolean;
  usageMetricType: UsageMetricType;
  valuationMode: ValuationMode;
  sortOrder: number;
  isActive: boolean;
};

export type EquipmentBrandRecord = {
  id: number;
  slug: string;
  name: string;
  isActive: boolean;
};

export type EquipmentModelRecord = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  familyId: number;
  familyKey: EquipmentFamilyKey;
  familyLabel: string;
  usageMetricType: UsageMetricType;
  valuationMode: ValuationMode;
  isPropelled: boolean;
  brandId: number | null;
  brandSlug: string;
  brandName: string;
  legacyTractorCatalogId: number | null;
  modelName: string;
  variantName: string | null;
  normalizedModelName: string;
  displayName: string;
  yearStart: number | null;
  yearEnd: number | null;
  powerKw: number | null;
  tractorType: string | null;
  driveType: string | null;
  cabType: string | null;
  workingWidthM: number | null;
  rowsCount: number | null;
  tankCapacityL: number | null;
  aim4priceReplacementPriceExVat: number | null;
  replacementPriceYear: number | null;
  isGenericFallback: boolean;
  specsJson: Record<string, unknown>;
  isActive: boolean;
};

export type EquipmentLinkRecord = {
  brandId: number | null;
  sectorId: number | null;
  equipmentFamilyId: number | null;
  equipmentModelId: number | null;
  legacyTractorCatalogId: number | null;
};

type ListEquipmentModelsInput = {
  sectorKey?: SectorKey | null;
  familyKey?: EquipmentFamilyKey | null;
  brandSlug?: string | null;
  search?: string | null;
  includeInactive?: boolean;
  includeGenericFallback?: boolean;
  limit?: number | null;
};

function toInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', '1', 'yes'].includes(normalized)) return true;
    if (['false', 'f', '0', 'no'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeLimit(value: unknown, fallback: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(maximum, Math.max(1, Math.round(parsed)));
}

export async function listEquipmentFamilies(input?: {
  sectorKey?: SectorKey | null;
  includeInactive?: boolean;
}): Promise<EquipmentFamilyRecord[]> {
  const db = getDb();
  const values: string[] = [];
  const conditions: string[] = [];

  if (input?.sectorKey) {
    values.push(input.sectorKey);
    conditions.push(`s.sector_key = $${values.length}`);
  }

  if (!input?.includeInactive) {
    conditions.push('s.is_active = true');
    conditions.push('ef.is_active = true');
  }

  const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const result = await db.query(
    `
      select
        ef.id,
        ef.sector_id,
        s.sector_key,
        s.sector_label,
        ef.family_key,
        ef.family_label,
        ef.is_propelled,
        ef.usage_metric_type,
        ef.valuation_mode,
        ef.sort_order,
        ef.is_active
      from public.equipment_families ef
      join public.sectors s
        on s.id = ef.sector_id
      ${whereClause}
      order by s.id asc, ef.sort_order asc, ef.family_label asc
    `,
    values,
  );

  return result.rows.map((row) => ({
    id: toInteger(row.id) ?? 0,
    sectorId: toInteger(row.sector_id) ?? 0,
    sectorKey: (toText(row.sector_key) || 'agricultural') as SectorKey,
    sectorLabel: toText(row.sector_label),
    familyKey: (toText(row.family_key) || 'tractors') as EquipmentFamilyKey,
    familyLabel: toText(row.family_label),
    isPropelled: toBoolean(row.is_propelled, true),
    usageMetricType: (toText(row.usage_metric_type) || 'hours') as UsageMetricType,
    valuationMode: (toText(row.valuation_mode) || 'year_condition') as ValuationMode,
    sortOrder: toInteger(row.sort_order) ?? 100,
    isActive: toBoolean(row.is_active, true),
  }));
}

export async function listEquipmentBrands(input?: {
  sectorKey?: SectorKey | null;
  familyKey?: EquipmentFamilyKey | null;
  includeInactive?: boolean;
}): Promise<EquipmentBrandRecord[]> {
  const db = getDb();
  const values: string[] = [];
  const conditions: string[] = ['b.id = em.brand_id', 'coalesce(em.is_generic_fallback, false) = false'];

  if (input?.sectorKey) {
    values.push(input.sectorKey);
    conditions.push(`s.sector_key = $${values.length}`);
  }

  if (input?.familyKey) {
    values.push(input.familyKey);
    conditions.push(`ef.family_key = $${values.length}`);
  }

  if (!input?.includeInactive) {
    conditions.push('b.is_active = true');
    conditions.push('em.is_active = true');
    conditions.push('ef.is_active = true');
    conditions.push('s.is_active = true');
  }

  const result = await db.query(
    `
      select distinct
        b.id,
        b.slug,
        b.name,
        b.is_active
      from public.equipment_models em
      join public.equipment_families ef
        on ef.id = em.equipment_family_id
      join public.sectors s
        on s.id = ef.sector_id
      join public.brands b
        on ${'CONDITIONS'}
      order by b.name asc
    `.replace('CONDITIONS', conditions.join(' and ')),
    values,
  );

  return result.rows.map((row) => ({
    id: toInteger(row.id) ?? 0,
    slug: toText(row.slug),
    name: toText(row.name),
    isActive: toBoolean(row.is_active, true),
  }));
}

export async function listEquipmentModels(input?: ListEquipmentModelsInput): Promise<EquipmentModelRecord[]> {
  const db = getDb();
  const values: Array<string | number> = [];
  const conditions: string[] = [];

  if (input?.sectorKey) {
    values.push(input.sectorKey);
    conditions.push(`s.sector_key = $${values.length}`);
  }

  if (input?.familyKey) {
    values.push(input.familyKey);
    conditions.push(`ef.family_key = $${values.length}`);
  }

  if (input?.brandSlug) {
    values.push(input.brandSlug);
    conditions.push(`b.slug = $${values.length}`);
  }

  if (input?.search && input.search.trim()) {
    values.push(`%${input.search.trim().toLowerCase()}%`);
    const placeholder = `$${values.length}`;
    conditions.push(`(
      lower(em.display_name) like ${placeholder}
      or lower(em.model_name) like ${placeholder}
      or lower(coalesce(em.variant_name, '')) like ${placeholder}
      or lower(coalesce(b.name, '')) like ${placeholder}
    )`);
  }

  if (!input?.includeInactive) {
    conditions.push('em.is_active = true');
    conditions.push('ef.is_active = true');
    conditions.push('s.is_active = true');
    conditions.push('(b.is_active = true or b.id is null)');
  }

  if (!input?.includeGenericFallback) {
    conditions.push('coalesce(em.is_generic_fallback, false) = false');
  }

  const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const limit = normalizeLimit(input?.limit, 200, 500);
  values.push(limit);

  const result = await db.query(
    `
      select
        em.id,
        s.id as sector_id,
        s.sector_key,
        ef.id as family_id,
        ef.family_key,
        ef.family_label,
        ef.usage_metric_type,
        ef.valuation_mode,
        ef.is_propelled,
        em.brand_id,
        b.slug as brand_slug,
        b.name as brand_name,
        em.legacy_tractor_catalog_id,
        em.model_name,
        em.variant_name,
        em.normalized_model_name,
        em.display_name,
        em.year_start,
        em.year_end,
        em.power_kw,
        em.tractor_type,
        em.drive_type,
        em.cab_type,
        em.working_width_m,
        em.rows_count,
        em.tank_capacity_l,
        em.aim4price_replacement_price_ex_vat,
        em.replacement_price_year,
        em.is_generic_fallback,
        em.specs_json,
        em.is_active
      from public.equipment_models em
      join public.equipment_families ef
        on ef.id = em.equipment_family_id
      join public.sectors s
        on s.id = ef.sector_id
      left join public.brands b
        on b.id = em.brand_id
      ${whereClause}
      order by
        coalesce(em.is_generic_fallback, false) asc,
        coalesce(b.name, '') asc,
        em.model_name asc,
        em.id asc
      limit $${values.length}
    `,
    values,
  );

  return result.rows.map((row) => ({
    id: toInteger(row.id) ?? 0,
    sectorId: toInteger(row.sector_id) ?? 0,
    sectorKey: (toText(row.sector_key) || 'agricultural') as SectorKey,
    familyId: toInteger(row.family_id) ?? 0,
    familyKey: (toText(row.family_key) || 'tractors') as EquipmentFamilyKey,
    familyLabel: toText(row.family_label),
    usageMetricType: (toText(row.usage_metric_type) || 'hours') as UsageMetricType,
    valuationMode: (toText(row.valuation_mode) || 'year_condition') as ValuationMode,
    isPropelled: toBoolean(row.is_propelled, true),
    brandId: toInteger(row.brand_id),
    brandSlug: toText(row.brand_slug),
    brandName: toText(row.brand_name),
    legacyTractorCatalogId: toInteger(row.legacy_tractor_catalog_id),
    modelName: toText(row.model_name),
    variantName: toText(row.variant_name) || null,
    normalizedModelName: toText(row.normalized_model_name),
    displayName: toText(row.display_name),
    yearStart: toInteger(row.year_start),
    yearEnd: toInteger(row.year_end),
    powerKw: toInteger(row.power_kw),
    tractorType: toText(row.tractor_type) || null,
    driveType: toText(row.drive_type) || null,
    cabType: toText(row.cab_type) || null,
    workingWidthM: toNumber(row.working_width_m),
    rowsCount: toInteger(row.rows_count),
    tankCapacityL: toInteger(row.tank_capacity_l),
    aim4priceReplacementPriceExVat: toNumber(row.aim4price_replacement_price_ex_vat),
    replacementPriceYear: toInteger(row.replacement_price_year),
    isGenericFallback: toBoolean(row.is_generic_fallback, false),
    specsJson:
      row.specs_json && typeof row.specs_json === 'object' && !Array.isArray(row.specs_json)
        ? (row.specs_json as Record<string, unknown>)
        : {},
    isActive: toBoolean(row.is_active, true),
  }));
}

export async function fetchEquipmentLinkForModelSelection(modelId: string | number): Promise<EquipmentLinkRecord | null> {
  const db = getDb();
  const modelKey = String(modelId).trim();
  if (!modelKey) return null;

  const result = await db.query(
    `
      select
        em.brand_id,
        s.id as sector_id,
        ef.id as equipment_family_id,
        em.id as equipment_model_id,
        em.legacy_tractor_catalog_id
      from public.equipment_models em
      join public.equipment_families ef
        on ef.id = em.equipment_family_id
      join public.sectors s
        on s.id = ef.sector_id
      where em.id::text = $1
         or em.legacy_tractor_catalog_id::text = $1
      order by case when em.id::text = $1 then 0 else 1 end, em.id asc
      limit 1
    `,
    [modelKey],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    brandId: toInteger(row.brand_id),
    sectorId: toInteger(row.sector_id),
    equipmentFamilyId: toInteger(row.equipment_family_id),
    equipmentModelId: toInteger(row.equipment_model_id),
    legacyTractorCatalogId: toInteger(row.legacy_tractor_catalog_id),
  };
}

// Backward-compatible export name used by older code paths.
export const fetchEquipmentLinkForLegacyTractorCatalogId = fetchEquipmentLinkForModelSelection;
