import type { PoolClient } from 'pg';
import { resolveAssetUsage } from './asset-usage';
import { summarizeTracking, type TrackingPoint } from './asset-tracking-math';

export const TRACKING_USAGE_BUCKET_MS = 1800000;
const BUCKET = TRACKING_USAGE_BUCKET_MS;
const iso = (value: Date | string) => new Date(value).toISOString();

/** Clip observed movement to a half-hour bucket. Neighbouring buckets share context, not usage. */
export function trackingUsageBucket(points: TrackingPoint[], day: number, baseline: number) {
  const start = Math.max(day, baseline), end = day + BUCKET;
  let movingSeconds = 0, distanceKm = 0;
  for (const interval of summarizeTracking(points).movementIntervals) {
    const from = Date.parse(interval.from), to = Date.parse(interval.to);
    const overlap = Math.max(0, Math.min(to, end) - Math.max(from, start));
    if (!overlap || to <= from) continue;
    movingSeconds += overlap / 1000;
    distanceKm += interval.distanceKm * overlap / (to - from);
  }
  return { movingSeconds, distanceKm };
}

export async function trackingUsageStatus(client: Pick<PoolClient, 'query'>, ownerId: string, assetId: string) {
  const row = (await client.query(`SELECT a.hours,a.kind,a.specs_json,c.enabled,c.metric,c.baseline_value,c.baseline_at,
   (SELECT last_tracked_at FROM public.asset_tracking_usage_buckets WHERE asset_id=a.id AND last_tracked_at IS NOT NULL ORDER BY bucket_start DESC LIMIT 1) AS last_tracked_at
   FROM public.asset_register_items a LEFT JOIN public.asset_tracking_usage c ON c.asset_id=a.id AND c.owner_id=a.user_id
   WHERE a.id=$1 AND a.user_id=$2`, [assetId, ownerId])).rows[0];
  if (!row) throw Error('ASSET_UNAVAILABLE');
  const usage = resolveAssetUsage({hours: row.hours, kind: row.kind, specsJson: row.specs_json});
  const estimated = usage.estimated === true;
  return {enabled: row.enabled === true && row.metric === usage.metric, metric: usage.metric, reading: usage.value, estimated,
    baselineValue: row.metric !== usage.metric || row.baseline_value == null ? null : Number(row.baseline_value),
    baselineAt: row.metric === usage.metric && row.baseline_at ? iso(row.baseline_at) : null,
    lastTrackedAt: row.last_tracked_at ? iso(row.last_tracked_at) : null};
}

