import { NextRequest, NextResponse } from 'next/server';
import { trackingOwner, trackingJson, smallTrackingBody } from '../../../../../../lib/asset-tracking-api';
import { ensureTrackingTables } from '../../../../../../lib/asset-tracking';
import { configureTrackingUsage, trackingUsageStatus } from '../../../../../../lib/asset-tracking-usage';
import { getDb } from '../../../../../../lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = {params: {assetId: string}};
export async function GET(request: NextRequest, {params}: Context) {
  try {
    const access = await trackingOwner(request, params.assetId);
    if (access instanceof NextResponse) return access;
    await ensureTrackingTables();
    const status = await trackingUsageStatus(getDb(), access.ownerId, params.assetId);
    const events = (await getDb().query(`SELECT id,action,reading,metric,created_at FROM public.asset_tracking_usage_events
      WHERE asset_id=$1 AND owner_id=$2 ORDER BY id DESC LIMIT 20`, [params.assetId, access.ownerId])).rows;
    return trackingJson({...status, events});
  } catch { return trackingJson({error: 'Could not load automatic usage.'}, 500); }
}
export async function POST(request: NextRequest, {params}: Context) {
  const access = await trackingOwner(request, params.assetId);
  if (access instanceof NextResponse) return access;
  let body: any;
  try { body = await smallTrackingBody(request); } catch { return trackingJson({error: 'Invalid usage settings.'}, 400); }
  if (!body || !['enable','pause','confirm'].includes(body.action) || typeof body.enabled !== 'boolean' ||
    (body.action === 'enable' && !body.enabled) || (body.action === 'pause' && body.enabled) ||
    (body.action !== 'pause' && (typeof body.reading !== 'number' || !Number.isFinite(body.reading) || body.reading < 0 || body.reading >= 1e12)))
    return trackingJson({error: 'Enter a valid meter reading.'}, 400);
  await ensureTrackingTables();
  const client = await getDb().connect();
  try {
    await client.query('BEGIN');
    await configureTrackingUsage(client, access.ownerId, params.assetId, body);
    const status = await trackingUsageStatus(client, access.ownerId, params.assetId);
    await client.query('COMMIT');
    return trackingJson(status);
  } catch (e) {
    await client.query('ROLLBACK');
    const unsupported = e instanceof Error && e.message === 'USAGE_METRIC_UNSUPPORTED';
    return trackingJson({error: unsupported ? 'Choose hours or kilometres for this asset first.' : 'Could not save usage settings.'}, unsupported ? 400 : 500);
  } finally { client.release(); }
}
