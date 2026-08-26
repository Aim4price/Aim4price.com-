import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "../../../../lib/admin-api-access";
import { getAdminDiscoveryReport } from "../../../../lib/admin-global-assets";
import type {
  AdminAssetInterestFilter,
  AdminAssetLocationFilter,
  AdminAssetParticipationFilter,
  AdminAssetSort,
} from "../../../../lib/admin-global-assets-shared";
import { getAdminDiscoveryViewDetails } from "../../../../lib/discovery-views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;

  const searchParams = request.nextUrl.searchParams;
  const viewAssetId = (searchParams.get("viewAssetId") ?? "").trim();
  if (viewAssetId) {
    try {
      const details = await getAdminDiscoveryViewDetails({
        assetId: viewAssetId,
        page: Number(searchParams.get("viewPage") ?? 1),
        pageSize: Number(searchParams.get("viewPageSize") ?? 100),
      });
      return NextResponse.json(
        { ok: true, details },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "ADMIN_DISCOVERY_VIEW_REFERENCE_INVALID") {
        return NextResponse.json(
          { ok: false, error: "The Discovery asset reference is invalid." },
          { status: 400 },
        );
      }
      console.error("admin Discovery viewer summary failed", error);
      return NextResponse.json(
        { ok: false, error: "Discovery viewer activity could not be loaded." },
        { status: 500 },
      );
    }
  }

  try {
    const report = await getAdminDiscoveryReport({
      search: searchParams.get("search") ?? "",
      ownerUserId: searchParams.get("owner") ?? "",
      province: searchParams.get("province") ?? "",
      sector: searchParams.get("sector") ?? "",
      participation: (searchParams.get("participation") ?? "all") as AdminAssetParticipationFilter,
      location: (searchParams.get("location") ?? "all") as AdminAssetLocationFilter,
      interest: (searchParams.get("interest") ?? "all") as AdminAssetInterestFilter,
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
