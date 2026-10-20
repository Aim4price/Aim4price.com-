import { NextRequest, NextResponse } from "next/server";
import {
  trackingOwner,
  trackingJson,
} from "../../../../../../lib/asset-tracking-api";
import { ensureTrackingTables } from "../../../../../../lib/asset-tracking";
import { summarizeTracking, visibleTrackingPoints } from "../../../../../../lib/asset-tracking-math";
import { getDb } from "../../../../../../lib/db";
import {buildMovementHtml,buildMovementWorkbook} from "../../../../../../lib/asset-movement-report";
import {validTrackingDay,validTrackingSnapshot,validTrackingCapture,TRACKING_HISTORY_DAYS_SQL,DELETE_TRACKING_DAY_SQL,TRACKING_HISTORY_SESSIONS_SQL,DELETE_TRACKING_SESSION_SQL,validTrackingId,validSessionCursor,DELETE_ALL_TRACKING_HISTORY_SQL} from "../../../../../../lib/asset-tracking-history";
import {trackingJourneys} from '../../../../../../lib/asset-tracking-journeys';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: { assetId: string } },
) {
  try {
    const access = await trackingOwner(request, params.assetId);
    if (access instanceof NextResponse) return access;
    const from = request.nextUrl.searchParams.get("from"),
      to = request.nextUrl.searchParams.get("to");
    const snapshotAt=request.nextUrl.searchParams.get('snapshotAt');
    if(snapshotAt && !validTrackingSnapshot(snapshotAt))return trackingJson({error:'Invalid history snapshot.'},400);
    const deviceId=request.nextUrl.searchParams.get('deviceId'),sessionId=request.nextUrl.searchParams.get('sessionId');
    const startAt=request.nextUrl.searchParams.get('startAt'),endAt=request.nextUrl.searchParams.get('endAt');
    if((startAt||endAt)&&(!validTrackingCapture(startAt)||!validTrackingCapture(endAt)||startAt>endAt||!deviceId||!sessionId))return trackingJson({error:'Choose a valid journey.'},400);
    const contextAt=request.nextUrl.searchParams.get('contextAt');
    if(contextAt&&(!validTrackingCapture(contextAt)||!startAt||contextAt>startAt))return trackingJson({error:'Invalid journey context.'},400);
    if(request.nextUrl.searchParams.get('view')==='journeys'){
      if(!validTrackingDay(from)||!validTrackingDay(to)||from>to||Date.parse(to)-Date.parse(from)>30*86400000)return trackingJson({error:'Choose up to 31 calendar days.'},400);
      const snapshot=snapshotAt||new Date().toISOString();
      await ensureTrackingTables();
      const result=await getDb().query(`SELECT p.* FROM public.asset_tracking_points p JOIN public.asset_tracking_devices d ON d.id=p.device_id
        WHERE d.owner_id=$1 AND d.asset_id=$2 AND p.received_at<=$5::timestamptz
        AND p.captured_at>=($3::date::timestamp AT TIME ZONE 'Africa/Johannesburg')
        AND p.captured_at<(($4::date+1)::timestamp AT TIME ZONE 'Africa/Johannesburg')
        ORDER BY p.captured_at,p.sample_id LIMIT 100001`,[access.ownerId,params.assetId,from,to,snapshot]);
      if(result.rows.length>100000)return trackingJson({error:'Too many readings in this period. Choose fewer days to see every journey.'},400);
      const all=trackingJourneys(result.rows.map(p=>({historyDeleted:!!p.history_deleted_at,recoveredByDeviceId:p.recovered_by_device_id||undefined,sampleId:p.sample_id,deviceId:p.device_id,sessionId:p.session_id,capturedAt:new Date(p.captured_at).toISOString(),latitude:Number(p.latitude),longitude:Number(p.longitude),accuracy:Number(p.accuracy)})));
      const before=request.nextUrl.searchParams.get('before');
      const index=before?all.findIndex(e=>e.id===before):-1;
      if(before&&index<0)return trackingJson({error:'History has changed. Refresh before loading more.'},409);
      const items=all.slice(index+1,index+31);
      return trackingJson({items,nextBefore:all.length>index+31?items.at(-1)!.id:null,snapshotAt:snapshot});
    }

    if((deviceId||sessionId)&&(!validTrackingId(deviceId)||!validTrackingId(sessionId)))return trackingJson({error:'Choose a valid recording session.'},400);
    if(request.nextUrl.searchParams.get('view')==='sessions'){
      const before=request.nextUrl.searchParams.get('before');
      if([from,to].some(v=>v&&!validTrackingDay(v)) || (from&&to&&from>to) || (before&&!validSessionCursor(before)))return trackingJson({error:'Choose a valid date range or session.'},400);
      const snapshot=snapshotAt||new Date().toISOString();
      await ensureTrackingTables();
      const result=await getDb().query(TRACKING_HISTORY_SESSIONS_SQL,[access.ownerId,params.assetId,from||null,to||null,before||null,snapshot]);
      const items=result.rows.slice(0,30).map(row=>({id:row.device_id+'-'+row.session_id,deviceId:row.device_id,sessionId:row.session_id,day:row.day,from:row.day,to:row.end_day,firstCapturedAt:new Date(row.first_captured_at).toISOString(),lastCapturedAt:new Date(row.last_captured_at).toISOString(),readings:Number(row.readings)}));
      const last=items.at(-1);
      return trackingJson({items,nextBefore:result.rows.length>30&&last?[last.lastCapturedAt,last.deviceId,last.sessionId].join('|'):null,snapshotAt:snapshot});
    }
    if(request.nextUrl.searchParams.get('view')==='entries'){
      const before=request.nextUrl.searchParams.get('before');
      if([from,to,before].some(v=>v&&!validTrackingDay(v)) || (from&&to&&from>to))return trackingJson({error:'Choose a valid date range.'},400);
      const snapshot=snapshotAt||new Date().toISOString();
      await ensureTrackingTables();
      const result=await getDb().query(TRACKING_HISTORY_DAYS_SQL,[access.ownerId,params.assetId,from||null,to||null,before||null,snapshot]);
      const items=result.rows.slice(0,30).map(row=>({day:row.day,firstCapturedAt:new Date(row.first_captured_at).toISOString(),lastCapturedAt:new Date(row.last_captured_at).toISOString(),readings:Number(row.readings)}));
      return trackingJson({items,nextBefore:result.rows.length>30?items.at(-1)!.day:null,snapshotAt:snapshot});
    }
    if (
      !validTrackingDay(from) ||
      !validTrackingDay(to) ||
      from! > to! ||
      (!sessionId && Date.parse(to!) - Date.parse(from!) > 30 * 86400000)
    )
      return trackingJson({ error: "Choose up to 31 calendar days." }, 400);
    await ensureTrackingTables();
    const r = await getDb().query(
      `SELECT p.history_deleted_at,p.recovered_by_device_id,p.sample_id,p.received_at,p.device_id,p.captured_at,p.latitude,p.longitude,p.accuracy,p.session_id FROM public.asset_tracking_points p JOIN public.asset_tracking_devices d ON d.id=p.device_id WHERE d.owner_id=$1 AND d.asset_id=$2 AND ($8::timestamptz IS NULL OR p.captured_at >= $8::timestamptz) AND ($9::timestamptz IS NULL OR p.captured_at <= $9::timestamptz) AND ($6::uuid IS NULL OR (p.device_id=$6::uuid AND p.session_id=$7::uuid)) AND ($5::timestamptz IS NULL OR p.received_at <= $5::timestamptz) AND p.captured_at >= ($3::date::timestamp AT TIME ZONE 'Africa/Johannesburg') AND p.captured_at < (($4::date+1)::timestamp AT TIME ZONE 'Africa/Johannesburg') ORDER BY p.captured_at LIMIT 50001`,
      [access.ownerId, params.assetId, from, to, snapshotAt, deviceId, sessionId, contextAt||startAt, endAt],
    );
    if (r.rows.length > 50000)
      return trackingJson(
        { error: "Choose a shorter period to view the complete route." },
        400,
      );
    const points = visibleTrackingPoints(r.rows.map((p) => ({
      historyDeleted:!!p.history_deleted_at,
      capturedAt: new Date(p.captured_at).toISOString(),
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      accuracy: Number(p.accuracy),
      sessionId: p.session_id,
      deviceId: p.device_id,
      sampleId: p.sample_id,
      context:!!startAt&&new Date(p.captured_at).toISOString()<startAt,
      recoveredByDeviceId:p.recovered_by_device_id||undefined,
      receivedAt: p.received_at?new Date(p.received_at).toISOString():undefined,
    })));
    const report = summarizeTracking(points);
    const format = request.nextUrl.searchParams.get("format");
    if(format && !['pdf','xlsx'].includes(format)) return trackingJson({error:'Choose PDF or Excel.'},400);
    const options={title:access.asset.title,serial:access.asset.serialNumber||'',assetId:params.assetId,from:from!,to:to!,generatedAt:new Date()};
    if(format==='xlsx') return new NextResponse(buildMovementWorkbook(report,options),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="aim4price-movement-${from}-${to}.xlsx"`,'Cache-Control':'private, no-store'}});
    if(format==='pdf') {
      const {getAssetRegisterReportLogoUrl}=await import('../../../../../../lib/asset-registers');
      const {resolveReportLogoUrlForHtml}=await import('../../../../../../lib/report-logo');
      const logoUrl=await resolveReportLogoUrlForHtml(await getAssetRegisterReportLogoUrl(access.ownerId).catch(()=>''),request.url);
      return new NextResponse(buildMovementHtml(report,{...options,logoUrl}),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
    }
    return trackingJson(report);
  } catch {
    return trackingJson({ error: "Could not load movement history." }, 500);
  }
}

export async function DELETE(request:NextRequest,{params}:{params:{assetId:string}}){
  try{
    const access=await trackingOwner(request,params.assetId);
    if(access instanceof NextResponse)return access;
    const day=request.nextUrl.searchParams.get('day'),snapshotAt=request.nextUrl.searchParams.get('snapshotAt');
    const scope=request.nextUrl.searchParams.get('scope');
    if(scope!==null){
      if(scope!=='all'||!validTrackingSnapshot(snapshotAt)||['day','deviceId','sessionId','from','to','startAt','endAt','contextAt'].some(key=>request.nextUrl.searchParams.has(key)))return trackingJson({error:'Refresh history before deleting all tracking records.'},400);
      await ensureTrackingTables();
      const result=await getDb().query(DELETE_ALL_TRACKING_HISTORY_SQL,[access.ownerId,params.assetId,snapshotAt]);
      return trackingJson({ok:true,deleted:result.rowCount||0});
    }
    const deviceId=request.nextUrl.searchParams.get('deviceId'),sessionId=request.nextUrl.searchParams.get('sessionId');
    const startAt=request.nextUrl.searchParams.get('startAt'),endAt=request.nextUrl.searchParams.get('endAt');
    if((startAt||endAt)&&(!validTrackingCapture(startAt)||!validTrackingCapture(endAt)||startAt>endAt||!deviceId||!sessionId))return trackingJson({error:'Choose a valid journey.'},400);
    if(deviceId||sessionId){
      const from=request.nextUrl.searchParams.get('from'),to=request.nextUrl.searchParams.get('to');
      if(!validTrackingId(deviceId)||!validTrackingId(sessionId)||!validTrackingDay(from)||!validTrackingDay(to)||from>to||!validTrackingSnapshot(snapshotAt))return trackingJson({error:'Choose a valid recording session.'},400);
      await ensureTrackingTables();
      const result=await getDb().query(DELETE_TRACKING_SESSION_SQL.replace('RETURNING p.sample_id','AND ($8::timestamptz IS NULL OR p.captured_at >= $8::timestamptz) AND ($9::timestamptz IS NULL OR p.captured_at <= $9::timestamptz) RETURNING p.sample_id'),[access.ownerId,params.assetId,deviceId,sessionId,from,to,snapshotAt,startAt,endAt]);
      if(!result.rowCount)return trackingJson({error:'This recording session is no longer available. Refresh history.'},404);
      return trackingJson({ok:true});
    }
    if(!validTrackingDay(day)||!validTrackingSnapshot(snapshotAt))return trackingJson({error:'Choose a valid tracking entry.'},400);
    await ensureTrackingTables();
    const result=await getDb().query(DELETE_TRACKING_DAY_SQL,[access.ownerId,params.assetId,day,snapshotAt]);
    if(!result.rowCount)return trackingJson({error:'This tracking entry is no longer available. Refresh history.'},404);
    return trackingJson({ok:true});
  }catch{return trackingJson({error:'Could not delete tracking history.'},500);}
}
