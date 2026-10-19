import { NextRequest, NextResponse } from "next/server";
import {
  trackingOwner,
  trackingJson,
} from "../../../../../lib/asset-tracking-api";
import {
  createPairing,
  trackingStatus,
  disconnectTrackingDevice,
} from "../../../../../lib/asset-tracking";
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
    await disconnectTrackingDevice(access.ownerId, params.assetId);
    return trackingJson({ ok: true });
  } catch {
    return trackingJson({ error: "Could not disconnect device." }, 500);
  }
}
