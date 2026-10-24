import 'server-only';
import { getDb } from '../db';
import type { SaleabilityAsset } from '../asset-saleability';
import type { SaleabilityRefinementAnswers } from '../saleability';
import { assessSaleability } from './saleability';

// The asset already exists. Never report the whole save as failed (which could
// create a duplicate on retry) if its optional market assessment cannot be saved.
export async function saveValuationSaleability(
  ownerId: string,
  actorId: string,
  asset: SaleabilityAsset & { id: string; updatedAtIso: string },
  answers: SaleabilityRefinementAnswers | undefined,
): Promise<string | undefined> {
  if (!answers) return;
  try {
    const assessment = assessSaleability(asset, answers);
    const db = getDb();
    await db.query(`CREATE TABLE IF NOT EXISTS asset_saleability_assessments (id bigserial PRIMARY KEY, owner_id text NOT NULL, asset_id uuid NOT NULL REFERENCES asset_register_items(id) ON DELETE CASCADE, actor_id text NOT NULL, assessment jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
    await db.query(`CREATE INDEX IF NOT EXISTS asset_saleability_owner_asset ON asset_saleability_assessments(owner_id,asset_id,id DESC)`);
    const saved = await db.query(
      `INSERT INTO asset_saleability_assessments(owner_id,asset_id,actor_id,assessment)
       SELECT $1,a.id,$3,$4::jsonb FROM asset_register_items a
       WHERE a.user_id=$1 AND a.id=$2::uuid AND date_trunc('milliseconds',a.updated_at)=$5::timestamptz RETURNING id`,
      [ownerId, asset.id, actorId, JSON.stringify(assessment), asset.updatedAtIso],
    );
    if (!saved.rowCount) throw new Error('Asset changed while saving its market assessment.');
  } catch (error) {
    console.error('Saved valuation market assessment failed', error);
    return 'Your asset was saved with its Ideal Price, but its Realistic Market Price could not be saved. Open the asset and calculate it there.';
  }
}
