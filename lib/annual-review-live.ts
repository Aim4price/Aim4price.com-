import { getDb } from './db';
import { prepareAssetRegisterRevaluation } from './asset-register-db';
import { loadAnnualReview } from './annual-review-preview';
import { annualPercentage, liveReviewYear, percentagePrice } from './annual-review-policy';
import { revalueAssetRegisterItem } from './asset-register-revaluation';

export function requireAnnualYear(requested?: unknown) {
  const year = liveReviewYear();
  if (!year) throw new Error('Annual reviews open on 1 January 2027.');
  if (requested !== undefined && requested !== year) throw new Error('The review year changed. Reload your review.');
  return year;
}
export async function annualReceipt(userId: string, year: number) {
  const result = await getDb().query('SELECT review_year, completed_at, adjustment_percent, kept_unchanged, asset_count FROM annual_asset_reviews WHERE user_id=$1 AND review_year=$2', [userId, year]);
  return result.rows[0] ?? null;
}
export type AnnualConfirmation = {
  year: number; keepUnchanged: boolean; percent: number;
  assets: { id: string; revision: string; proposedValue: number; replacementPrice: number }[];
};
/** Serialise reviews per account, lock the assets, and commit every valuation and receipt together. */
export async function applyAnnualReview(userId: string, input: AnnualConfirmation) {
  const year = requireAnnualYear(input.year);
  if (typeof input.keepUnchanged !== 'boolean') throw new Error('Choose whether to adjust prices.');
  const percent = annualPercentage(input.percent);
  if (!Array.isArray(input.assets) || input.assets.length > 10000) throw new Error('Reload your review before saving.');
  await prepareAssetRegisterRevaluation();
  const tx = await getDb().connect();
  let discard = false;
  try {
    await tx.query('BEGIN');
    await tx.query("SET LOCAL lock_timeout = '10s'");
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`annual-review:${userId}`]);
    const receipt = await tx.query('SELECT review_year FROM annual_asset_reviews WHERE user_id=$1 AND review_year=$2', [userId, year]);
    if (receipt.rows.length) { await tx.query('COMMIT'); return { completed: true, alreadyCompleted: true, year }; }
    await tx.query('SELECT id FROM asset_register_items WHERE user_id=$1 ORDER BY id FOR UPDATE', [userId]);
    const data = await loadAnnualReview('', year, undefined, userId);
    const eligible = data.rows.filter(entry => entry.row.eligible);
    const submitted = new Map(input.assets.map(asset => [asset?.id, asset]));
    if (submitted.size !== input.assets.length || submitted.size !== eligible.length || eligible.some(({ row }) => submitted.get(row.id)?.revision !== row.revision)) {
      throw new Error('Your assets changed. Reload the review before saving.');
    }
    const changes = [];
    if (!input.keepUnchanged) {
      if (!eligible.length) throw new Error('No eligible assets remain. Reload your review.');
      for (const { row, includedExtras } of eligible) {
        const expected = submitted.get(row.id)!;
        const price = percentagePrice(row.replacementPrice!, percent);
        if (!Number.isFinite(expected.proposedValue) || expected.replacementPrice !== price) throw new Error('Reload the review to confirm the latest totals.');
        const result = await revalueAssetRegisterItem({ userId, assetId: row.id, transaction: tx, annualYear: year,
          replacementPriceExVat: price + includedExtras, saveReplacementPrice: true });
        if (!Number.isFinite(result.newValueExVat) || Math.abs(result.newValueExVat - expected.proposedValue) > 0.01) {
          throw new Error('Valuation rules changed. Reload the review to confirm the latest totals.');
        }
        changes.push({ assetId: row.id, oldValue: row.currentValue, newValue: result.newValueExVat,
          oldReplacementPrice: row.replacementPrice, replacementPrice: price, valuationRunId: result.valuationRunId });
      }
    }
    // Do not let a review begun on 31 December apply to the previous year after midnight.
    requireAnnualYear(year);
    await tx.query(`INSERT INTO annual_asset_reviews (user_id, review_year, adjustment_percent, kept_unchanged, asset_count, changes)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb)`, [userId, year, input.keepUnchanged ? 0 : percent, input.keepUnchanged, eligible.length, JSON.stringify(changes)]);
    await tx.query('COMMIT');
    return { completed: true, alreadyCompleted: false, year };
  } catch (error) {
    try { await tx.query('ROLLBACK'); } catch { discard = true; }
    throw error;
  } finally { tx.release(discard); }
}
