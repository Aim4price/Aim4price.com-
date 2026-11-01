import { withRealisticSellingAssessments } from './realistic-selling-assessments';
import { getDb } from './db';
import { readAnnualReviewAssets } from './asset-register-db';
import { revalueAssetRegisterItem } from './asset-register-revaluation';
import { annualExclusion, reviewYear, priceExVat, type AnnualReviewAsset, type AnnualReviewResult } from './annual-review-policy';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};

/** No register creation, snapshots, notifications, history entries or other writes. */
export async function loadAnnualReview(email: string, requestedYear: unknown, assetId?: string) {
  const year = reviewYear(requestedYear);
  const result = await getDb().query(`select u.id, u.email, u.name from "user" u
    left join account_profiles ap on ap.user_id = u.id
    where lower(trim(u.email)) = lower(trim($1)) and coalesce(ap.account_type, 'owner') = 'owner' limit 2`, [email]);
  if (result.rows.length !== 1) throw new Error('One matching owner account is required.');
  const owner = result.rows[0];
  const assets = await withRealisticSellingAssessments(await readAnnualReviewAssets(owner.id, assetId), 'report');
  const runs = await getDb().query(`select id, created_at, valuation_payload from valuation_runs where user_id = $1 and id = any($2::bigint[])`,
    [owner.id, assets.map(a => a.valuationRunId).filter(Boolean)]);
  const byId = new Map(runs.rows.map(row => [Number(row.id), row]));
  const rows = assets.map(asset => {
    const run = byId.get(Number(asset.valuationRunId));
    const payload = record(run?.valuation_payload), savedInput = record(payload.input), output = record(payload.output);
    const settings = record(record(savedInput.advancedAssumptions ?? output.advancedAssumptions).privateSettings);
    const specs = asset.specsJson;
    let reason = annualExclusion({
      manual: asset.selectedMethod === 'manual', yearModel: asset.yearModel,
      unknownYear: [specs.yearModelUnknown, specs.year_model_unknown, savedInput.yearModelUnknown, savedInput.year_model_unknown].some(value => value === true || value === 1 || value === 'true'),
      fixedAge: settings.ageDepreciationPercent != null || (settings.ageWeightPercent === 0 && specs.valuation_mode !== 'year_condition' && record(output.family).valuationMode !== 'year_condition'),
      lastValuedAt: specs.valuationLastUpdatedAt ?? specs.valuation_last_updated_at ?? run?.created_at,
      year,
    });
    let replacementPrice = asset.replacementPriceExVat;
    const hasExtras = !!(savedInput.frontPto || savedInput.frontLoader || savedInput.gpsEnabled || savedInput.otherExtraName || output.extrasValueExVat);
    let extrasNote = 'Asset replacement price only.';
    let includedExtras = 0;
    const basicSpecs = { ...record(savedInput.specsJson), ...record(output.specsJson), ...specs };
    const basicExtras = Number(basicSpecs.basic_extra_replacement_price_ex_vat) || 0;
    if (basicExtras > 0 || Number(basicSpecs.basic_extra_count) > 0) {
      const base = Number(basicSpecs.basic_asset_replacement_price_ex_vat), total = Number(basicSpecs.basic_total_replacement_price_ex_vat);
      const entries = basicSpecs.basic_extras;
      const validEntries = !Array.isArray(entries) || entries.every(entry => Number(record(entry).replacementPriceExVat) > 0);
      const entriesTotal = Array.isArray(entries) ? entries.reduce((sum: number, entry: Record<string, unknown>) => sum + Number(entry.replacementPriceExVat), 0) : basicExtras;
      if (validEntries && base > 0 && basicExtras > 0 && Math.abs(base + basicExtras - total) <= 1 && Math.abs(entriesTotal - basicExtras) <= 1 && replacementPrice != null && Math.abs(replacementPrice - total) <= 1) {
        replacementPrice = base; includedExtras = basicExtras;
        extrasNote = 'Asset alone. Saved extras are added once to the calculation; their replacement prices stay unchanged.';
      } else {
        reason ??= 'Saved extras need a confirmed asset-only replacement price before annual review.';
        extrasNote = 'Extras basis could not be verified; excluded to prevent double counting.';
      }
    } else if (hasExtras) {
      const base = Number(output.replacementPriceUsedExVat), total = Number(output.totalReplacementPriceUsedExVat);
      // Stored assets have used both base and combined replacement prices. Only
      // subtract extras when the saved total proves the basis; never guess.
      if (base > 0 && total >= base && replacementPrice != null && (Math.abs(replacementPrice - base) <= 1 || Math.abs(replacementPrice - total) <= 1)) {
        replacementPrice = base;
        extrasNote = 'Asset alone. Saved extras are retained separately, once; their replacement prices stay unchanged.';
      } else {
        reason ??= 'Saved extras need a confirmed asset-only replacement price before annual review.';
        extrasNote = 'Extras basis could not be verified; excluded to prevent double counting.';
      }
    }
    if (!(replacementPrice != null && replacementPrice > 0)) reason ??= 'No saved replacement price — kept unchanged.';
    const row: AnnualReviewAsset = { id: asset.id, revision: asset.updatedAtIso, title: asset.title || `${asset.brandName} ${asset.modelName}`,
      currentValue: asset.value, replacementPrice, eligible: !reason, reason,
      saleability: !!asset.realisticSellingAssessment,
      extrasNote };
    return { asset, row, includedExtras };
  });
  return { owner, year, rows };
}

export async function calculateAnnualPreview(email: string, year: unknown, assetId: string, replacement?: number, expectedRevision?: string): Promise<AnnualReviewResult> {
  const data = await loadAnnualReview(email, year, assetId);
  const entry = data.rows.find(entry => entry.asset.id === assetId);
  if (!entry) throw new Error('Asset not found for this owner.');
  const { asset, row } = entry;
  if (expectedRevision && asset.updatedAtIso !== expectedRevision) throw new Error("This asset changed. Reload the owner preview before continuing.");
  if (!row.eligible) throw new Error(row.reason || 'This asset is not eligible.');
  const replacementPrice = replacement === undefined ? row.replacementPrice! : priceExVat(replacement, false);
  try {
    const result = await revalueAssetRegisterItem({ userId: data.owner.id, assetId,
      previewOnly: true, replacementPriceExVat: replacementPrice + entry.includedExtras }, { year: data.year, asset });
    if (!Number.isFinite(result.newValueExVat) || result.newValueExVat < 0) throw new Error('The valuation returned no usable value.');
    return { id: assetId, currentValue: row.currentValue, proposedValue: result.newValueExVat,
      replacementPrice, error: null, warning: result.warning };
  } catch (error) {
    return { id: assetId, currentValue: row.currentValue, proposedValue: null, replacementPrice,
      error: error instanceof Error ? error.message : 'This estimate could not be calculated.' };
  }
}
