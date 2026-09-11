import { NextRequest } from "next/server";
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
  requireBusinessOrigin,
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
    requireBusinessOrigin(request);
    return businessJson({
      ok: true,
      id: await saveAdminBusiness(user.id, await businessBody(request)),
    });
  } catch (e) {
    return businessError(e);
  }
}
