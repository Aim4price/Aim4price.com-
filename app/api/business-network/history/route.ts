import { NextRequest } from "next/server";
import {
  ensureBusinessNetwork,
  revokeBusinessRequest,
} from "../../../../lib/business-network";
import { getDb } from "../../../../lib/db";
import {
  businessBody,
  businessError,
  businessJson,
  requireBusinessOrigin,
  requireBusinessOwner,
} from "../../../../lib/business-network-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await requireBusinessOwner();
    await ensureBusinessNetwork();
    const result = await getDb().query(
      `select r.id,b.name,r.status,r.created_at,r.revoked_at,r.snapshot->>'umbrella' as umbrella,r.snapshot->'assets'->0->>'title' as title from business_network_requests r join business_network b on b.id=r.business_id where r.owner_id=$1 order by r.created_at desc limit 25`,
      [user.id],
    );
    return businessJson({ ok: true, requests: result.rows });
  } catch (e) {
    return businessError(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    requireBusinessOrigin(request);
    const user = await requireBusinessOwner();
    const body = await businessBody(request);
    await revokeBusinessRequest(user.id, String(body.id || ""));
    return businessJson({ ok: true });
  } catch (e) {
    return businessError(e);
  }
}
