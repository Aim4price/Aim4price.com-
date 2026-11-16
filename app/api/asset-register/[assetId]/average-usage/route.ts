import {NextRequest,NextResponse} from 'next/server';
import {trackingOwner,trackingJson,smallTrackingBody} from '../../../../../lib/asset-tracking-api';
import {ensureTrackingTables} from '../../../../../lib/asset-tracking';
import {trackingUsageStatus} from '../../../../../lib/asset-tracking-usage';
import {configureAverageUsage,refreshAverageUsage} from '../../../../../lib/average-usage';
import {getDb} from '../../../../../lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:{assetId:string}};
async function handle(request:NextRequest,{params}:Context) {
  const access=await trackingOwner(request,params.assetId);
  if(access instanceof NextResponse)return access;
  await ensureTrackingTables();
  const client=await getDb().connect();
  try {
    const input=request.method==='POST'?await smallTrackingBody(request):null;
    await client.query('BEGIN');
    await client.query("SELECT set_config('aim4price.audit_actor',$1,true),set_config('aim4price.audit_source','Advanced settings · average usage',true)",[access.ownerId]);
    if(input)await configureAverageUsage(client,access.ownerId,params.assetId,input);
    else await refreshAverageUsage(client,access.ownerId,params.assetId);
    const status=await trackingUsageStatus(client,access.ownerId,params.assetId);
    const events=(await client.query('SELECT id,action,reading,metric,created_at FROM public.asset_tracking_usage_events WHERE asset_id=$1 AND owner_id=$2 ORDER BY id DESC LIMIT 20',[params.assetId,access.ownerId])).rows;
    await client.query('COMMIT');
    return trackingJson({...status,yearModel:access.asset.yearModel,events});
  } catch(error) {
    await client.query('ROLLBACK');
    console.error('Average usage request failed',error);
    return trackingJson({error:request.method==='POST'&&error instanceof Error&&!('code' in error)?error.message:'Could not load average usage. Please try again.'},request.method==='POST'?400:500);
  } finally {client.release();}
}
export const GET=handle;
export const POST=handle;
