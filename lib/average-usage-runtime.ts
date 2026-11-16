import {getDb} from './db';
import {ensureTrackingTables} from './asset-tracking';
import {refreshAverageUsage} from './average-usage';
import {usageToday} from './average-usage-math';
export async function processAverageUsage() {
  const client = await getDb().connect();
  try {
    await client.query('BEGIN');
    const lock = await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended('average-usage-worker',0)) AS acquired");
    if (!lock.rows[0]?.acquired) { await client.query('ROLLBACK'); return; }
    const rows = (await client.query("SELECT asset_id,owner_id FROM public.asset_tracking_usage WHERE enabled=true AND mode='average' AND last_estimated_date IS DISTINCT FROM $1::date ORDER BY updated_at,asset_id LIMIT 100",[usageToday()])).rows;
    for (const row of rows) {
      await client.query('SAVEPOINT average_asset');
      try { await refreshAverageUsage(client,row.owner_id,row.asset_id); }
      catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT average_asset');
        // Do not starve other assets if a corrupt legacy configuration cannot calculate.
        await client.query('UPDATE public.asset_tracking_usage SET last_estimated_date=$2 WHERE asset_id=$1',[row.asset_id,usageToday()]);
        console.error('Average usage update failed',{assetId:row.asset_id,error});
      }
      await client.query('RELEASE SAVEPOINT average_asset');
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function startAverageUsage() {
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PHASE === 'phase-production-build' || !(process.env.DATABASE_URL || process.env.PGHOST)) return;
  const state = globalThis as typeof globalThis & {aim4priceAverageUsageTimer?: ReturnType<typeof setInterval>};
  if (state.aim4priceAverageUsageTimer) return;
  await ensureTrackingTables();
  let running = false;
  const run = async () => { if (running) return; running=true; try {await processAverageUsage();} catch (e) {console.error('Average usage will retry',e);} finally {running=false;} };
  state.aim4priceAverageUsageTimer=setInterval(run,60000);
  state.aim4priceAverageUsageTimer.unref();
  void run();
}