/** Caller holds the asset lock before any device lock. Recalculate only affected half-hour buckets. */
export async function refreshTrackingUsage(client: PoolClient, ownerId: string, assetId: string, capturedAt: string[]) {
  if (!capturedAt.length) return;
  const config = (await client.query(`SELECT * FROM public.asset_tracking_usage WHERE asset_id=$1 AND owner_id=$2 AND enabled=true FOR UPDATE`, [assetId, ownerId])).rows[0];
  if (!config) return;
  const baseline = new Date(config.baseline_at).getTime();
  const asset = (await client.query('SELECT hours,kind,specs_json FROM public.asset_register_items WHERE id=$1 AND user_id=$2', [assetId, ownerId])).rows[0];
  const usage = resolveAssetUsage({hours: asset.hours, kind: asset.kind, specsJson: asset.specs_json});
  if (usage.metric !== config.metric) {
    await client.query('UPDATE public.asset_tracking_usage SET enabled=false WHERE asset_id=$1', [assetId]);
    return;
  }
  const days = new Set<number>();
  for (const stamp of capturedAt) {
    const time = Date.parse(stamp);
    if (time < baseline) continue;
    const day = Math.floor(time / BUCKET) * BUCKET;
    // A late fix near midnight can change movement classification on either side.
    days.add(day);
    if (time - day < 180000 && day > baseline) days.add(day - BUCKET);
    if (day + BUCKET - time <= 180000 && day + BUCKET <= Date.now()) days.add(day + BUCKET);
  }
  if (!days.size) return;
  let deltaSeconds = 0, deltaKm = 0;
  for (const day of days) {
    const rows = (await client.query(`SELECT p.*,d.paired_at,d.revoked_at FROM public.asset_tracking_points p
     JOIN public.asset_tracking_devices d ON d.id=p.device_id
     WHERE d.asset_id=$1 AND d.owner_id=$2 AND p.captured_at >= $3 AND p.captured_at < $4
     AND p.captured_at >= d.paired_at AND (d.revoked_at IS NULL OR p.captured_at <= d.revoked_at)
     ORDER BY p.captured_at,p.sample_id`, [assetId, ownerId, new Date(Math.max(baseline, day - 180000)), new Date(day + BUCKET + 180000)])).rows;
    // Removed routes remain evidence for usage; deletion is a presentation action.
    const points: TrackingPoint[] = rows.map(r => ({capturedAt: iso(r.captured_at), latitude: r.latitude,
      longitude: r.longitude, accuracy: r.accuracy, sessionId: r.session_id, deviceId: r.device_id}));
    const total = trackingUsageBucket(points, day, baseline);
    const last = points.filter(p => Date.parse(p.capturedAt) >= day && Date.parse(p.capturedAt) < day + BUCKET && p.accuracy <= 50).at(-1);
    const previous = (await client.query('SELECT moving_seconds,distance_km FROM public.asset_tracking_usage_buckets WHERE asset_id=$1 AND bucket_start=$2', [assetId, new Date(day)])).rows[0];
    deltaSeconds += total.movingSeconds - Number(previous?.moving_seconds || 0);
    deltaKm += total.distanceKm - Number(previous?.distance_km || 0);
    await client.query(`INSERT INTO public.asset_tracking_usage_buckets(asset_id,bucket_start,moving_seconds,distance_km,last_tracked_at)
     VALUES($1,$2,$3,$4,$5) ON CONFLICT(asset_id,bucket_start) DO UPDATE SET moving_seconds=EXCLUDED.moving_seconds,
     distance_km=EXCLUDED.distance_km,last_tracked_at=EXCLUDED.last_tracked_at`,
    [assetId, new Date(day), total.movingSeconds, total.distanceKm, last?.capturedAt || null]);
  }
  const sum = (await client.query(`UPDATE public.asset_tracking_usage SET moving_seconds=greatest(0,moving_seconds+$2),
    distance_km=greatest(0,distance_km+$3) WHERE asset_id=$1 RETURNING moving_seconds AS seconds,distance_km AS km`, [assetId, deltaSeconds, deltaKm])).rows[0];
  sum.last = (await client.query(`SELECT last_tracked_at FROM public.asset_tracking_usage_buckets WHERE asset_id=$1 AND last_tracked_at IS NOT NULL ORDER BY bucket_start DESC LIMIT 1`, [assetId])).rows[0]?.last_tracked_at;
  const addition = config.metric === 'hours' ? Number(sum.seconds) / 3600 : Number(sum.km);
  const value = Math.round((Number(config.baseline_value) + addition) * 100) / 100;
  if (value === Number(asset.hours) && asset.specs_json?.trackingUsage?.estimated === (addition > 0)) return;
  if (value >= 1e12) throw Error('USAGE_OUT_OF_RANGE');
  const metadata = {estimated: addition > 0, source: 'Aim4price Tracker', metric: config.metric,
    baselineValue: Number(config.baseline_value), baselineAt: iso(config.baseline_at), lastTrackedAt: sum.last ? iso(sum.last) : null};
  await client.query("SELECT set_config('aim4price.tracking_usage_write','on',true),set_config('aim4price.audit_source','Aim4price Tracker · estimated usage',true)");
  await client.query(`UPDATE public.asset_register_items SET hours=$3,specs_json=coalesce(specs_json,'{}'::jsonb) ||
    jsonb_build_object('trackingUsage',$4::jsonb,'hours',$3::numeric,'usageAmount',$3::numeric,'usage_amount',$3::numeric,'engine_hours',$3::numeric,'km',$3::numeric,'kilometres',$3::numeric,'kilometers',$3::numeric),updated_at=now()
    WHERE id=$1 AND user_id=$2`, [assetId, ownerId, value, JSON.stringify(metadata)]);
  await client.query("SELECT set_config('aim4price.tracking_usage_write','',true)");
}

