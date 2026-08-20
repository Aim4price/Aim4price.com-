import { NextRequest, NextResponse } from "next/server";
import { adminApiError, requireAdminApiAccess } from "../../../../../lib/admin-api-access";
import {
  claimCaptureRequest,
  getCaptureRequestDetail,
  listCaptureRequestEvents,
  listCaptureRequestFiles,
  matchCaptureRequest,
  transitionCaptureRequest,
  updateCaptureRequestDraft,
  type CaptureAdminActor,
  type CaptureRequest,
  type CaptureRequestEvent,
  type CaptureRequestFile,
} from "../../../../../lib/capture-requests";
import { finalizeCaptureRequestForAdmin } from "../../../../../lib/capture-finalization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { requestId?: string } };
type AdminAction =
  | "claim"
  | "save_draft"
  | "request_information"
  | "mark_duplicate"
  | "complete"
  | "reject";

function cleanText(value: unknown, maxLength = 2_000): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

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

function mapRequest(request: CaptureRequest) {
  const payload = request.capturedPayload ?? {};
  return {
    ...request,
    senderDisplayName:
      request.sender.businessName || request.sender.name || request.sender.email || request.sender.phone,
    senderEmail: request.sender.email,
    senderPhone: request.sender.phone,
    senderBusinessName: request.sender.businessName,
    senderNote: request.requesterNote,
    ownerDisplayName:
      payloadText(payload, "ownerDisplayName", "ownerName", "customerName") ||
      compactIdentifier(request.ownerUserId),
    assetDisplayName:
      payloadText(payload, "assetDisplayName", "assetTitle", "assetName") ||
      request.assetReference ||
      compactIdentifier(request.assetId),
    fuelStorageDisplayName:
      payloadText(payload, "fuelStorageDisplayName", "storageName", "tankName") ||
      compactIdentifier(request.fuelStorageId),
  };
}

function mapFile(requestId: string, file: CaptureRequestFile) {
  return {
    id: file.id,
    originalFileName: file.originalFileName,
    mimeType: file.contentType,
    sizeBytes: file.byteSize,
    pageOrder: file.pageOrder,
    securityStatus: file.securityStatus,
    securityReason: file.securityReason,
    // Admins need the private sandboxed preview in order to make the explicit
    // security decision. Rejected files are the only files kept locked.
    downloadUrl: file.securityStatus !== "rejected"
      ? `/api/admin/capture-requests/${encodeURIComponent(requestId)}/files/${encodeURIComponent(file.id)}`
      : "",
  };
}

function mapEvent(event: CaptureRequestEvent) {
  return {
    id: event.id,
    eventType: event.eventType,
    actorDisplayName: event.actor.displayName,
    note: event.note,
    createdAtIso: event.createdAtIso,
  };
}

async function buildResponseDetail(requestId: string) {
  const [request, files, events] = await Promise.all([
    getCaptureRequestDetail(requestId),
    listCaptureRequestFiles(requestId),
    listCaptureRequestEvents(requestId),
  ]);
  if (!request) return null;
  return {
    request: mapRequest(request),
    files: files.map((file) => mapFile(requestId, file)),
    events: events.map(mapEvent),
  };
}

function statusForCaptureError(message: string): number {
  if (message.includes("NOT_FOUND")) return 404;
  if (
    message.includes("CLAIMED_BY_ANOTHER") ||
    message.includes("ALREADY") ||
    message.includes("CLOSED") ||
    message.includes("TRANSITION") ||
    message.includes("COMPLETION")
  ) return 409;
  if (message.startsWith("CAPTURE_")) return 400;
  return 500;
}

function friendlyCaptureError(message: string): string {
  const messages: Record<string, string> = {
    CAPTURE_REQUEST_NOT_FOUND: "This capture request could not be found.",
    CAPTURE_CLAIMED_BY_ANOTHER_ADMIN: "Another admin has already claimed this request.",
    CAPTURE_NOT_CLAIMED: "Claim this request before changing it.",
    CAPTURE_REQUEST_CLOSED: "This capture request can no longer be changed.",
    CAPTURE_REQUEST_NOT_CLAIMABLE: "This capture request cannot be claimed in its current status.",
    CAPTURE_OWNER_REQUIRED: "Match the customer before continuing.",
    CAPTURE_ASSET_INVALID: "Choose a valid asset match.",
    CAPTURE_FUEL_STORAGE_INVALID: "Choose a valid fuel storage match.",
    CAPTURE_TARGET_INVALID: "Choose exactly one valid destination for this document.",
    CAPTURE_ASSET_NOT_FOUND: "The selected asset does not belong to that customer.",
    CAPTURE_FUEL_STORAGE_NOT_FOUND: "The selected fuel storage does not belong to that customer.",
    CAPTURE_CLEAN_FILE_REQUIRED: "At least one attached file must pass its security check first.",
    CAPTURE_FILE_SECURITY_PENDING: "Finish the file security checks before continuing.",
    CAPTURE_INFORMATION_REASON_REQUIRED: "Add the information that the sender must provide.",
    CAPTURE_REJECTION_REASON_REQUIRED: "Add a reason before rejecting this request.",
    CAPTURE_OWNER_APPROVAL_REQUIRED: "The owner must approve this submission first.",
    CAPTURE_OUTPUT_MISMATCH: "The final ledger record does not match this capture request.",
  };
  return messages[message] || (message.startsWith("CAPTURE_")
    ? "This capture action is not valid in the request's current state."
    : "Failed to update this capture request.");
}

