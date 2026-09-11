import { NextRequest } from "next/server";
import { inviteBusiness } from "../../../../lib/business-network";
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
    const body = await businessBody(request);
    await inviteBusiness(user.id, body.name, body.email);
    return businessJson({ ok: true });
  } catch (e) {
    return businessError(e);
  }
}
