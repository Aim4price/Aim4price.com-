import { NextRequest, NextResponse } from "next/server";
import {
  trackingOwner,
  trackingJson,
} from "../../../../../../lib/asset-tracking-api";
import { ensureTrackingTables } from "../../../../../../lib/asset-tracking";
import { summarizeTracking } from "../../../../../../lib/asset-tracking-math";
import { getDb } from "../../../../../../lib/db";
import { createXlsxWorkbook } from "../../../../../../lib/simple-xlsx";
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
    const valid = (s: string | null) =>
      !!s &&
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s;
    if (
      !valid(from) ||
      !valid(to) ||
      from! > to! ||
      Date.parse(to!) - Date.parse(from!) > 30 * 86400000
    )
      return trackingJson({ error: "Choose up to 31 calendar days." }, 400);
    await ensureTrackingTables();
    const r = await getDb().query(
      `SELECT p.captured_at,p.latitude,p.longitude,p.accuracy,p.session_id FROM public.asset_tracking_points p JOIN public.asset_tracking_devices d ON d.id=p.device_id WHERE d.owner_id=$1 AND d.asset_id=$2 AND p.captured_at >= ($3::date::timestamp AT TIME ZONE 'Africa/Johannesburg') AND p.captured_at < (($4::date+1)::timestamp AT TIME ZONE 'Africa/Johannesburg') ORDER BY p.captured_at LIMIT 50001`,
      [access.ownerId, params.assetId, from, to],
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
    if (request.nextUrl.searchParams.get("format") === "xlsx") {
      const rows: any[][] = [
        ["Aim4price movement report", access.asset.title],
        ["From", from, "To", to],
        ["Distance (km)", report.distanceKm],
        ["Moving minutes", report.movingSeconds / 60],
        ["Stationary minutes", report.stationarySeconds / 60],
        ["Unobserved minutes", report.gapSeconds / 60],
        ["Moving average (km/h)", report.averageMovingKmh],
        ["GPS estimates; movement is not engine or working hours."],
        [],
        ["Captured at (UTC)", "Latitude", "Longitude", "Accuracy (m)"],
        ...points.map((p) => [
          p.capturedAt,
          p.latitude,
          p.longitude,
          p.accuracy,
        ]),
      ];
      return new NextResponse(
        createXlsxWorkbook([{ name: "Movement", rows }]),
        {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition":
              'attachment; filename="aim4price-movement.xlsx"',
            "Cache-Control": "no-store",
          },
        },
      );
    }
    return trackingJson(report);
  } catch {
    return trackingJson({ error: "Could not load movement history." }, 500);
  }
}
