import { getDb } from './db';
import type { EquipmentFamilyRecord } from './equipment-catalog';
import type { SectorKey } from './equipment-types';
import type { BasicCatalogueIdentity } from './basic-catalogue-guide';
import { getBasicUsageProfile } from './basic-usage-profiles';

export const BASIC_CATALOGUE_RELEASE = 'basic_ballpark_20260907_v1';
const INPUT_SHA256 = '1da6093df504e69dca872a043515b962cd6cefc36559bd2a217e510d1e01505c';

// Explicit server-side opt-in. Importing a draft alone cannot change the app.
export function basicCatalogueEnabled(): boolean {
  return process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE === BASIC_CATALOGUE_RELEASE;
}

export async function listBasicCatalogueFamilies(sectorKey: SectorKey | null): Promise<EquipmentFamilyRecord[]> {
  if (!basicCatalogueEnabled()) throw new Error('Basic catalogue is not enabled.');
  const db = getDb();
  const release = await db.query(
    `select 1 from aim4price_basic.releases
     where release_key = $1 and input_sha256 = $2 and state = 'draft'`,
    [BASIC_CATALOGUE_RELEASE, INPUT_SHA256],
  );
  if (!release.rows.length) throw new Error('The reviewed Basic catalogue release is unavailable.');
  const result = await db.query(
    `select f.family_key, f.label, f.group_key, g.label as group_label,
       s.id as sector_id, s.sector_key, s.sector_label,
       p.minimum_ex_vat, p.maximum_ex_vat, p.pricing_as_of::text, p.confidence
     from aim4price_basic.families f
     join aim4price_basic.groups g using (release_key, sector_key, group_key)
     join aim4price_basic.price_bands p using (release_key, sector_key, family_key)
     join public.sectors s on s.sector_key = f.sector_key
     where f.release_key = $1 and ($2::text is null or f.sector_key = $2)
     order by g.label, f.label`,
    [BASIC_CATALOGUE_RELEASE, sectorKey],
  );
  return result.rows.map((row, index) => {
    const usageProfile = getBasicUsageProfile(row.sector_key, row.family_key);
    const basicCatalogue: BasicCatalogueIdentity = {
      releaseKey: BASIC_CATALOGUE_RELEASE,
      familyKey: row.family_key,
      familyLabel: row.label,
      groupKey: row.group_key,
      groupLabel: row.group_label,
      minimumExVat: Number(row.minimum_ex_vat),
      maximumExVat: Number(row.maximum_ex_vat),
      pricingAsOf: row.pricing_as_of,
      confidence: row.confidence,
      usageProfile,
    };
    return {
      // UI record only; never a public.equipment_families foreign key.
      id: 0, sectorId: Number(row.sector_id), sectorKey: row.sector_key,
      sectorLabel: row.sector_label, familyKey: row.family_key, familyLabel: row.label,
      isPropelled: false,
      usageMetricType: usageProfile.primaryMetric === 'percent' ? 'wear_class' : usageProfile.primaryMetric,
      valuationMode: usageProfile.primaryMetric === 'percent' ? 'percent_used' : 'engine_hours',
      catalogMode: 'generic_specs', sortOrder: index, isActive: true, basicCatalogue,
    };
  });
}

export async function getBasicCatalogueFamily(sectorKey: SectorKey, familyKey: string, releaseKey: unknown) {
  if (releaseKey !== BASIC_CATALOGUE_RELEASE) throw new Error('Unknown Basic catalogue release.');
  const families = await listBasicCatalogueFamilies(sectorKey);
  const record = families.find((family) => family.familyKey === familyKey);
  if (!record) throw new Error('Basic catalogue family not found.');
  return record;
}
