import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "../../../../../lib/admin-api-access";
import { getAssetRegisterItemById } from "../../../../../lib/asset-register-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  const query = new URL(request.url).searchParams;
  const assetId = query.get("assetId");
  const ownerId = query.get("ownerId");
  if (!ownerId || !assetId || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(assetId)) {
    return NextResponse.json({ error: "Invalid asset." }, { status: 400 });
  }

  const asset = await getAssetRegisterItemById(ownerId, assetId);
  if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  return NextResponse.json({ photos: asset.photos }, { headers: { "Cache-Control": "private, no-store" } });
}
