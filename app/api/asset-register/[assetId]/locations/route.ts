import {NextRequest,NextResponse} from 'next/server';
import {getServerSession} from '../../../../../lib/auth-session';
import {getAssetRegisterAccountAccess} from '../../../../../lib/asset-register-account-access';
import {getAssetRegisterItemById} from '../../../../../lib/asset-register-db';
import {getDb} from '../../../../../lib/db';
import {ensureLocationHistorySchema,deleteLocationHistoryEntry} from '../../../../../lib/asset-location-history-db';
import {isTrustedRequestOrigin} from '../../../../../lib/trusted-request-origin';
import {businessJson,businessError} from '../../../../../lib/business-network-api';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:{assetId:string}}){
 try {
  const session=await getServerSession({allowDealerApp:true});
  if(!session||!await getAssetRegisterAccountAccess(session))return businessJson({error:'Sign in to view location history.'},403);
  if(!/^[0-9a-f-]{36}$/i.test(params.assetId))return businessJson({error:'Invalid asset.'},400);
  const asset=await getAssetRegisterItemById(session.user.id,params.assetId);
  if(!asset)return businessJson({error:'Asset unavailable.'},404);
  const from=request.nextUrl.searchParams.get('from'),to=request.nextUrl.searchParams.get('to');
  if([from,to].some(d=>d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d))||(from&&to&&from>to))return businessJson({error:'Choose a valid date range.'},400);
  const entryId=request.nextUrl.searchParams.get('entryId');
  if(entryId && (entryId.length>128 || !/^[a-zA-Z0-9_-]+$/.test(entryId)))return businessJson({error:'Invalid location record.'},400);
  const format=request.nextUrl.searchParams.get('format');
  if(format&&!['pdf','xlsx'].includes(format))return businessJson({error:'Choose PDF or Excel.'},400);
  await ensureLocationHistorySchema();
  const result=await getDb().query(`SELECT e.id,e.latitude,e.longitude,e.location_text AS note,e.operator_name AS actor,e.actor_type,e.activity_text,e.note AS event_note,e.gps_accuracy_meters AS accuracy,e.created_at AS recorded_at,e.client_captured_at AS captured_at
   FROM public.asset_scan_events e JOIN public.asset_register_items a ON a.id=e.asset_id
   WHERE a.user_id=$1 AND a.id=$2::uuid AND e.location_history_deleted_at IS NULL AND e.latitude BETWEEN -90 AND 90 AND e.longitude BETWEEN -180 AND 180
   AND ($3::date IS NULL OR e.created_at >= ($3::date::timestamp AT TIME ZONE 'Africa/Johannesburg'))
   AND ($4::date IS NULL OR e.created_at < (($4::date+1)::timestamp AT TIME ZONE 'Africa/Johannesburg'))
   AND ($5::text IS NULL OR e.id::text=$5)
   ORDER BY e.created_at DESC,e.id DESC LIMIT 2001`,[session.user.id,asset.id,from||null,to||null,entryId||null]);
  const items=result.rows.slice(0,2000).map(row=>({id:row.id,latitude:Number(row.latitude),longitude:Number(row.longitude),note:row.note||'',actor:row.actor||'Not recorded',accuracy:row.accuracy===null?null:Number(row.accuracy),recordedAt:row.recorded_at,capturedAt:row.captured_at,source:/manually/i.test(row.activity_text||'')?'Manual pin':/device GPS/i.test(row.event_note||'')?'Device GPS':'Recorded location (source unverified)'}));
  if(entryId&&!items.length)return businessJson({error:'Location record unavailable.'},404);
  const truncated=result.rows.length>2000;
  if(!format)return businessJson({items,truncated});
  if(truncated)return businessJson({error:'Narrow the date range to 2 000 records or fewer for a complete report.'},409);
  const {buildLocationHistoryHtml,buildLocationHistoryWorkbook}=await import('../../../../../lib/asset-location-history-report');
  const options={title:asset.title,serial:asset.serialNumber||'',assetId:asset.id,from,to,generatedAt:new Date()};
  const filename=`aim4price-location-history-${asset.id}`;
  if(format==='xlsx')return new NextResponse(buildLocationHistoryWorkbook(items,options),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${filename}.xlsx"`,'Cache-Control':'no-store'}});
  const {getAssetRegisterReportLogoUrl}=await import('../../../../../lib/asset-registers');
  const {resolveReportLogoUrlForHtml}=await import('../../../../../lib/report-logo');
  const logoUrl=await resolveReportLogoUrlForHtml(await getAssetRegisterReportLogoUrl(session.user.id).catch(()=>''),request.url);
  return new NextResponse(buildLocationHistoryHtml(items,{...options,logoUrl}),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
 }catch(error){return businessError(error);}
}


export async function DELETE(request:NextRequest,{params}:{params:{assetId:string}}){
 try {
  if(!isTrustedRequestOrigin(request.headers.get('origin'),request.nextUrl.origin))return businessJson({error:'Invalid request origin.'},403);
  const session=await getServerSession({allowDealerApp:true});
  if(!session||!await getAssetRegisterAccountAccess(session))return businessJson({error:'Sign in to manage location history.'},403);
  const entryId=request.nextUrl.searchParams.get('entryId');
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!uuid.test(params.assetId)||!entryId||!uuid.test(entryId))return businessJson({error:'Invalid location record.'},400);
  const asset=await getAssetRegisterItemById(session.user.id,params.assetId);
  if(!asset)return businessJson({error:'Asset unavailable.'},404);
  const deleted=await deleteLocationHistoryEntry(session.user.id,asset.id,entryId);
  if(!deleted)return businessJson({error:'Location record unavailable.'},404);
  return businessJson({ok:true});
 }catch(error){return businessError(error);}
}
