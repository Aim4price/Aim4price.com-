import { NextRequest, NextResponse } from "next/server";
import {
  recordAdminUsageEventsSafely,
  type AdminUsageEventInput,
} from "../../../../../../lib/admin-usage-events";
import {
  assetMaintenanceProcedureKindFromNote,
  assetMaintenanceProcedureMatchesType,
  completeAssetMaintenanceRecord,
  getAssetMaintenanceRecordById,
  getAssetMaintenanceRecordBySourceScanEventId,
  isAssetMaintenanceRecordId,
  listAssetMaintenanceRecords,
  recordStandaloneAssetMaintenanceCompletion,
  type AssetMaintenanceRecord,
} from "../../../../../../lib/asset-maintenance";
import { authorizeFieldManagerScanAccess, authorizeOwnerAppScanAccess, authorizePublicQrScanAccess } from "../../../../../../lib/scan-auth";
import {
  listRecentScanEvents,
  normalizePublicAssetCode,
  saveScanAssetEvent,
} from "../../../../../../lib/scan-assets";
import { MAX_ASSET_REGISTER_PHOTOS } from "../../../../../../lib/asset-register-uploads";
import { safeAssetOwnerError } from "../../../../../../lib/asset-owner-resolver";
import { fieldManagerCan } from "../../../../../../lib/field-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    publicAssetCode: string;
  };
};

type ScanEventRequest = {
  hours?: unknown;
  lifeWorkedPercent?: unknown;
  note?: unknown;
  operatorName?: unknown;
  photoUrls?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  clientEventId?: unknown;
  clientCapturedAt?: unknown;
  gpsAccuracyMeters?: unknown;
  scheduledMaintenanceId?: unknown;
  maintenanceDecision?: unknown;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalMaintenanceId(value: unknown): string {
  const normalized = asText(value);
  return /^(?:null|undefined)$/i.test(normalized) ? "" : normalized;
}

function hasSubmittedValue(value: unknown): boolean {
  return !(value === null || typeof value === "undefined" || value === "");
}

function normalizeHours(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "")
    return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function normalizeCoordinates(
  value: unknown,
  maxAbsolute: number,
): number | null {
  if (value === null || typeof value === "undefined" || value === "")
    return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > maxAbsolute) return null;
  return parsed;
}

function normalizeClientEventId(value: unknown): string | null {
  const normalized = asText(value)
    .replace(/[^a-zA-Z0-9:._-]/g, "")
    .slice(0, 140);
  return normalized || null;
}

function normalizeClientCapturedAt(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeGpsAccuracyMeters(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "")
    return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 50000) return null;
  return Math.round(parsed * 100) / 100;
}


function safeUnexpectedErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error && error.message.trim() ? error.message : fallback;

  if (/missing FROM-clause|syntax error|relation .* does not exist|column .* does not exist|SQLSTATE|Postgres|PostgreSQL/i.test(message)) {
    console.error("[scan-event] Unexpected database error", { error: message });
    return fallback;
  }

  return message;
}

function normalizePhotoUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  return value
    .map((entry) => asText(entry))
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    })
    .slice(0, MAX_ASSET_REGISTER_PHOTOS);
}

