import { NextRequest } from "next/server";
import { ingestTracking, validateUpload } from "../../../../lib/asset-tracking";
import {
  smallTrackingBody,
  trackingJson,
} from "../../../../lib/asset-tracking-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token)
    return trackingJson({ error: "Device authentication required." }, 401);
  try {
    return trackingJson(
      await ingestTracking(
        token,
        validateUpload(await smallTrackingBody(request)),
      ),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return trackingJson(
      {
        error:
          message === "RECOVERY_UNAVAILABLE"
            ? "Saved readings belong to another connection. They remain on the phone."
            : message === "DEVICE_REVOKED"
            ? "Device disconnected. Pair again."
            : message === "INVALID_UPLOAD"
              ? "Invalid tracking readings."
              : "Upload failed. Retry later.",
      },
      message === "RECOVERY_UNAVAILABLE"
        ? 403
        : message === "RATE_LIMIT"
        ? 429
        : message === "DEVICE_REVOKED"
          ? 401
          : message === "INVALID_UPLOAD"
            ? 400
            : 500,
    );
  }
}
