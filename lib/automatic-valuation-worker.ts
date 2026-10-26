import { LegacyValuationRecoveryError } from './asset-register-valuation-recovery';
import { getDb } from './db';
import { ensureAutomaticValuationSchema } from './automatic-valuation-schema';
import { revalueAssetRegisterItem } from './asset-register-revaluation';

type Job = { asset_id: string; owner_id: string; generation: string; attempts: number; claim_id: string };
export const CLAIM_VALUATION_JOB = `
 WITH due AS (
  SELECT asset_id FROM asset_valuation_jobs
  WHERE attempts < 5 AND next_attempt_at <= now() AND (lease_until IS NULL OR lease_until < now())
  ORDER BY next_attempt_at, asset_id FOR UPDATE SKIP LOCKED LIMIT 1
 )
 UPDATE asset_valuation_jobs j SET attempts=j.attempts+1, claim_id=gen_random_uuid(),
   lease_until=now()+interval '2 minutes'
 FROM due WHERE j.asset_id=due.asset_id RETURNING j.*`;

async function failJob(job: Job, error: unknown) {
  const needsDetails = error instanceof LegacyValuationRecoveryError;
  const client = await getDb().connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    // Use the same asset -> job lock order as the input-change trigger.
    await client.query('SELECT id FROM asset_register_items WHERE id=$1 AND user_id=$2 FOR UPDATE', [job.asset_id, job.owner_id]);
    const updated = await client.query(`UPDATE asset_valuation_jobs SET claim_id=NULL,lease_until=NULL,
      attempts=CASE WHEN $6::boolean THEN 5 ELSE attempts END,
      next_attempt_at=now()+($4::integer * interval '1 second'),last_error=$5,updated_at=now()
      WHERE asset_id=$1 AND owner_id=$2 AND claim_id=$3::uuid RETURNING asset_id`,
    [job.asset_id, job.owner_id, job.claim_id, Math.min(1800, 30 * 2 ** (job.attempts - 1)),
      (error instanceof Error ? error.message : 'Value update failed').slice(0, 500), needsDetails]);
    if (updated.rows.length) {
      await client.query("SELECT set_config('aim4price.valuation_write','status',true)");
      await client.query(`UPDATE asset_register_items SET specs_json=coalesce(specs_json,'{}'::jsonb) ||
        jsonb_build_object('valuationNeedsUpdate',true,'valuation_needs_update',true,'automaticValuationStatus',$3::text)
        WHERE id=$1 AND user_id=$2`, [job.asset_id, job.owner_id, needsDetails ? 'needs_details' : job.attempts >= 5 ? 'failed' : 'retrying']);
    }
    await client.query('COMMIT');
  } catch (failure) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw failure;
  } finally { client.release(discard); }
}

export async function processAutomaticValuations(limit = 5) {
  await ensureAutomaticValuationSchema();
  // A crash on the last permitted attempt must become visible after its lease expires.
  const expired = await getDb().query<Job>(`SELECT * FROM asset_valuation_jobs
    WHERE attempts >= 5 AND claim_id IS NOT NULL AND lease_until < now() LIMIT 5`);
  for (const job of expired.rows) await failJob(job, new Error('Value update interrupted. Please retry.'));
  let processed = 0;
  for (let index = 0; index < Math.min(20, Math.max(1, limit)); index++) {
    const job = (await getDb().query<Job>(CLAIM_VALUATION_JOB)).rows[0];
    if (!job) break;
    try {
      // Always reread current inputs. The atomic save rejects a superseded revision.
      // Its resolved-write trigger removes this job in the same transaction.
      await revalueAssetRegisterItem({ userId: job.owner_id, assetId: job.asset_id });
    } catch (error) {
      await failJob(job, error);
    }
    processed++;
  }
  return { processed };
}
