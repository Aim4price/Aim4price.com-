import { tractorLifetimeHours } from './valuation/shared';
import { getBasicUsageProfile } from './basic-usage-profiles';
import { getDb } from './db';
import type { AssetRegisterItem } from './asset-register-db';
import { legacyValuationRecoveryReason } from './asset-register-legacy-valuation';

export class LegacyValuationRecoveryError extends Error {}

/** Rebuild Basic inputs from the owner's asset, never from an inaccessible run. */
export async function recoverLegacyValuationInput(userId: string, asset: AssetRegisterItem): Promise<Record<string, unknown> & { id: number }> {
  if (asset.userId !== userId || asset.selectedMethod === 'manual') throw new Error('ASSET_NOT_REVALUEABLE');
  const reason = legacyValuationRecoveryReason({ ...asset, valuationRunId: null });
  if (reason) throw new LegacyValuationRecoveryError(reason);
  const saved = asset.specsJson ?? {};
  const tractor = asset.kind === 'tractor' || asset.equipmentFamilyKey === 'tractors';
  const familyKey = saved.familyKey || saved.family_key || asset.equipmentFamilyKey || (tractor ? 'tractors' : '');
  let sectorKey = saved.sectorKey || saved.sector_key || (tractor ? 'agricultural' : '');
  if (!sectorKey && asset.equipmentFamilyId) {
    const family = await getDb().query(`select s.sector_key from public.equipment_families ef
      join public.sectors s on s.id = ef.sector_id where ef.id = $1 and ef.family_key = $2`, [asset.equipmentFamilyId, familyKey]);
    sectorKey = family.rows[0]?.sector_key;
  }
  if (!sectorKey) throw new LegacyValuationRecoveryError('Add the equipment sector to calculate a Basic estimate.');
  let brandSlug = saved.brandSlug || saved.brand_slug;
  if (!brandSlug) {
    const brands = await getDb().query(`select slug from public.brands
      where lower(trim(name)) = lower(trim($1)) and is_active = true limit 2`, [asset.brandName]);
    if (brands.rows.length !== 1) throw new LegacyValuationRecoveryError('Confirm the asset brand to calculate a Basic estimate.');
    brandSlug = brands.rows[0].slug;
  }
  let lifetime = asset.maxLifetimeHours;
  let metric = saved.usageMetricType || saved.usage_metric_type || (tractor ? 'hours' : asset.kind === 'vehicle' ? 'km' : '');
  try {
    const profile = getBasicUsageProfile(String(sectorKey), String(familyKey));
    metric = profile.primaryMetric;
    if (!lifetime && metric !== 'percent') lifetime = profile.expectedLifetime;
  } catch { /* Older families use the existing saved lifetime or tractor guide. */ }
  if (!lifetime && tractor) lifetime = tractorLifetimeHours(asset.tractorType === 'orchard' ? 'orchard' : 'field', asset.powerKw ?? 75);
  const specs = { ...saved, usageMetricType: metric, basic_recovery: true, sectorKey, familyKey, brandSlug,
    power_kw: asset.powerKw, tractor_type: asset.tractorType,
    basic_specification_level: saved.basic_specification_level || 'standard',
    ...(lifetime ? { max_lifetime_hours: lifetime } : {}),
  };
  return {
    id: 0, user_id: userId, equipment_type: 'equipment', equipment_model_id: null,
    selected_method: asset.selectedMethod, sector_key: sectorKey, family_key: familyKey, brand_slug: brandSlug,
    year_model: asset.yearModel, hours: asset.hours, condition: asset.condition,
    user_replacement_price_ex_vat: asset.replacementPriceExVat, specs_json: specs,
    valuation_payload: { input: {
      year: asset.yearModel, usageAmount: asset.hours, condition: asset.condition,
      lifeWorkedPercent: asset.lifeWorkedPercent, userReplacementPriceExVat: asset.replacementPriceExVat,
      sectorKey, familyKey, brandSlug, typedModelName: asset.typedModelName || asset.modelName,
      specsJson: specs,
      advancedAssumptions: lifetime ? { maxLifetimeUsage: lifetime } : undefined,
    }, output: {} },
  };
}
