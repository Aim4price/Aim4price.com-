import { NextRequest } from "next/server";
import { pairDevice } from "../../../../lib/asset-tracking";
import {
  smallTrackingBody,
  trackingJson,
} from "../../../../lib/asset-tracking-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const body = await smallTrackingBody(request);
    const code = String(body.code || "")
      .replace(/-/g, "")
      .toUpperCase();
    if (!/^[A-F0-9]{16}$/.test(code))
      return trackingJson({ error: "Invalid or expired pairing code." }, 400);
    return trackingJson(
      await pairDevice(
        code,
        String(body.name || "Equipment phone").slice(0, 80),
      ),
    );
  } catch {
    return trackingJson({ error: "Invalid or expired pairing code." }, 400);
  }
}
