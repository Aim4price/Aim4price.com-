import { NextResponse } from "next/server";
import { getAccountProfile } from "../../../../../../../lib/account-profile";
import { getAssetDiscoveryPhoto } from "../../../../../../../lib/asset-discovery";
import { getServerSession } from "../../../../../../../lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { assetId: string; photoIndex: string } };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
  if (!session?.user?.id) return new NextResponse("Not found", { status: 404 });

  const photoIndex = Number(context.params.photoIndex);
  if (!Number.isInteger(photoIndex) || photoIndex < 0 || photoIndex > 11) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    if (!["owner", "dealer", "licensing"].includes(profile.accountType)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const photo = await getAssetDiscoveryPhoto({
      assetId: context.params.assetId,
      photoIndex,
      viewerUserId: session.user.id,
      viewerAccountType: profile.accountType as "owner" | "dealer" | "licensing",
    });
    return new NextResponse(photo.data, {
      status: 200,
      headers: {
        "Content-Type": photo.contentType,
        "Content-Length": String(photo.data.length),
        "Content-Disposition": `inline; filename="${encodeURIComponent(photo.fileName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (
      error instanceof Error
      && error.message === "Discovery photo temporarily unavailable."
    ) {
      return new NextResponse("Photo temporarily unavailable", {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store",
          "Retry-After": "60",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
}
