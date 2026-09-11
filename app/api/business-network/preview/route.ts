import { NextRequest } from "next/server";
import { buildBusinessLeadView } from "../../../../lib/business-network";
import {
  businessBody,
  businessError,
  businessJson,
  requireBusinessOrigin,
  requireBusinessOwner,
} from "../../../../lib/business-network-api";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    requireBusinessOrigin(request);
    const user = await requireBusinessOwner();
    const result = await buildBusinessLeadView(
      user,
      await businessBody(request),
    );
    return businessJson({ ok: true, view: result.view });
  } catch (e) {
    return businessError(e);
  }
}
