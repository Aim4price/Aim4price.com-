import { NextRequest, NextResponse } from "next/server";
import { adminApiError, requireAdminApiAccess } from "../../../../lib/admin-api-access";
import {
  CAPTURE_REQUEST_STATUSES,
  CAPTURE_REQUEST_TYPES,
  CAPTURE_SUBMISSION_CHANNELS,
  getCaptureQueueCounts,
  listCaptureRequests,
  type CaptureRequest,
  type CaptureRequestListFilters,
  type CaptureRequestStatus,
  type CaptureRequestType,
  type CaptureSubmissionChannel,
} from "../../../../lib/capture-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TERMINAL_STATUSES: CaptureRequestStatus[] = [
  "completed",
  "declined",
  "rejected",
  "cancelled",
];
const OPEN_STATUSES = CAPTURE_REQUEST_STATUSES.filter(
  (status) => !TERMINAL_STATUSES.includes(status),
);
const SLA_STATUSES = OPEN_STATUSES.filter((status) => status !== "awaiting_owner");

function payloadText(payload: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function compactIdentifier(value: string | null): string {
  if (!value) return "";
  return value.length > 20 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function mapCaptureRequestForAdmin(request: CaptureRequest) {
  const payload = request.capturedPayload ?? {};
  const senderDisplayName =
    request.sender.businessName || request.sender.name || request.sender.email || request.sender.phone;
  const ownerDisplayName =
    payloadText(payload, "ownerDisplayName", "ownerName", "customerName") ||
    compactIdentifier(request.ownerUserId);
  const assetDisplayName =
    payloadText(payload, "assetDisplayName", "assetTitle", "assetName") ||
    request.assetReference ||
    compactIdentifier(request.assetId);
  const fuelStorageDisplayName =
    payloadText(payload, "fuelStorageDisplayName", "storageName", "tankName") ||
    compactIdentifier(request.fuelStorageId);

  return {
    ...request,
    senderDisplayName,
    senderEmail: request.sender.email,
    senderPhone: request.sender.phone,
    senderBusinessName: request.sender.businessName,
    senderNote: request.requesterNote,
    ownerDisplayName,
    assetDisplayName,
    fuelStorageDisplayName,
  };
}

function enumQueryValue<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | null {
  return value && allowed.includes(value as T) ? (value as T) : null;
}

function buildFilters(request: NextRequest): {
  filters: CaptureRequestListFilters;
  completedTodayOnly: boolean;
} {
  const { searchParams } = request.nextUrl;
  const now = new Date();
  const statusValue = searchParams.get("status")?.trim().toLowerCase() || "open";
  const requestType = enumQueryValue<CaptureRequestType>(
    searchParams.get("requestType"),
    CAPTURE_REQUEST_TYPES,
  );
  const submissionChannel = enumQueryValue<CaptureSubmissionChannel>(
    searchParams.get("submissionChannel"),
    CAPTURE_SUBMISSION_CHANNELS,
  );
  const filters: CaptureRequestListFilters = {
    limit: 100,
    search: searchParams.get("search"),
    requestTypes: requestType ? [requestType] : undefined,
    submissionChannels: submissionChannel ? [submissionChannel] : undefined,
  };
  let completedTodayOnly = false;

  if (statusValue === "open") {
    filters.statuses = [...OPEN_STATUSES];
  } else if (statusValue === "overdue") {
    filters.statuses = [...SLA_STATUSES];
    filters.dueBefore = now;
  } else if (statusValue === "due_today") {
    filters.statuses = [...SLA_STATUSES];
    filters.dueAfter = now;
    filters.dueBefore = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else if (statusValue === "completed_today") {
    filters.statuses = ["completed"];
    filters.limit = 200;
    completedTodayOnly = true;
  } else if (statusValue !== "all") {
    const status = enumQueryValue<CaptureRequestStatus>(statusValue, CAPTURE_REQUEST_STATUSES);
    if (!status) throw new Error("CAPTURE_STATUS_INVALID");
    filters.statuses = [status];
  }

  return { filters, completedTodayOnly };
}

function isCompletedToday(request: CaptureRequest, now: Date): boolean {
  if (!request.completedAtIso) return false;
  const completed = new Date(request.completedAtIso);
  return completed.getFullYear() === now.getFullYear()
    && completed.getMonth() === now.getMonth()
    && completed.getDate() === now.getDate();
}

export async function GET(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;

  try {
    const { filters, completedTodayOnly } = buildFilters(request);
    const [captureRequests, queueCounts] = await Promise.all([
      listCaptureRequests(filters),
      getCaptureQueueCounts(),
    ]);
    const visibleRequests = completedTodayOnly
      ? captureRequests.filter((entry) => isCompletedToday(entry, new Date()))
      : captureRequests;

    return NextResponse.json({
      ok: true,
      requests: visibleRequests.map(mapCaptureRequestForAdmin),
      counts: {
        pending: queueCounts.totalOpen,
        dueToday: queueCounts.dueWithin24Hours,
        overdue: queueCounts.overdue,
        needsInformation: queueCounts.needsInformation,
        awaitingOwner: queueCounts.awaitingOwner,
        completedToday: queueCounts.completedToday,
        unassigned: queueCounts.unassigned,
        needsMatching: queueCounts.needsMatching,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("CAPTURE_")) {
      return adminApiError("The selected capture queue filter is invalid.", 400);
    }
    console.error("Admin Capture Queue GET failed", error);
    return adminApiError("Failed to load the Capture Queue.", 500);
  }
}
