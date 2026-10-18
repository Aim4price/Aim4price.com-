import { NextRequest, NextResponse } from "next/server";
import {
  trackingOwner,
  trackingJson,
} from "../../../../../lib/asset-tracking-api";
import {
  createPairing,
  trackingStatus,
  ensureTrackingTables,
} from "../../../../../lib/asset-tracking";
import { getDb } from "../../../../../lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: { assetId: string } };
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const access = await trackingOwner(request, params.assetId);
    if (access instanceof NextResponse) return access;
    return trackingJson({
      assetTitle: access.asset.title,
      device: await trackingStatus(access.ownerId, params.assetId),
    });
  } catch {
    return trackingJson({ error: "Could not load tracking." }, 500);
  }
}
export async function POST(request: NextRequest, { params }: Context) {
  try {
    const access = await trackingOwner(request, params.assetId);
    if (access instanceof NextResponse) return access;
    return trackingJson({
      code: await createPairing(access.ownerId, params.assetId),
      expiresInMinutes: 15,
    });
  } catch {
    return trackingJson({ error: "Could not create pairing code." }, 500);
  }
}
export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const access = await trackingOwner(request, params.assetId);
    if (access instanceof NextResponse) return access;
    await ensureTrackingTables();
    const c = await getDb().connect();
    try {
      await c.query("BEGIN");
      await c.query(
        "SELECT id FROM public.asset_register_items WHERE id=$1 FOR UPDATE",
        [params.assetId],
      );
      await c.query(
        "UPDATE public.asset_tracking_devices SET revoked_at=now(),active=false,pair_hash=NULL WHERE asset_id=$1 AND owner_id=$2 AND revoked_at IS NULL",
        [params.assetId, access.ownerId],
      );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
    return trackingJson({ ok: true });
  } catch {
    return trackingJson({ error: "Could not disconnect device." }, 500);
  }
}
