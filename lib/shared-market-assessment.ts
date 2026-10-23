import { getDb } from './db';
import { saleabilityBasis } from './asset-saleability';
import type { AssetRegisterItem } from './asset-register-db';

/** Only this summary may leave the owner's account. Answers and basis stay private. */
export type SharedMarketAssessment = {
  priceExVat: number;
  assessedAt: string;
  needsReview: boolean;
};

export async function sharedMarketAssessments(ownerId: string, assets: AssetRegisterItem[], valuationShared: boolean): Promise<Record<string, SharedMarketAssessment>> {
  if (!valuationShared || !assets.length) return {};
  let rows;
  try {
    rows = (await getDb().query(`SELECT DISTINCT ON (s.asset_id) s.asset_id, s.assessment
      FROM asset_saleability_assessments s
      JOIN asset_register_items a ON a.id = s.asset_id AND a.user_id = s.owner_id
      WHERE s.owner_id = $1 AND s.asset_id = ANY($2::uuid[])
      ORDER BY s.asset_id, s.id DESC`, [ownerId, assets.map(asset => asset.id)])).rows;
  } catch (error) {
    // Older installations have no assessment table until the first owner assessment.
    if ((error as {code?: string}).code === '42P01') return {};
    throw error;
  }
  const summaries: Record<string, SharedMarketAssessment> = {};
  for (const row of rows) {
    const asset = assets.find(item => item.id === row.asset_id);
    const saved = row.assessment;
    if (!asset || !saved || typeof saved.priceExVat !== 'number' || !Number.isFinite(saved.priceExVat) || saved.priceExVat < 0 || typeof saved.assessedAt !== 'string' || !Number.isFinite(Date.parse(saved.assessedAt))) continue;
    summaries[asset.id] = { priceExVat: saved.priceExVat, assessedAt: saved.assessedAt, needsReview: saved.basis !== saleabilityBasis(asset) };
  }
  return summaries;
}
