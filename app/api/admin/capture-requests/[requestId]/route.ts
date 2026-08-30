import { NextRequest, NextResponse } from "next/server";
import { adminApiError, requireAdminApiAccess } from "../../../../../lib/admin-api-access";
import {
  claimCaptureRequest,
  getCaptureRequestDetail,
  listCaptureRequestEvents,
  listCaptureRequestFiles,
  matchCaptureRequest,
  transitionCaptureRequest,
  updateCaptureRequestAssetUsage,
  updateCaptureRequestDraft,
  type CaptureAdminActor,
  type CaptureRequest,
  type CaptureRequestDetail,
  type CaptureRequestEvent,
  type CaptureRequestFile,
} from "../../../../../lib/capture-requests";
import {
  cancelCaptureRequestForAdmin,
  finalizeCaptureRequestForAdmin,
} from "../../../../../lib/capture-finalization";
import {
  getAdminCaptureTarget,
  type AdminCaptureTarget,
} from "../../../../../lib/admin-capture-targets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { requestId?: string } };
type AdminAction =
  | "claim"
  | "confirm_match"
  | "update_usage"
  | "save_draft"
  | "request_information"
  | "mark_duplicate"
  | "complete"
  | "complete_direct"
  | "reject"
  | "delete";

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

function mapRequest(
  request: CaptureRequest,
  matchedTarget: AdminCaptureTarget | null,
) {
  const payload = request.capturedPayload ?? {};
  const candidate = request.candidatePayload ?? {};
  return {
    ...request,
    senderDisplayName:
      request.sender.businessName || request.sender.name || request.sender.email || request.sender.phone,
    senderEmail: request.sender.email,
    senderPhone: request.sender.phone,
    senderBusinessName: request.sender.businessName,
    senderNote: request.requesterNote,
    ownerDisplayName:
      matchedTarget?.ownerDisplayName ||
      payloadText(payload, "ownerDisplayName", "ownerName", "customerName") ||
      payloadText(candidate, "ownerDisplayName", "ownerName", "customerName") ||
      compactIdentifier(request.ownerUserId),
    assetDisplayName:
      (matchedTarget?.targetType === "asset" ? matchedTarget.targetDisplayName : "") ||
      payloadText(payload, "assetDisplayName", "assetTitle", "assetName") ||
      payloadText(candidate, "assetDisplayName", "targetLabel", "submittedAssetDescription") ||
      request.assetReference ||
      compactIdentifier(request.assetId),
    fuelStorageDisplayName:
      (matchedTarget?.targetType === "fuel_storage" ? matchedTarget.targetDisplayName : "") ||
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
    metadata: event.metadata,
    createdAtIso: event.createdAtIso,
  };
}

