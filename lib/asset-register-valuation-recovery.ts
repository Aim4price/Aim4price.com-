import { getDb } from './db';
import type { AssetRegisterItem } from './asset-register-db';
import { legacyValuationRecoveryReason } from './asset-register-legacy-valuation';

export class LegacyValuationRecoveryError extends Error {}

/** Builds an in-memory input, never a database record. Only explicit Save links a new run. */
export async function recoverLegacyValuationInput(userId: string, asset: AssetRegisterItem): Promise<Record<string, unknown> & { id: number }> {
  if (asset.userId !== userId || asset.valuationRunId || asset.selectedMethod === 'manual') throw new Error('ASSET_NOT_REVALUEABLE');
  const reason = legacyValuationRecoveryReason(asset);
  if (reason) throw new LegacyValuationRecoveryError(reason);
  const specs = asset.specsJson ?? {};
  const tractor = asset.kind === 'tractor' || asset.equipmentFamilyKey === 'tractors';
  let modelId = asset.equipmentModelId;
  let replacement = asset.replacementPriceExVat;
  if (tractor) {
    const matches = await getDb().query<{id: number; aim4price_replacement_price_ex_vat: number | string | null}>(`
      select em.id, em.aim4price_replacement_price_ex_vat
      from public.equipment_models em
      join public.equipment_families ef on ef.id = em.equipment_family_id
      left join public.brands b on b.id = em.brand_id
      where ef.family_key = 'tractors' and em.is_active = true
        and coalesce(em.is_generic_fallback, false) = false
        and (($1::bigint is not null and em.id = $1) or ($1::bigint is null
          and lower(trim(b.name)) = lower(trim($2)) and lower(trim(em.model_name)) = lower(trim($3))
          and ($4::numeric is null or em.power_kw = $4)
          and ($5::text = '' or em.tractor_type = $5)
          and ($6::text = '' or em.drive_type = $6)
          and ($7::text = '' or em.cab_type = $7)))
      limit 2
    `, [modelId, asset.brandName, asset.modelName, asset.powerKw, asset.tractorType, asset.drive, asset.cab]);
    if (matches.rows.length !== 1) throw new LegacyValuationRecoveryError('The original estimate history is missing and the saved tractor cannot be matched to one catalogue model. Update its model details before recalculating.');
    modelId = Number(matches.rows[0].id);
    const cataloguePrice = Number(matches.rows[0].aim4price_replacement_price_ex_vat);
    if (replacement === null && cataloguePrice > 0) replacement = cataloguePrice;
  }
  return {
    id: 0, user_id: userId, equipment_type: tractor ? 'tractor' : 'equipment',
    equipment_model_id: modelId, selected_method: asset.selectedMethod,
    sector_key: specs.sectorKey ?? specs.sector_key,
    family_key: asset.equipmentFamilyKey || specs.familyKey || specs.family_key,
    brand_slug: specs.brandSlug ?? specs.brand_slug,
    year_model: asset.yearModel, hours: asset.hours, condition: asset.condition,
    user_replacement_price_ex_vat: replacement, specs_json: specs,
    valuation_payload: { input: {
      ...specs, modelId, year: asset.yearModel, hours: asset.hours, usageAmount: asset.hours,
      condition: asset.condition, lifeWorkedPercent: asset.lifeWorkedPercent,
      userReplacementPriceExVat: replacement,
      sectorKey: specs.sectorKey ?? specs.sector_key,
      familyKey: asset.equipmentFamilyKey || specs.familyKey || specs.family_key,
      brandSlug: specs.brandSlug ?? specs.brand_slug, typedModelName: asset.typedModelName || asset.modelName,
      specsJson: specs,
      advancedAssumptions: asset.maxLifetimeHours ? { maxLifetimeUsage: asset.maxLifetimeHours } : undefined,
    }, output: {} },
  };
}
