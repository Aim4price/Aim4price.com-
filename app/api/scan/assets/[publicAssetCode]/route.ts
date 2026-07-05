import { NextRequest, NextResponse } from "next/server";
import { safeAssetOwnerError } from "../../../../../lib/asset-owner-resolver";
import { authorizeScanAccess } from "../../../../../lib/scan-auth";
import {
  getScanAssetAccessContext,
  listRecentScanEvents,
  normalizePublicAssetCode,
  type ScanAssetAccessContext,
  type ScanSafeAsset,
} from "../../../../../lib/scan-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    publicAssetCode: string;
  };
};

function buildPreviewAsset(asset: ScanSafeAsset): ScanSafeAsset {
  return {
    ...asset,
    note: "",
    photos: [],
    lastKnownLat: null,
    lastKnownLng: null,
    lastKnownLocationText: "",
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const publicAssetCode = normalizePublicAssetCode(
    context.params?.publicAssetCode,
  );
  const isPreviewRequest = request.nextUrl.searchParams.get("preview") === "1";
  const isFieldManagerHint =
    request.nextUrl.searchParams.get("fieldManager") === "1";

  if (isPreviewRequest) {
    let previewContext: ScanAssetAccessContext | null;

    try {
      previewContext = await getScanAssetAccessContext(publicAssetCode);
    } catch (error) {
      const safe = safeAssetOwnerError(
        error,
        "Could not open this asset safely.",
      );
      return NextResponse.json(
        {
          ok: false,
          error: safe?.error ?? "Asset not found.",
          pinRequired: false,
        },
        { status: safe?.status ?? 404 },
      );
    }

    if (!previewContext || !previewContext.asset.id) {
      return NextResponse.json(
        { ok: false, error: "Asset not found.", pinRequired: false },
        { status: 404 },
      );
    }

    if (previewContext.asset.qrStatus === "deleted") {
      return NextResponse.json(
        {
          ok: false,
          error: "This asset QR code is inactive.",
          pinRequired: false,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      preview: true,
      pinRequired: previewContext.scanPinEnabled,
      asset: buildPreviewAsset(previewContext.asset),
    });
  }

  const access = await authorizeScanAccess(request, publicAssetCode, {
    fieldManagerHint: isFieldManagerHint,
  });

  if (!access.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: access.error,
        pinRequired: access.pinRequired,
      },
      { status: access.status },
    );
  }

  const recentEvents = await listRecentScanEvents(access.asset.id, 8);

  return NextResponse.json({
    ok: true,
    accessMode: access.accessMode,
    fieldManagerDisplayName: access.fieldManagerDisplayName ?? null,
    asset: access.asset,
    recentEvents,
  });
}
