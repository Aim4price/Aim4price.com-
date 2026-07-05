import { NextRequest, NextResponse } from "next/server";
import { getFieldManagerAssetForOpen } from "../../../../../lib/field-manager";
import { requireActiveFieldManagerSession } from "../../../../../lib/field-manager-session";
import { safeAssetOwnerError } from "../../../../../lib/asset-owner-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    assetId: string;
  };
};

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const access = await requireActiveFieldManagerSession(request);

  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  }

  try {
    const asset = await getFieldManagerAssetForOpen({
      ownerUserId: access.session.ownerUserId,
      managerId: access.session.managerId,
      assetId: String(context.params?.assetId ?? ""),
    });

    if (!asset) {
      return NextResponse.json(
        {
          ok: false,
          error: "This asset is not available to this Field Manager login.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    const safe = safeAssetOwnerError(
      error,
      "This asset is not available to this Field Manager login.",
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          safe?.error ??
          extractErrorMessage(error, "Failed to load Field Manager asset."),
      },
      { status: safe?.status ?? 500 },
    );
  }
}
