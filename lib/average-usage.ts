import type {PoolClient} from 'pg';
import {resolveAssetUsage} from './asset-usage';
import {estimatedAverageUsage, usageToday, validUsageDate, validWorkingDays} from './average-usage-math';

export type AverageUsageInput = {action: 'enable' | 'pause' | 'confirm'; reading?: number; readingDate?: string; dailyUsage?: number; workingDays?: number[]};
export function validateAverageUsage(input: AverageUsageInput, metric: string) {
  if (!['hours','km'].includes(metric)) throw Error('Average usage is only available for hours and kilometres.');
  if (!input || !['enable','pause','confirm'].includes(input.action)) throw Error('Choose a valid action.');
  if (input.action === 'pause') return;
  if (typeof input.reading !== 'number' || !Number.isFinite(input.reading) || input.reading < 0 || Math.round(input.reading * 100) / 100 >= 1e12) throw Error('Enter the actual meter reading.');
  if (!validUsageDate(input.readingDate)) throw Error('Choose a valid reading date, no later than today.');
  if (input.action === 'enable' && (typeof input.dailyUsage !== 'number' || !Number.isFinite(input.dailyUsage) || input.dailyUsage < 0.0001 || input.dailyUsage > (metric === 'hours' ? 24 : 10000) || !validWorkingDays(input.workingDays)))
    throw Error(metric === 'hours' ? 'Enter up to 24 hours per working day and select working days.' : 'Enter up to 10,000 km per working day and select working days.');
}
/** Caller owns the transaction. Lock order is always asset, then configuration. */
export async function configureAverageUsage(client: PoolClient, ownerId: string, assetId: string, input: AverageUsageInput) {
  const asset = (await client.query('SELECT * FROM public.asset_register_items WHERE id=$1 AND user_id=$2 FOR UPDATE', [assetId,ownerId])).rows[0];
  if (!asset) throw Error('Asset unavailable.');
  const metric = resolveAssetUsage({hours:asset.hours, kind:asset.kind, specsJson:asset.specs_json}).metric;
  validateAverageUsage(input, metric);
  const config = (await client.query('SELECT * FROM public.asset_tracking_usage WHERE asset_id=$1 FOR UPDATE',[assetId])).rows[0];
  if (input.action === 'pause') {
    await refreshAverageUsage(client, ownerId, assetId);
    await client.query("SELECT set_config('aim4price.tracking_usage_write','on',true)");
    await client.query("UPDATE public.asset_register_items SET specs_json=jsonb_set(specs_json,'{trackingUsage,enabled}','false'::jsonb) WHERE id=$1 AND user_id=$2 AND specs_json->'trackingUsage'->>'source'='Average usage'",[assetId,ownerId]);
    await client.query("SELECT set_config('aim4price.tracking_usage_write','',true)");
    await client.query("UPDATE public.asset_tracking_usage SET enabled=false,updated_at=now() WHERE asset_id=$1 AND owner_id=$2 AND mode='average'",[assetId,ownerId]);
  } else {
    if (input.action === 'confirm' && (config?.mode !== 'average' || config.owner_id !== ownerId)) throw Error('Average usage has not been set up.');
    const date = `${input.readingDate}T00:00:00+02:00`;
    const enabled = input.action === 'enable' || config?.enabled === true;
    const daily = input.action === 'enable' ? input.dailyUsage : Number(config.daily_usage);
    const days = input.action === 'enable' ? input.workingDays : config.working_days;
    const projected = estimatedAverageUsage(input.reading!,input.readingDate!,daily!,days!);
    if (projected >= 1e12) throw Error('The estimated reading is too large. Check the starting date and daily usage.');
    await client.query(`INSERT INTO public.asset_tracking_usage(asset_id,owner_id,enabled,mode,metric,baseline_value,baseline_at,daily_usage,working_days)
      VALUES($1,$2,$3,'average',$4,$5,$6,$7,$8) ON CONFLICT(asset_id) DO UPDATE SET owner_id=EXCLUDED.owner_id,enabled=EXCLUDED.enabled,mode='average',metric=EXCLUDED.metric,
      baseline_value=EXCLUDED.baseline_value,baseline_at=EXCLUDED.baseline_at,daily_usage=EXCLUDED.daily_usage,working_days=EXCLUDED.working_days,moving_seconds=0,distance_km=0,last_estimated_date=NULL,updated_at=now()`,
      [assetId,ownerId,enabled,metric,input.reading,date,daily,days]);
    await client.query('DELETE FROM public.asset_tracking_usage_buckets WHERE asset_id=$1',[assetId]);
    await writeReading(client,ownerId,assetId,input.reading!,null);
    if (enabled) await refreshAverageUsage(client,ownerId,assetId);
  }
  await client.query(`INSERT INTO public.asset_tracking_usage_events(asset_id,owner_id,action,reading,metric,baseline_value,baseline_at)
    SELECT asset_id,owner_id,$3,baseline_value,metric,baseline_value,baseline_at FROM public.asset_tracking_usage WHERE asset_id=$1 AND owner_id=$2 AND mode='average'`,
    [assetId,ownerId,input.action === 'pause' ? 'Average usage paused' : input.action === 'enable' ? 'Average usage enabled / updated' : 'Actual meter reading confirmed']);
}
async function writeReading(client: PoolClient, owner: string, id: string, value: number, metadata: unknown) {
  await client.query("SELECT set_config('aim4price.tracking_usage_write','on',true)");
  await client.query(`UPDATE public.asset_register_items SET hours=$3,specs_json=(coalesce(specs_json,'{}'::jsonb)-'trackingUsage') ||
    jsonb_build_object('hours',$3::numeric,'usageAmount',$3::numeric,'usage_amount',$3::numeric,'engine_hours',$3::numeric,'km',$3::numeric,'kilometres',$3::numeric,'kilometers',$3::numeric) ||
    CASE WHEN $4::jsonb IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('trackingUsage',$4::jsonb) END,updated_at=now() WHERE id=$1 AND user_id=$2`,[id,owner,value,metadata ? JSON.stringify(metadata) : null]);
  await client.query("SELECT set_config('aim4price.tracking_usage_write','',true)");
}
export async function refreshAverageUsage(client: PoolClient, owner: string, id: string, today = usageToday()) {
  const asset = (await client.query('SELECT * FROM public.asset_register_items WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,owner])).rows[0];
  if (!asset) return;
  const config = (await client.query("SELECT * FROM public.asset_tracking_usage WHERE asset_id=$1 AND owner_id=$2 AND enabled=true AND mode='average' FOR UPDATE",[id,owner])).rows[0];
  if (!config) return;
  const usage = resolveAssetUsage({hours:asset.hours,kind:asset.kind,specsJson:asset.specs_json});
  if (usage.metric !== config.metric || (asset.lifecycle_state && asset.lifecycle_state !== 'active')) {
    await client.query('UPDATE public.asset_tracking_usage SET enabled=false WHERE asset_id=$1',[id]); return;
  }
  const start = usageToday(new Date(config.baseline_at));
  const value = estimatedAverageUsage(Number(config.baseline_value),start,Number(config.daily_usage),config.working_days,today);
  if (!Number.isFinite(value) || value >= 1e12) throw Error('Estimated usage out of range.');
  const metadata = {estimated:value > Number(config.baseline_value), source:'Average usage',enabled:true,metric:config.metric,baselineValue:Number(config.baseline_value),baselineAt:new Date(config.baseline_at).toISOString(),dailyUsage:Number(config.daily_usage),workingDays:config.working_days,estimatedAt:today};
  if (value !== Number(asset.hours) || JSON.stringify(asset.specs_json?.trackingUsage) !== JSON.stringify(metadata)) {
    await client.query("SELECT set_config('aim4price.audit_source','Average usage · estimated reading',true)");
    await writeReading(client,owner,id,value,metadata);
  }
  await client.query('UPDATE public.asset_tracking_usage SET last_estimated_date=$2 WHERE asset_id=$1',[id,today]);
}