async function buildResponseDetail(requestId: string) {
  const request = await getCaptureRequestDetail(requestId);
  if (!request) return null;
  const [files, events, matchedTarget] = await Promise.all([
    listCaptureRequestFiles(requestId),
    listCaptureRequestEvents(requestId),
    getAdminCaptureTarget({
      ownerUserId: request.ownerUserId,
      assetId: request.assetId,
      fuelStorageId: request.fuelStorageId,
    }),
  ]);
  return {
    request: mapRequest(request, matchedTarget),
    matchedTarget,
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
    message.includes("COMPLETION") ||
    message.includes("OUTPUT_EXISTS") ||
    message.includes("REQUEST_CHANGED") ||
    message.includes("FINALIZATION_IN_PROGRESS")
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
    CAPTURE_REQUEST_CHANGED: "This request changed since you opened it. Review the latest details and confirm the exact destination again.",
    CAPTURE_FINALIZATION_IN_PROGRESS: "This request is already being finalized. Reload it before making another change.",
    CAPTURE_REQUEST_NOT_CLAIMABLE: "This capture request cannot be claimed in its current status.",
    CAPTURE_OWNER_REQUIRED: "Match the customer before continuing.",
    CAPTURE_ASSET_INVALID: "Choose a valid asset match.",
    CAPTURE_FUEL_STORAGE_INVALID: "Choose a valid fuel storage match.",
    CAPTURE_TARGET_INVALID: "Choose exactly one valid destination for this document.",
    CAPTURE_TARGET_CONFIRMATION_REQUIRED: "Confirm the exact customer and destination before completing this request.",
    CAPTURE_TARGET_CHANGE_REQUIRES_CONFIRMATION: "Use Change and confirm the replacement destination before saving it.",
    CAPTURE_ASSET_NOT_FOUND: "The selected asset does not belong to that customer.",
    CAPTURE_FUEL_STORAGE_NOT_FOUND: "The selected fuel storage does not belong to that customer.",
    CAPTURE_CLEAN_FILE_REQUIRED: "At least one attached file must pass its security check first.",
    CAPTURE_FILE_SECURITY_PENDING: "Finish the file security checks before continuing.",
    CAPTURE_INFORMATION_REASON_REQUIRED: "Add the information that the sender must provide.",
    CAPTURE_REJECTION_REASON_REQUIRED: "Add a reason before rejecting this request.",
    CAPTURE_OWNER_APPROVAL_REQUIRED: "The owner must approve this submission first.",
    CAPTURE_CANCELLATION_REASON_REQUIRED: "Add a reason before deleting this request from the queue.",
    CAPTURE_CANCELLATION_OUTPUT_EXISTS: "A ledger record already exists for this request, so it cannot be deleted from the queue.",
    CAPTURE_OUTPUT_MISMATCH: "The final ledger record does not match this capture request.",
    CAPTURE_INVOICE_SUPPLIER_REQUIRED: "Enter the invoice supplier.",
    CAPTURE_INVOICE_NUMBER_REQUIRED: "Enter the invoice number.",
    CAPTURE_INVOICE_DATE_REQUIRED: "Enter a valid invoice date.",
    CAPTURE_INVOICE_TOTAL_REQUIRED: "Enter an invoice total greater than zero.",
    CAPTURE_INVOICE_TOTALS_INVALID: "Check the invoice subtotal, VAT and total amounts.",
    CAPTURE_FUEL_SUPPLIER_REQUIRED: "Enter the fuel supplier.",
    CAPTURE_FUEL_DATE_REQUIRED: "Enter a valid fuel slip date.",
    CAPTURE_FUEL_TYPE_REQUIRED: "Choose the fuel type.",
    CAPTURE_FUEL_LITRES_REQUIRED: "Enter litres greater than zero.",
    CAPTURE_FUEL_TOTAL_REQUIRED: "Enter a fuel total greater than zero.",
    CAPTURE_FUEL_TOTALS_INVALID: "The fuel slip VAT cannot be greater than its total.",
    CAPTURE_FUEL_OPERATOR_REQUIRED: "Enter the operator or choose N/A.",
    CAPTURE_FUEL_ACTIVITY_REQUIRED: "Enter the activity or choose N/A.",
    CAPTURE_FUEL_WORK_AREA_REQUIRED: "Enter the work area or choose N/A.",
    CAPTURE_FUEL_USAGE_REQUIRED: "Enter the asset usage reading or choose N/A.",
    CAPTURE_FUEL_FIELDS_INCOMPLETE: "Complete the required fuel fields or choose N/A where available.",
    CAPTURE_USAGE_READING_REQUIRED: "Enter the document usage reading before updating the Asset Register.",
    CAPTURE_USAGE_METRIC_MISMATCH: "The document usage unit does not match this asset's saved unit.",
    CAPTURE_USAGE_NOT_APPLICABLE: "This document or asset has no applicable meter reading to update.",
    CAPTURE_USAGE_CANNOT_DECREASE: "The Asset Register reading can never be lowered. Keep the document reading for history without updating the asset.",
    CAPTURE_TARGET_NOT_CONFIRMED: "Confirm this exact asset again before updating its usage.",
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

function draftTargetIsConfirmed(request: CaptureRequestDetail, draft: Record<string, unknown>): boolean {
  const target = draftMatch(request, draft);
  if (!target.hasCompleteTarget) return false;
  const latestMatch = [...request.events]
    .reverse()
    .find((event) => event.eventType === "matched");
  if (!latestMatch) return false;
  return cleanText(latestMatch.metadata.ownerUserId, 200) === target.ownerUserId
    && cleanText(latestMatch.metadata.assetId, 80) === target.assetId
    && cleanText(latestMatch.metadata.fuelStorageId, 80) === target.fuelStorageId;
}

async function saveAdminDraft(
  request: CaptureRequestDetail,
  draft: Record<string, unknown>,
  actor: CaptureAdminActor,
  options: { confirmMatch?: boolean } = {},
): Promise<CaptureRequest> {
  let current = await claimWhenNeeded(request, actor);
  const target = draftMatch(current, draft);
  if (target.changed && !options.confirmMatch) {
    throw new Error("CAPTURE_TARGET_CHANGE_REQUIRES_CONFIRMATION");
  }
  if (options.confirmMatch) {
    if (!target.hasCompleteTarget) throw new Error("CAPTURE_TARGET_INVALID");
    current = await matchCaptureRequest(current.id, {
      ownerUserId: target.ownerUserId,
      assetId: target.assetId || null,
      fuelStorageId: target.fuelStorageId || null,
      expectedVersion: current.version,
    }, actor);
  }
  return updateCaptureRequestDraft(current.id, {
    capturedPayload: { ...current.capturedPayload, ...draft },
    adminNote: cleanText(draft.adminNote, 10_000),
    expectedVersion: current.version,
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
    "confirm_match",
    "update_usage",
    "save_draft",
    "request_information",
    "mark_duplicate",
    "complete",
    "complete_direct",
    "reject",
    "delete",
  ];
  if (!allowedActions.includes(action)) return adminApiError("Choose a valid capture action.", 400);

  try {
    const existing = await getCaptureRequestDetail(requestId);
    if (!existing) return adminApiError("This capture request could not be found.", 404);
    const requestVersion = Math.trunc(Number(body.requestVersion));
    if (!Number.isFinite(requestVersion) || requestVersion < 1) {
      return adminApiError("Reload this capture request before changing it.", 400);
    }
    if (existing.version !== requestVersion) throw new Error("CAPTURE_REQUEST_CHANGED");
    const actor = access.actor;
    const note = cleanText(body.note, 2_000);
    const draft = readDraft(body);
    let message = "Capture request updated.";

    if (["request_information", "mark_duplicate", "reject", "complete_direct", "delete"].includes(action) && !note) {
      return adminApiError("Add a short reason before using this action.", 400);
    }
    if (["complete", "complete_direct", "update_usage"].includes(action) && !draftTargetIsConfirmed(existing, draft)) {
      return adminApiError(friendlyCaptureError("CAPTURE_TARGET_CONFIRMATION_REQUIRED"), 400);
    }
    if (action === "update_usage" && (!cleanText(draft.assetId, 80) || cleanText(draft.fuelStorageId, 80))) {
      return adminApiError("Usage can only be updated for a confirmed asset.", 400);
    }
    if (
      action === "complete_direct"
      && existing.submissionChannel !== "dealer_upload"
      && existing.submissionChannel !== "public_drop"
    ) {
      return adminApiError("Owner approval is not required for this submission.", 400);
    }

    switch (action) {
      case "claim":
        await claimCaptureRequest(requestId, actor);
        message = "Capture request claimed.";
        break;

      case "confirm_match":
        await saveAdminDraft(existing, draft, actor, { confirmMatch: true });
        message = "The exact customer and destination were confirmed.";
        break;

      case "update_usage": {
        const saved = await saveAdminDraft(existing, draft, actor);
        const usage = await updateCaptureRequestAssetUsage(requestId, {
          expectedVersion: saved.version,
        }, actor);
        message = usage.updated
          ? `Asset Register ${usage.metric === "km" ? "kilometres" : "hours"} updated from ${usage.previousReading ?? "not recorded"} to ${usage.newReading}.`
          : `The Asset Register is already at ${usage.newReading} ${usage.metric === "km" ? "km" : "hours"}.`;
        break;
      }

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
        const saved = await saveAdminDraft(existing, draft, actor);
        const target = draftMatch(saved, draft);
        const finalized = await finalizeCaptureRequestForAdmin(requestId, actor, {
          expectedVersion: saved.version,
          expectedTarget: {
            ownerUserId: target.ownerUserId,
            assetId: target.assetId || null,
            fuelStorageId: target.fuelStorageId || null,
          },
        });
        message = finalized.outcome === "awaiting_owner"
          ? "Document verified and sent to the owner for approval."
          : "Verified document saved to the ledger and completed.";
        break;
      }

      case "complete_direct": {
        const saved = existing.status === "awaiting_owner"
          ? existing
          : await saveAdminDraft(existing, draft, actor);
        const target = draftMatch(saved, draft);
        const finalized = await finalizeCaptureRequestForAdmin(requestId, actor, {
          ownerApprovalOverrideReason: note,
          expectedVersion: saved.version,
          expectedTarget: {
            ownerUserId: target.ownerUserId,
            assetId: target.assetId || null,
            fuelStorageId: target.fuelStorageId || null,
          },
        });
        message = finalized.outcome === "completed"
          ? "The Admin approval override was recorded and the verified document was saved directly to the ledger."
          : "Document verified and sent to the owner for approval.";
        break;
      }

      case "delete": {
        await cancelCaptureRequestForAdmin(requestId, actor, note);
        message = "Capture request deleted from the active queue. Its audit record was retained and source files were scheduled for secure removal.";
        break;
      }
    }

    const detail = await buildResponseDetail(requestId);
    return NextResponse.json({ ok: true, message, ...detail });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = statusForCaptureError(code);
    if (status === 500) console.error("Admin capture request PATCH failed", error);
    const latestDetail = await buildResponseDetail(requestId).catch(() => null);
    return NextResponse.json({
      ok: false,
      error: friendlyCaptureError(code),
      errorCode: code.startsWith("CAPTURE_") ? code : undefined,
      ...(latestDetail ?? {}),
    }, { status });
  }
}
