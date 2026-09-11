import { NextRequest } from "next/server";
import {
  inviteBusiness,
  limitBusinessAction,
  ensureBusinessNetwork,
} from "../../../../lib/business-network";
import { getDb } from "../../../../lib/db";
import { businessEmail } from "../../../../lib/business-network-shared";
import {
  businessBody,
  businessError,
  businessJson,
  requireBusinessOrigin,
} from "../../../../lib/business-network-api";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    requireBusinessOrigin(request);
    const body = await businessBody(request);
    const email = businessEmail(body.email);
    await ensureBusinessNetwork();
    await limitBusinessAction(
      `manage-ip:${request.headers.get("x-forwarded-for") || "unknown"}`,
      10,
    );
    const b = (
      await getDb().query<{ name: string }>(
        `select name from business_network where email=$1`,
        [email],
      )
    ).rows[0];
    if (b) await inviteBusiness(`business-self:${email}`, b.name, email);
    return businessJson({ ok: true });
  } catch (e) {
    return businessError(e);
  }
}
