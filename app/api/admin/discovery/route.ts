import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "../../../../lib/admin-api-access";
import { getAdminDiscoveryReport } from "../../../../lib/admin-global-assets";
import type {
  AdminAssetLocationFilter,
  AdminAssetParticipationFilter,
  AdminAssetSort,
} from "../../../../lib/admin-global-assets-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;

  const searchParams = request.nextUrl.searchParams;
  try {
    const report = await getAdminDiscoveryReport({
      search: searchParams.get("search") ?? "",
      ownerUserId: searchParams.get("owner") ?? "",
      province: searchParams.get("province") ?? "",
      sector: searchParams.get("sector") ?? "",
      participation: (searchParams.get("participation") ?? "all") as AdminAssetParticipationFilter,
      location: (searchParams.get("location") ?? "all") as AdminAssetLocationFilter,
      lifecycleState: searchParams.get("lifecycle") ?? "",
      sort: (searchParams.get("sort") ?? "updated") as AdminAssetSort,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 50),
      focusAssetId: searchParams.get("assetId") ?? "",
    });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    console.error("admin discovery GET failed", error);
    return NextResponse.json(
      { ok: false, error: "Admin Discovery could not be loaded." },
      { status: 500 },
    );
  }
}
