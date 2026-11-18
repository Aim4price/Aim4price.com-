import { NextRequest } from "next/server";
import { isTrustedRequestOrigin } from "../../../../lib/trusted-request-origin";
import { getAnyServerSession } from "../../../../lib/auth-session";
import { isAim4priceAdminEmail } from "../../../../lib/account-constants";
import {
  listAdminBusinesses,
  saveAdminBusiness,
} from "../../../../lib/admin-business-network";
import {
  businessBody,
  businessError,
  businessJson,
} from "../../../../lib/business-network-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function admin() {
  const session = await getAnyServerSession();
  return session?.user?.id && isAim4priceAdminEmail(session.user.email)
    ? session.user
    : null;
}
export async function GET() {
  const user = await admin();
  if (!user)
    return businessJson({ ok: false, error: "Admin access required." }, 403);
  try {
    return businessJson({ ok: true, businesses: await listAdminBusinesses() });
  } catch (e) {
    return businessError(e);
  }
}
export async function POST(request: NextRequest) {
  const user = await admin();
  if (!user)
    return businessJson({ ok: false, error: "Admin access required." }, 403);
  try {
    if (!isTrustedRequestOrigin(request.headers.get("origin"), new URL(request.url).origin))
      return businessJson({ ok: false, error: "Invalid request origin." }, 403);
    return businessJson({
      ok: true,
      id: await saveAdminBusiness(user.id, await businessBody(request)),
    });
  } catch (e) {
    return businessError(e);
  }
}
