import { NextRequest, NextResponse } from "next/server";
import { adminApiError, requireAdminApiAccess } from "../../../../../lib/admin-api-access";
import { searchAdminCaptureTargets } from "../../../../../lib/admin-capture-targets";
import { CAPTURE_REQUEST_TYPES, type CaptureRequestType } from "../../../../../lib/capture-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  const query = request.nextUrl.searchParams.get("query") ?? "";
  const rawType = request.nextUrl.searchParams.get("requestType") ?? "invoice";
  if (!CAPTURE_REQUEST_TYPES.includes(rawType as CaptureRequestType)) {
    return adminApiError("Choose a valid document type.", 400);
  }

  try {
    const targets = await searchAdminCaptureTargets({
      query,
      requestType: rawType as CaptureRequestType,
      limit: 20,
    });
    return NextResponse.json({ ok: true, targets });
  } catch (error) {
    console.error("Admin capture target search failed", error);
    return adminApiError("Failed to search customers and assets.", 500);
  }
}
