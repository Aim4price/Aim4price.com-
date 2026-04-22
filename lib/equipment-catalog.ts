import { getDb } from './db';
import type { EquipmentFamilyKey, SectorKey, UsageMetricType } from './equipment-types';

type EquipmentLinkRecord = {
  brandId: number | null;
  sectorId: number | null;
  equipmentFamilyId: number | null;
  equipmentModelId: number | null;
  legacyTractorCatalogId: number | null;
};

function toInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export async function listEquipmentFamilies(input?: { sectorKey?: SectorKey | null; includeInactive?: boolean }) {
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
  const result = await db.query(`
    select ef.id, ef.sector_id, s.sector_key, s.sector_label, ef.family_key, ef.family_label, ef.is_propelled, ef.usage_metric_type, ef.sort_order, ef.is_active
    from public.equipment_families ef
    join public.sectors s on s.id = ef.sector_id
    ${whereClause}
    order by s.sector_key asc, ef.sort_order asc, ef.family_label asc
  `, values);
  return result.rows.map((row) => ({
    id: toInteger(row.id) ?? 0,
    sectorId: toInteger(row.sector_id) ?? 0,
    sectorKey: (toText(row.sector_key) || 'agricultural') as SectorKey,
    sectorLabel: toText(row.sector_label),
    familyKey: (toText(row.family_key) || 'tractors') as EquipmentFamilyKey,
    familyLabel: toText(row.family_label),
    isPropelled: toBoolean(row.is_propelled, true),
    usageMetricType: (toText(row.usage_metric_type) || 'hours') as UsageMetricType,
    sortOrder: toInteger(row.sort_order) ?? 100,
    isActive: toBoolean(row.is_active, true),
  }));
}

export async function listEquipmentBrands(input?: { sectorKey?: SectorKey | null; familyKey?: EquipmentFamilyKey | null; includeInactive?: boolean }) {
  const db = getDb();
  const values: string[] = [];
  const conditions: string[] = ['b.id = em.brand_id'];
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
  const result = await db.query(`
    select distinct b.id, b.slug, b.name, b.is_active
    from public.equipment_models em
    join public.equipment_families ef on ef.id = em.equipment_family_id
    join public.sectors s on s.id = ef.sector_id
    join public.brands b on ${'CONDITIONS'}
    order by b.name asc
  `.replace('CONDITIONS', conditions.join(' and ')), values);
  return result.rows.map((row) => ({
    id: toInteger(row.id) ?? 0,
    slug: toText(row.slug),
    name: toText(row.name),
    isActive: toBoolean(row.is_active, true),
  }));
}

export async function listEquipmentModels(input?: { sectorKey?: SectorKey | null; familyKey?: EquipmentFamilyKey | null; brandSlug?: string | null; search?: string | null; includeInactive?: boolean; limit?: number | null }) {
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
    conditions.push(`(lower(em.display_name) like ${placeholder} or lower(em.model_name) like ${placeholder} or lower(coalesce(em.variant_name, '')) like ${placeholder} or lower(coalesce(b.name, '')) like ${placeholder})`);
  }
  if (!input?.includeInactive) {
    conditions.push('em.is_active = true');
    conditions.push('ef.is_active = true');
    conditions.push('s.is_active = true');
    conditions.push('(b.is_active = true or b.id is null)');
  }
  const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const limit = Math.max(1, Math.min(500, Math.round(Number(input?.limit) || 200)));
  values.push(limit);
  const result = await db.query(`
    select em.id, s.id as sector_id, s.sector_key, ef.id as family_id, ef.family_key, ef.family_label, ef.usage_metric_type, ef.is_propelled, em.brand_id, b.slug as brand_slug, b.name as brand_name, em.legacy_tractor_catalog_id, em.model_name, em.variant_name, em.normalized_model_name, em.display_name, em.year_start, em.year_end, em.power_kw, em.tractor_type, em.drive_type, em.cab_type, em.working_width_m, em.rows_count, em.tank_capacity_l, em.specs_json, em.is_active
    from public.equipment_models em
    join public.equipment_families ef on ef.id = em.equipment_family_id
    join public.sectors s on s.id = ef.sector_id
    left join public.brands b on b.id = em.brand_id
    ${whereClause}
    order by coalesce(b.name, '') asc, em.model_name asc, em.id asc
    limit $${values.length}
  `, values);
  return result.rows.map((row) => ({
    id: toInteger(row.id) ?? 0,
    sectorId: toInteger(row.sector_id) ?? 0,
    sectorKey: (toText(row.sector_key) || 'agricultural') as SectorKey,
    familyId: toInteger(row.family_id) ?? 0,
    familyKey: (toText(row.family_key) || 'tractors') as EquipmentFamilyKey,
    familyLabel: toText(row.family_label),
    usageMetricType: (toText(row.usage_metric_type) || 'hours') as UsageMetricType,
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
    workingWidthM: row.working_width_m === null || row.working_width_m === undefined ? null : Number(row.working_width_m),
    rowsCount: toInteger(row.rows_count),
    tankCapacityL: toInteger(row.tank_capacity_l),
    specsJson: row.specs_json && typeof row.specs_json === 'object' && !Array.isArray(row.specs_json) ? row.specs_json : {},
    isActive: toBoolean(row.is_active, true),
  }));
}

export async function fetchEquipmentLinkForLegacyTractorCatalogId(legacyTractorCatalogId: string | number): Promise<EquipmentLinkRecord | null> {
  const db = getDb();
  const result = await db.query(`
    select em.brand_id, s.id as sector_id, ef.id as equipment_family_id, em.id as equipment_model_id, em.legacy_tractor_catalog_id
    from public.equipment_models em
    join public.equipment_families ef on ef.id = em.equipment_family_id
    join public.sectors s on s.id = ef.sector_id
    where em.legacy_tractor_catalog_id::text = $1
    limit 1
  `, [String(legacyTractorCatalogId)]);
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
