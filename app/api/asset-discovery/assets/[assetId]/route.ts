import { businessToolProfile } from '../../../../../lib/business-tool-profile';
import { NextResponse } from "next/server";
import { getAssetDiscoveryAssetDetails } from "../../../../../lib/asset-discovery";
import { getServerSession } from "../../../../../lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { assetId: string } };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession({allowBusinessWorkspace:true,  allowDealerApp: true, allowOwnerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "You must be signed in." }, { status: 401 });
  }
  try {
    const profile = await businessToolProfile(session);
    if (!["owner", "dealer"].includes(profile.accountType)) {
      return NextResponse.json({ ok: false, error: "Asset details are not available." }, { status: 403 });
    }
    const details = await getAssetDiscoveryAssetDetails({
      assetId: context.params.assetId,
      viewerUserId: session.user.id,
      viewerAccountType: profile.accountType as "owner" | "dealer",
    });
    return NextResponse.json({ ok: true, details }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asset details are not available.";
    return NextResponse.json({ ok: false, error: "Asset details are not available." }, {
      status: message.includes("not found") || message.includes("not available") ? 404 : 403,
    });
  }
}
