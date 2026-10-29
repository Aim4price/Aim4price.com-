import { getDb } from './db';
import type { AssetRegisterItem } from './asset-register-db';
import { realisticSellingAssessment, reportSellingAssessment } from './selling-price';

/** Batch load only assessments belonging to the already authorised asset/owner pairs. */
export async function withRealisticSellingAssessments(assets: AssetRegisterItem[], purpose: 'marketplace' | 'report' = 'marketplace'): Promise<AssetRegisterItem[]> {
  if (!assets.length) return assets;
  let rows;
  try {
    rows = (await getDb().query(`SELECT DISTINCT ON (s.owner_id,s.asset_id) s.owner_id,s.asset_id,s.assessment
      FROM asset_saleability_assessments s
      JOIN unnest($1::text[],$2::uuid[]) AS requested(owner_id,asset_id)
        ON s.owner_id=requested.owner_id AND s.asset_id=requested.asset_id
      ORDER BY s.owner_id,s.asset_id,s.id DESC`, [assets.map(a=>a.userId),assets.map(a=>a.id)])).rows;
  } catch (error) {
    if ((error as {code?:string}).code === '42P01') return assets.map(asset=>({...asset,realisticSellingAssessment:null}));
    throw error;
  }
  const saved = new Map(rows.map(row=>[`${row.owner_id}:${row.asset_id}`,row.assessment]));
  return assets.map(asset=>({...asset,realisticSellingAssessment:(purpose === 'report' ? reportSellingAssessment : realisticSellingAssessment)(asset,saved.get(`${asset.userId}:${asset.id}`))}));
}