async function claimWhenNeeded(request: CaptureRequest, actor: CaptureAdminActor): Promise<CaptureRequest> {
  if (request.assignedAdminUserId === actor.userId) return request;
  return claimCaptureRequest(request.id, actor);
}

function readDraft(body: Record<string, unknown>): Record<string, unknown> {
  const input = asObject(body.draft);
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input).slice(0, 100)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      output[key] = value;
    }
  }
  return output;
}

function draftMatch(request: CaptureRequest, draft: Record<string, unknown>) {
  const ownerUserId = cleanText(draft.ownerUserId, 200);
  const assetId = cleanText(draft.assetId, 80);
  const fuelStorageId = cleanText(draft.fuelStorageId, 80);
  const hasCompleteTarget = request.requestType === "invoice"
    ? Boolean(ownerUserId && assetId && !fuelStorageId)
    : Boolean(ownerUserId && (Boolean(assetId) !== Boolean(fuelStorageId)));
  const changed = ownerUserId !== (request.ownerUserId ?? "")
    || assetId !== (request.assetId ?? "")
    || fuelStorageId !== (request.fuelStorageId ?? "");
  return { ownerUserId, assetId, fuelStorageId, hasCompleteTarget, changed };
}

async function saveAdminDraft(
  request: CaptureRequest,
  draft: Record<string, unknown>,
  actor: CaptureAdminActor,
): Promise<CaptureRequest> {
  let current = await claimWhenNeeded(request, actor);
  const target = draftMatch(current, draft);
  if (target.hasCompleteTarget && target.changed) {
    current = await matchCaptureRequest(current.id, {
      ownerUserId: target.ownerUserId,
      assetId: target.assetId || null,
      fuelStorageId: target.fuelStorageId || null,
    }, actor);
  }
  return updateCaptureRequestDraft(current.id, {
    capturedPayload: { ...current.capturedPayload, ...draft },
    adminNote: cleanText(draft.adminNote, 10_000),
  }, actor);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  const requestId = cleanText(context.params.requestId, 80);
  if (!requestId) return adminApiError("Capture request ID is required.", 400);

  try {
    const detail = await buildResponseDetail(requestId);
    if (!detail) return adminApiError("This capture request could not be found.", 404);
    return NextResponse.json({ ok: true, ...detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("Admin capture request GET failed", error);
    return adminApiError(friendlyCaptureError(message), statusForCaptureError(message));
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  const requestId = cleanText(context.params.requestId, 80);
  if (!requestId) return adminApiError("Capture request ID is required.", 400);

  let body: Record<string, unknown>;
  try {
    body = asObject(await request.json());
  } catch {
    return adminApiError("Enter a valid capture action.", 400);
  }

  const action = cleanText(body.action, 50) as AdminAction;
  const allowedActions: AdminAction[] = [
    "claim",
    "save_draft",
    "request_information",
    "mark_duplicate",
    "complete",
    "reject",
  ];
  if (!allowedActions.includes(action)) return adminApiError("Choose a valid capture action.", 400);

  try {
    const existing = await getCaptureRequestDetail(requestId);
    if (!existing) return adminApiError("This capture request could not be found.", 404);
    const actor = access.actor;
    const note = cleanText(body.note, 2_000);
    const draft = readDraft(body);
    let message = "Capture request updated.";

    if (["request_information", "mark_duplicate", "reject"].includes(action) && !note) {
      return adminApiError("Add a short reason before using this action.", 400);
    }

    switch (action) {
      case "claim":
        await claimCaptureRequest(requestId, actor);
        message = "Capture request claimed.";
        break;

      case "save_draft":
        await saveAdminDraft(existing, draft, actor);
        message = "Capture draft saved.";
        break;

      case "request_information": {
        const saved = await saveAdminDraft(existing, draft, actor);
        await transitionCaptureRequest(requestId, "needs_information", {
          actor,
          reason: note,
        });
        void saved;
        message = "Information request recorded. Use the sender details shown to follow up.";
        break;
      }

      case "mark_duplicate": {
        await claimWhenNeeded(existing, actor);
        await transitionCaptureRequest(requestId, "rejected", {
          actor,
          reason: `Duplicate: ${note}`,
        });
        message = "Document marked as a duplicate and removed from the open queue.";
        break;
      }

      case "reject": {
        await claimWhenNeeded(existing, actor);
        await transitionCaptureRequest(requestId, "rejected", { actor, reason: note });
        message = "Capture request rejected. Its audit record has been retained.";
        break;
      }

      case "complete": {
        await saveAdminDraft(existing, draft, actor);
        const finalized = await finalizeCaptureRequestForAdmin(requestId, actor);
        message = finalized.outcome === "awaiting_owner"
          ? "Document verified and sent to the owner for approval."
          : "Verified document saved to the ledger and completed.";
        break;
      }
    }

    const detail = await buildResponseDetail(requestId);
    return NextResponse.json({ ok: true, message, ...detail });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = statusForCaptureError(code);
    if (status === 500) console.error("Admin capture request PATCH failed", error);
    return adminApiError(friendlyCaptureError(code), status);
  }
}
