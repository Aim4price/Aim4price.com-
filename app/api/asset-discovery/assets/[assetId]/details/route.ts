import { NextResponse } from "next/server";
import { getAccountProfile } from "../../../../../../lib/account-profile";
import { getAssetDiscoveryAssetDetails } from "../../../../../../lib/asset-discovery";
import { getServerSession } from "../../../../../../lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { assetId: string } };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "You must be signed in." }, { status: 401 });
  }

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    if (!["owner", "dealer", "licensing"].includes(profile.accountType)) {
      return NextResponse.json({ ok: false, error: "Asset details are not available." }, { status: 403 });
    }

    const details = await getAssetDiscoveryAssetDetails({
      assetId: context.params.assetId,
      viewerUserId: session.user.id,
      viewerAccountType: profile.accountType as "owner" | "dealer" | "licensing",
    });
    return NextResponse.json({ ok: true, details }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asset details are not available.";
    const status = message.includes("not found") || message.includes("not available") ? 404 : 403;
    return NextResponse.json({ ok: false, error: "Asset details are not available." }, { status });
  }
}