function hasMeaningfulUpdate(body: {
  hours: number | null;
  lifeWorkedPercent: number | null;
  note: string;
  photoUrls: string[];
}): boolean {
  return Boolean(
    body.hours !== null ||
    body.lifeWorkedPercent !== null ||
    body.note ||
    body.photoUrls.length,
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const publicAssetCode = normalizePublicAssetCode(
    context.params?.publicAssetCode,
  );
  const isFieldManagerHint =
    request.nextUrl.searchParams.get("fieldManager") === "1";
  const isOwnerAppHint = request.nextUrl.searchParams.get("ownerApp") === "1";
  const requestedAssetId = request.nextUrl.searchParams.get("assetId");

  const access = isOwnerAppHint
    ? await authorizeOwnerAppScanAccess(request, publicAssetCode, requestedAssetId)
    : isFieldManagerHint
    ? await authorizeFieldManagerScanAccess(
        request,
        publicAssetCode,
        requestedAssetId,
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

  if (access.accessMode === 'field_manager' && (!access.fieldManagerId || !(await fieldManagerCan(access.fieldManagerId, 'record_work')))) {
    return NextResponse.json({ ok: false, error: 'This Field Manager login cannot record checks, services or repairs.' }, { status: 403 });
  }

  let body: ScanEventRequest;
  try {
    body = (await request.json()) as ScanEventRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Enter a valid scan update." },
      { status: 400 },
    );
  }

  const triedLifeWorkedPercentUpdate = hasSubmittedValue(
    body.lifeWorkedPercent,
  );

  const operatorName = access.accessMode === "field_manager"
    ? asText(access.fieldManagerDisplayName) || "Field Manager"
    : access.accessMode === "owner_session"
      ? asText(access.ownerAppDisplayName) || "Owner"
      : asText(body.operatorName);

  const payload = {
    hours: normalizeHours(body.hours),
    lifeWorkedPercent: null,
    note: asText(body.note),
    operatorName: operatorName.slice(0, 80),
    photoUrls: normalizePhotoUrls(body.photoUrls),
    latitude: normalizeCoordinates(body.latitude, 90),
    longitude: normalizeCoordinates(body.longitude, 180),
    clientEventId: normalizeClientEventId(body.clientEventId),
    clientCapturedAt: normalizeClientCapturedAt(body.clientCapturedAt),
    gpsAccuracyMeters: normalizeGpsAccuracyMeters(body.gpsAccuracyMeters),
  };

  if (access.accessMode === "scan_pin" && payload.operatorName.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Enter the name of the person updating this asset." },
      { status: 400 },
    );
  }

  if (triedLifeWorkedPercentUpdate && !hasMeaningfulUpdate(payload)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The QR scanner cannot update percentage worked. Update percentage worked from the main Aim4price asset workflow.",
      },
      { status: 400 },
    );
  }

  if (!hasMeaningfulUpdate(payload)) {
    return NextResponse.json(
      { ok: false, error: "Add at least one QR update before saving." },
      { status: 400 },
    );
  }

  if (payload.latitude === null || payload.longitude === null) {
    return NextResponse.json(
      {
        ok: false,
        error: "Location is required. Allow GPS access to save this QR update.",
      },
      { status: 400 },
    );
  }

  const scheduledMaintenanceId = normalizeOptionalMaintenanceId(
    body.scheduledMaintenanceId,
  );
  const maintenanceDecision = body.maintenanceDecision === "separate"
    ? "separate"
    : body.maintenanceDecision === "scheduled"
      ? "scheduled"
      : "";
  const procedureKind = assetMaintenanceProcedureKindFromNote(payload.note);
  let scheduledMaintenance: AssetMaintenanceRecord | null = null;

  if (
    procedureKind
    && (access.asset.usageMode === "hours" || access.asset.usageMode === "km")
    && payload.hours === null
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: access.asset.usageMode === "km"
          ? "Enter the current kilometre reading before saving maintenance."
          : "Enter the current hour-meter reading before saving maintenance.",
      },
      { status: 400 },
    );
  }

  if (maintenanceDecision === "scheduled" && !scheduledMaintenanceId) {
    return NextResponse.json(
      { ok: false, error: "Choose the scheduled maintenance item to complete." },
      { status: 400 },
    );
  }

  if (scheduledMaintenanceId) {
    if (!isAssetMaintenanceRecordId(scheduledMaintenanceId)) {
      return NextResponse.json(
        { ok: false, error: "Scheduled maintenance id is invalid." },
        { status: 400 },
      );
    }

    if (
      (access.accessMode !== "field_manager" && access.accessMode !== "owner_session")
      || !access.asset.id
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Owner or Field Manager access is required to complete scheduled maintenance.",
        },
        { status: 403 },
      );
    }

    try {
      scheduledMaintenance = await getAssetMaintenanceRecordById(
        access.ownerUserId,
        scheduledMaintenanceId,
      );
    } catch (error) {
      console.error("[scan-event] Failed to validate scheduled maintenance", {
        scheduledMaintenanceId,
        assetId: access.asset.id,
        accessMode: access.accessMode,
        error,
      });
      return NextResponse.json(
        { ok: false, error: "Scheduled maintenance could not be validated." },
        { status: 500 },
      );
    }

    if (
      !scheduledMaintenance
      || scheduledMaintenance.assetId !== access.asset.id
      || scheduledMaintenance.status === "cancelled"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "This scheduled maintenance item is no longer available for this asset.",
        },
        { status: 409 },
      );
    }

    if (
      !procedureKind
      || !assetMaintenanceProcedureMatchesType(
        scheduledMaintenance.maintenanceType,
        procedureKind,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            scheduledMaintenance.maintenanceType === "checkup"
              ? "Complete the scheduled check before marking this checkup done."
              : "Complete the scheduled service before marking this service done.",
        },
        { status: 400 },
      );
    }
  }

  if (
    !scheduledMaintenanceId
    && maintenanceDecision !== "separate"
    && procedureKind
    && access.asset.id
    && (access.accessMode === "field_manager" || access.accessMode === "owner_session")
  ) {
    const maintenanceType = procedureKind === "checked" ? "checkup" : "service";

    try {
      const openMaintenance = await listAssetMaintenanceRecords(
        access.ownerUserId,
        {
          assetId: access.asset.id,
          type: maintenanceType,
          status: "upcoming",
        },
      );
      scheduledMaintenance = openMaintenance.find(
        (record) =>
          record.assetId === access.asset.id
          && record.status === "upcoming"
          && assetMaintenanceProcedureMatchesType(
            record.maintenanceType,
            procedureKind,
          ),
      ) ?? null;
    } catch (error) {
      console.error("[scan-event] Failed to match asset maintenance", {
        assetId: access.asset.id,
        maintenanceType,
        accessMode: access.accessMode,
        error,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Maintenance could not be matched to this asset. Please retry.",
        },
        { status: 500 },
      );
    }
  }

  const locationText = `GPS ${payload.latitude.toFixed(6)}, ${payload.longitude.toFixed(6)}`;

  try {
    const saved = await saveScanAssetEvent({
      publicAssetCode,
      assetId: access.asset.id,
      actorType: access.accessMode,
      operatorName: payload.operatorName,
      ownerUserId: access.ownerUserId,
      hours: payload.hours,
      lifeWorkedPercent: payload.lifeWorkedPercent,
      condition: null,
      note: payload.note || null,
      photoUrls: payload.photoUrls,
      latitude: payload.latitude,
      longitude: payload.longitude,
      locationText,
      clientEventId: payload.clientEventId,
      clientCapturedAt: payload.clientCapturedAt,
      gpsAccuracyMeters: payload.gpsAccuracyMeters,
      fieldManagerId: access.fieldManagerId ?? null,
      fieldManagerDisplayName: access.fieldManagerDisplayName ?? null,
      fieldManagerSessionId: access.fieldManagerSessionId ?? null,
    });

    let scheduledMaintenanceCompletion: {
      maintenanceId: string;
      completed: boolean;
      nextMaintenanceId: string | null;
    } | null = null;

    const isAppMaintenanceUpdate = Boolean(
      procedureKind
      && (
        access.accessMode === "field_manager"
        || access.accessMode === "owner_session"
      ),
    );

    if (isAppMaintenanceUpdate) {
      const completedBy = access.accessMode === "owner_session"
        ? asText(access.ownerAppDisplayName)
          || asText(saved.event.operatorName)
          || "Owner"
        : asText(access.fieldManagerDisplayName)
          || asText(saved.event.operatorName)
          || "Field Manager";
      const existingCompletion =
        await getAssetMaintenanceRecordBySourceScanEventId(
          access.ownerUserId,
          saved.event.id,
        );

      if (existingCompletion) {
        if (
          scheduledMaintenanceId
          && existingCompletion.id !== scheduledMaintenanceId
        ) {
          throw new Error("SCHEDULED_MAINTENANCE_NO_LONGER_AVAILABLE");
        }

        scheduledMaintenanceCompletion = {
          maintenanceId: existingCompletion.id,
          completed: existingCompletion.status === "done",
          nextMaintenanceId: null,
        };
      } else if (scheduledMaintenance) {
        const currentScheduledMaintenance = await getAssetMaintenanceRecordById(
          access.ownerUserId,
          scheduledMaintenance.id,
        );

        if (
          !currentScheduledMaintenance
          || currentScheduledMaintenance.assetId !== saved.asset.id
          || currentScheduledMaintenance.status !== "upcoming"
        ) {
          throw new Error("SCHEDULED_MAINTENANCE_NO_LONGER_AVAILABLE");
        }

        const completedUsage = currentScheduledMaintenance.triggerType === "usage"
          ? saved.event.assetUsageReading ?? saved.event.hours
          : null;
        const completion = await completeAssetMaintenanceRecord(
          access.ownerUserId,
          currentScheduledMaintenance.id,
          {
            completedAt: saved.event.createdAtIso,
            completedUsage,
            completedNotes: saved.event.note || payload.note,
            completedBy,
            sourceScanEventId: saved.event.id,
          },
          {
            assetId: saved.asset.id,
            maintenanceType: currentScheduledMaintenance.maintenanceType,
          },
        );

        scheduledMaintenanceCompletion = {
          maintenanceId: completion.completed.id,
          completed: completion.completed.status === "done",
          nextMaintenanceId: completion.nextRecord?.id ?? null,
        };
      } else if (procedureKind) {
        const maintenanceType =
          procedureKind === "checked" ? "checkup" : "service";
        const completedUsage = saved.event.assetUsageReading ?? saved.event.hours;
        const completion = await recordStandaloneAssetMaintenanceCompletion(
          access.ownerUserId,
          {
            assetId: saved.asset.id,
            maintenanceType,
            sourceScanEventId: saved.event.id,
            completedAt: saved.event.createdAtIso,
            completedUsage,
            completedNotes: saved.event.note || payload.note,
            completedBy,
          },
        );

        scheduledMaintenanceCompletion = {
          maintenanceId: completion.id,
          completed: completion.status === "done",
          nextMaintenanceId: null,
        };
      }
    }

    let recentEvents = [saved.event];

    try {
      recentEvents = await listRecentScanEvents(saved.asset.id, 8);
    } catch (recentEventsError) {
      console.warn("[scan-event] QR update saved, but recent scan events could not be reloaded", {
        publicAssetCode,
        assetId: saved.asset.id,
        error: recentEventsError,
      });
    }

    const metadata = {
      assetId: saved.asset.id,
      eventId: saved.event.id,
      actorType: access.accessMode,
      publicAssetCode,
      fieldManagerId: access.fieldManagerId ?? null,
      fieldManagerDisplayName: access.fieldManagerDisplayName ?? null,
      scheduledMaintenanceId: scheduledMaintenanceCompletion?.maintenanceId ?? null,
      hasNote: Boolean(payload.note),
      photoCount: payload.photoUrls.length,
    };
    const usageEvents: AdminUsageEventInput[] = [
      {
        userId: access.ownerUserId,
        eventType:
          access.accessMode === "field_manager"
            ? "field_manager_asset_updated"
            : "qr_asset_updated",
        eventSource: "scan-asset-event",
        metadata,
      },
    ];

    if (payload.note) {
      usageEvents.push({
        userId: access.ownerUserId,
        eventType: "maintenance_note_left",
        eventSource: "scan-asset-event",
        metadata,
      });
    }

    await recordAdminUsageEventsSafely(usageEvents);

    return NextResponse.json({
      ok: true,
      asset: saved.asset,
      event: recentEvents[0] ?? saved.event,
      recentEvents,
      scheduledMaintenanceCompletion,
    });
  } catch (error) {
    console.error("[scan-event] Failed to save QR scan update", {
      publicAssetCode,
      assetId: access.asset.id,
      accessMode: access.accessMode,
      error,
    });

    const safeOwnerError = safeAssetOwnerError(
      error,
      "Could not save this asset update safely.",
    );
    if (safeOwnerError) {
      return NextResponse.json(
        { ok: false, error: safeOwnerError.error, pinRequired: false },
        { status: safeOwnerError.status },
      );
    }

    if (
      error instanceof Error
      && (
        error.message === "SCHEDULED_MAINTENANCE_NO_LONGER_AVAILABLE"
        || error.message === "MAINTENANCE_NOT_FOUND"
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The asset update was saved, but this maintenance item changed before it could be marked done. Return to Maintenance and try again.",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "USAGE_MODE_PERCENT_CANNOT_ACCEPT_HOURS"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This asset is valued by lifetime worked percentage, so the QR page cannot update it with hours.",
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "USAGE_MODE_HOURS_CANNOT_ACCEPT_PERCENT"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This asset is valued by hours or kilometres, so the QR page cannot update it with a lifetime worked percentage.",
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "USAGE_READING_CANNOT_DECREASE"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The new usage reading cannot be lower than the reading already saved on this asset.",
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "LIFE_WORKED_PERCENT_CANNOT_DECREASE"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The new lifetime worked percentage cannot be lower than the percentage already saved on this asset.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: safeUnexpectedErrorMessage(error, "Failed to save scan update."),
      },
      { status: 500 },
    );
  }
}
