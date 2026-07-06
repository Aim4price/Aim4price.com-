import { NextRequest, NextResponse } from "next/server";
import { safeAssetOwnerError } from "../../../../../lib/asset-owner-resolver";
import {
  authorizeFieldManagerScanAccess,
  authorizePublicQrScanAccess,
} from "../../../../../lib/scan-auth";
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

function normalizedQrStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase() || "active";
}

function isActiveQrStatus(value: unknown): boolean {
  return normalizedQrStatus(value) === "active";
}

function buildPreviewAsset(asset: ScanSafeAsset): ScanSafeAsset {
  return {
    ...asset,
    id: "",
    userId: "",
    serialNumber: "",
    licenseRegistrationNumber: "",
    financeStatus: "unknown",
    insuranceStatus: "unknown",
    licenseStatus: "unknown",
    hours: null,
    lifeWorkedPercent: null,
    fuelPercent: null,
    condition: "",
    note: "",
    photos: [],
    lastKnownLat: null,
    lastKnownLng: null,
    lastKnownLocationText: "",
    lastScannedAtIso: null,
    createdAtIso: null,
    updatedAtIso: null,
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const publicAssetCode = normalizePublicAssetCode(
    context.params?.publicAssetCode,
  );
  const isPreviewRequest = request.nextUrl.searchParams.get("preview") === "1";
  const isFieldManagerHint =
    request.nextUrl.searchParams.get("fieldManager") === "1";
  const fieldManagerAssetId = request.nextUrl.searchParams.get("assetId");

  if (isPreviewRequest) {
    let previewContext: ScanAssetAccessContext | null;

    try {
      previewContext = await getScanAssetAccessContext(publicAssetCode);
    } catch (error) {
      const safe = safeAssetOwnerError(
        error,
        "Could not load this asset preview.",
      );
      console.warn("[scan-assets] Public QR preview skipped", {
        publicAssetCode,
        status: safe?.status ?? null,
        error: safe?.error ?? "Asset preview unavailable.",
      });
      return NextResponse.json({
        ok: false,
        preview: true,
        error: "Asset preview unavailable.",
        pinRequired: true,
      });
    }

    if (!previewContext || !previewContext.asset.id) {
      return NextResponse.json({
        ok: false,
        preview: true,
        error: "Asset preview unavailable.",
        pinRequired: true,
      });
    }

    if (!isActiveQrStatus(previewContext.asset.qrStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error: "This QR code is inactive.",
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

  const access = isFieldManagerHint
    ? await authorizeFieldManagerScanAccess(
        request,
        publicAssetCode,
        fieldManagerAssetId,
      )
    : await authorizePublicQrScanAccess(request, publicAssetCode);

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