/** Owner-only action; transaction and ownership are checked again under the row lock. */
export async function configureTrackingUsage(client: PoolClient, ownerId: string, assetId: string,
  input: {enabled: boolean; reading?: number; action: 'enable' | 'pause' | 'confirm'}) {
  const asset = (await client.query('SELECT * FROM public.asset_register_items WHERE id=$1 AND user_id=$2 FOR UPDATE', [assetId, ownerId])).rows[0];
  if (!asset) throw Error('ASSET_UNAVAILABLE');
  if (input.action === 'pause') {
    await client.query('UPDATE public.asset_tracking_usage SET enabled=false,updated_at=now() WHERE asset_id=$1 AND owner_id=$2', [assetId, ownerId]);
    await client.query(`INSERT INTO public.asset_tracking_usage_events(asset_id,owner_id,action,reading,metric,baseline_value,baseline_at)
     SELECT asset_id,owner_id,'Automatic updates paused',$3,metric,baseline_value,baseline_at FROM public.asset_tracking_usage WHERE asset_id=$1 AND owner_id=$2`, [assetId, ownerId, asset.hours]);
    return;
  }
  const usage = resolveAssetUsage({hours: asset.hours, kind: asset.kind, specsJson: asset.specs_json});
  if (!['hours','km'].includes(usage.metric)) throw Error('USAGE_METRIC_UNSUPPORTED');
  if (typeof input.reading !== 'number' || !Number.isFinite(input.reading) || input.reading < 0 || input.reading >= 1e12) throw Error('INVALID_READING');
  const reading = Math.round(input.reading * 100) / 100;
  if (reading >= 1e12) throw Error('INVALID_READING');
  await client.query(`INSERT INTO public.asset_tracking_usage_events(asset_id,owner_id,action,reading,metric,baseline_value,baseline_at)
   VALUES($1,$2,$3,$4,$5,$4,now())`, [assetId, ownerId, input.action === 'enable' ? 'Automatic updates enabled' : 'Meter reading confirmed', reading, usage.metric]);
  await client.query(`INSERT INTO public.asset_tracking_usage(asset_id,owner_id,enabled,metric,baseline_value,baseline_at)
   VALUES($1,$2,$3,$4,$5,now()) ON CONFLICT(asset_id) DO UPDATE SET owner_id=EXCLUDED.owner_id,enabled=EXCLUDED.enabled,
   metric=EXCLUDED.metric,baseline_value=EXCLUDED.baseline_value,baseline_at=EXCLUDED.baseline_at,moving_seconds=0,distance_km=0,updated_at=now()`,
  [assetId, ownerId, input.enabled, usage.metric, reading]);
  await client.query('DELETE FROM public.asset_tracking_usage_buckets WHERE asset_id=$1', [assetId]);
  await client.query("SELECT set_config('aim4price.tracking_usage_write','on',true),set_config('aim4price.audit_source','Tracking · confirmed meter reading',true)");
  await client.query(`UPDATE public.asset_register_items SET hours=$3,specs_json=(coalesce(specs_json,'{}'::jsonb)-'trackingUsage') ||
   jsonb_build_object('hours',$3::numeric,'usageAmount',$3::numeric,'usage_amount',$3::numeric,'engine_hours',$3::numeric,'km',$3::numeric,'kilometres',$3::numeric,'kilometers',$3::numeric),updated_at=now() WHERE id=$1 AND user_id=$2`, [assetId, ownerId, reading]);
  await client.query("SELECT set_config('aim4price.tracking_usage_write','',true)");
}
