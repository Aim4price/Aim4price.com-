/** Daily history uses South African capture dates; uploads keep their original identity. */
export type TrackingHistoryEntry = {
  day: string;
  firstCapturedAt: string;
  lastCapturedAt: string;
  readings: number;
};
export type TrackingHistoryPage = {items: TrackingHistoryEntry[]; nextBefore: string | null; snapshotAt: string};
export const validTrackingDay = (value: string | null): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export const validTrackingSnapshot = (value: string | null): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= Date.now();
export const TRACKING_HISTORY_DAYS_SQL = `
 SELECT to_char(p.captured_at AT TIME ZONE 'Africa/Johannesburg','YYYY-MM-DD') AS day,
 min(p.captured_at) AS first_captured_at,max(p.captured_at) AS last_captured_at,count(*)::integer AS readings
 FROM public.asset_tracking_points p JOIN public.asset_tracking_devices d ON d.id=p.device_id
 WHERE d.owner_id=$1 AND d.asset_id=$2 AND p.history_deleted_at IS NULL AND p.accuracy<=50
 AND ($3::date IS NULL OR p.captured_at >= ($3::date::timestamp AT TIME ZONE 'Africa/Johannesburg'))
 AND ($4::date IS NULL OR p.captured_at < (($4::date+1)::timestamp AT TIME ZONE 'Africa/Johannesburg'))
 AND ($5::date IS NULL OR p.captured_at < ($5::date::timestamp AT TIME ZONE 'Africa/Johannesburg'))
 AND p.received_at <= $6::timestamptz
 GROUP BY 1 ORDER BY 1 DESC LIMIT 31`;
// Soft deletion leaves upload deduplication and the current map position intact.
// The snapshot excludes points uploaded after the user loaded this entry.
export const DELETE_TRACKING_DAY_SQL = `
 UPDATE public.asset_tracking_points p SET history_deleted_at=now()
 FROM public.asset_tracking_devices d
 WHERE d.id=p.device_id AND d.owner_id=$1 AND d.asset_id=$2 AND p.history_deleted_at IS NULL
 AND p.captured_at >= ($3::date::timestamp AT TIME ZONE 'Africa/Johannesburg')
 AND p.captured_at < (($3::date+1)::timestamp AT TIME ZONE 'Africa/Johannesburg')
 AND p.received_at <= $4::timestamptz RETURNING p.sample_id`;
