import { NextRequest, NextResponse } from "next/server";
import {
  trackingOwner,
  trackingJson,
} from "../../../../../../lib/asset-tracking-api";
import { ensureTrackingTables } from "../../../../../../lib/asset-tracking";
import { summarizeTracking } from "../../../../../../lib/asset-tracking-math";
import { getDb } from "../../../../../../lib/db";
import {buildMovementHtml,buildMovementWorkbook} from "../../../../../../lib/asset-movement-report";
import {validTrackingDay,validTrackingSnapshot,TRACKING_HISTORY_DAYS_SQL,DELETE_TRACKING_DAY_SQL} from "../../../../../../lib/asset-tracking-history";
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
      Date.parse(to!) - Date.parse(from!) > 30 * 86400000
    )
      return trackingJson({ error: "Choose up to 31 calendar days." }, 400);
    await ensureTrackingTables();
    const r = await getDb().query(
      `SELECT p.captured_at,p.latitude,p.longitude,p.accuracy,p.session_id FROM public.asset_tracking_points p JOIN public.asset_tracking_devices d ON d.id=p.device_id WHERE d.owner_id=$1 AND d.asset_id=$2 AND p.history_deleted_at IS NULL AND ($5::timestamptz IS NULL OR p.received_at <= $5::timestamptz) AND p.captured_at >= ($3::date::timestamp AT TIME ZONE 'Africa/Johannesburg') AND p.captured_at < (($4::date+1)::timestamp AT TIME ZONE 'Africa/Johannesburg') ORDER BY p.captured_at LIMIT 50001`,
      [access.ownerId, params.assetId, from, to, snapshotAt],
    );
    if (r.rows.length > 50000)
      return trackingJson(
        { error: "Choose a shorter period to view the complete route." },
        400,
      );
    const points = r.rows.map((p) => ({
      capturedAt: new Date(p.captured_at).toISOString(),
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      accuracy: Number(p.accuracy),
      sessionId: p.session_id,
    }));
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
    if(!validTrackingDay(day)||!validTrackingSnapshot(snapshotAt))return trackingJson({error:'Choose a valid tracking entry.'},400);
    await ensureTrackingTables();
    const result=await getDb().query(DELETE_TRACKING_DAY_SQL,[access.ownerId,params.assetId,day,snapshotAt]);
    if(!result.rowCount)return trackingJson({error:'This tracking entry is no longer available. Refresh history.'},404);
    return trackingJson({ok:true});
  }catch{return trackingJson({error:'Could not delete tracking history.'},500);}
}
