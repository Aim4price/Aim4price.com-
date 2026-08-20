import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminApiError, requireAdminApiAccess } from "../../../../../../../lib/admin-api-access";
import { resolveAssetRegisterUploadBytes } from "../../../../../../../lib/asset-register-uploads";
import { readCaptureQuarantineFile } from "../../../../../../../lib/capture-quarantine-storage";
import {
  getCaptureRequestFile,
  setCaptureRequestFileSecurityStatus,
} from "../../../../../../../lib/capture-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { requestId?: string; fileId?: string } };

function cleanText(value: unknown, maxLength = 500): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeFileName(value: string): string {
  return value
    .replace(/[\\/\0\r\n";]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150) || "capture-document";
}

function captureFileError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : "";
  if (code.includes("NOT_FOUND")) return adminApiError("Capture file not found.", 404);
  if (code.startsWith("CAPTURE_")) return adminApiError("The file security action is not valid.", 400);
  console.error("Admin capture file action failed", error);
  return adminApiError("Failed to access this capture file.", 500);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  const requestId = cleanText(context.params.requestId, 80);
  const fileId = cleanText(context.params.fileId, 80);
  if (!requestId || !fileId) return adminApiError("Capture file not found.", 404);

  try {
    const file = await getCaptureRequestFile(requestId, fileId);
    if (!file) return adminApiError("Capture file not found.", 404);
    if (file.securityStatus === "rejected") {
      return adminApiError("This file failed its security check and cannot be opened.", 410);
    }

    let bytes: Buffer;
    if (file.promotedUploadId) {
      const trustedUpload = await resolveAssetRegisterUploadBytes(file.promotedUploadId);
      if (trustedUpload.status === "not-found") return adminApiError("Capture file not found.", 404);
      if (trustedUpload.status === "unavailable") {
        return adminApiError("This trusted upload is temporarily unavailable.", 503);
      }
      bytes = trustedUpload.upload.data;
      if (
        bytes.length !== file.byteSize
        || createHash("sha256").update(bytes).digest("hex") !== file.sha256
      ) {
        return adminApiError("This capture file failed its integrity check.", 409);
      }
    } else {
      bytes = await readCaptureQuarantineFile({
        storageKey: file.storageKey,
        expectedByteSize: file.byteSize,
        expectedSha256: file.sha256,
      });
    }
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `inline; filename="${safeFileName(file.originalFileName)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "X-Content-Type-Options": "nosniff",
        "X-Aim4price-File-Security-Status": file.securityStatus,
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return captureFileError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  const requestId = cleanText(context.params.requestId, 80);
  const fileId = cleanText(context.params.fileId, 80);
  if (!requestId || !fileId) return adminApiError("Capture file not found.", 404);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const status = cleanText(body?.status, 20);
  const reason = cleanText(body?.reason, 2_000);
  if (status !== "clean" && status !== "rejected") {
    return adminApiError("Choose whether this file passed or failed its security check.", 400);
  }
  if (status === "rejected" && !reason) {
    return adminApiError("Add the reason this file failed its security check.", 400);
  }

  try {
    const file = await setCaptureRequestFileSecurityStatus(
      requestId,
      fileId,
      { status, reason },
      access.actor,
    );
    return NextResponse.json({
      ok: true,
      file: {
        id: file.id,
        securityStatus: file.securityStatus,
        securityReason: file.securityReason,
      },
      message: status === "clean"
        ? "File security check passed and was recorded."
        : "File rejected and kept out of the capture workflow.",
    });
  } catch (error) {
    return captureFileError(error);
  }
}
