import { NextRequest, NextResponse } from "next/server";
import {
  getAssetMaintenanceRecordById,
  isAssetMaintenanceRecordId,
} from "../../../../../../lib/asset-maintenance";
import { getFieldManagerAssetForOpen } from "../../../../../../lib/field-manager";
import {
  clearFieldManagerScanCookie,
  requireActiveFieldManagerSession,
} from "../../../../../../lib/field-manager-session";
import { safeAssetOwnerError } from "../../../../../../lib/asset-owner-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    assetId: string;
  };
};

type OpenAssetRequest = {
  maintenanceId?: unknown;
  overviewItemId?: unknown;
  sourceId?: unknown;
  sourceType?: unknown;
  itemType?: unknown;
  fromOverview?: unknown;
  overviewRange?: unknown;
  range?: unknown;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = asText(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function normalizeOverviewRange(value: unknown): "week" | "upcoming" {
  return asText(value).toLowerCase() === "week" ? "week" : "upcoming";
}

function maintenanceIdFromOpenRequest(body: OpenAssetRequest): string {
  const explicitId = asText(body.maintenanceId);
  if (explicitId) return explicitId;

  const overviewItemId = asText(body.overviewItemId);
  if (overviewItemId.toLowerCase().startsWith("maintenance:")) {
    return overviewItemId.slice("maintenance:".length).trim();
  }

  const sourceType = asText(body.sourceType ?? body.itemType).toLowerCase();
  return sourceType === "service" || sourceType === "checkup"
    ? asText(body.sourceId)
    : "";
}

function requestCameFromOverview(request: NextRequest, body: OpenAssetRequest): boolean {
  if (asBoolean(body.fromOverview) || asText(body.overviewItemId)) return true;

  try {
    const referer = request.headers.get("referer");
    return referer ? new URL(referer).pathname === "/field-manager/overview" : false;
  } catch {
    return false;
  }
}

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireActiveFieldManagerSession(request);

  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  }

  try {
    let body: OpenAssetRequest = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as OpenAssetRequest;
      }
    } catch {
      // Existing Manage opens do not send a request body.
    }

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

    const maintenanceId = maintenanceIdFromOpenRequest(body);
    const overviewSourceId = asText(body.sourceId);
    const fromOverview = requestCameFromOverview(request, body);
    const overviewRange = normalizeOverviewRange(body.overviewRange ?? body.range);
    const query = new URLSearchParams({ assetId: asset.id });

    if (maintenanceId) {
      if (!isAssetMaintenanceRecordId(maintenanceId)) {
        return NextResponse.json(
          { ok: false, error: "This scheduled maintenance item is invalid." },
          { status: 400 },
        );
      }

      if (overviewSourceId && overviewSourceId !== maintenanceId) {
        return NextResponse.json(
          { ok: false, error: "This scheduled maintenance item has changed." },
          { status: 409 },
        );
      }

      const maintenance = await getAssetMaintenanceRecordById(
        access.session.ownerUserId,
        maintenanceId,
      );

      if (
        !maintenance
        || maintenance.assetId !== asset.id
        || maintenance.status !== "upcoming"
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "This scheduled maintenance item is no longer available for this asset.",
          },
          { status: 409 },
        );
      }

      query.set("scheduledMaintenanceId", maintenance.id);
      query.set("scheduledMaintenanceType", maintenance.maintenanceType);
    }

    if (fromOverview) {
      query.set("from", "overview");
      query.set("overviewRange", overviewRange);
    }

    const redirectTo = `/field-manager/assets/${encodeURIComponent(asset.publicAssetCode)}?${query.toString()}`;
    const response = NextResponse.json({ ok: true, redirectTo });

    // Field Manager Manage mode is authorized from the main Field Manager
    // session cookie plus the selected assetId. Do not mint a separate
    // scan-cookie authority for opening the shared mobile update UI.
    clearFieldManagerScanCookie(response);

    return response;
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
          extractErrorMessage(
            error,
            "Failed to open Field Manager asset update.",
          ),
      },
      { status: safe?.status ?? 500 },
    );
  }
}
