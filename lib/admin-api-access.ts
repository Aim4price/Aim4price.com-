import { NextResponse } from "next/server";
import { isAim4priceAdminEmail } from "./account-constants";
import { getAnyServerSession } from "./auth-session";

export function adminApiError(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}
export async function requireAdminApiAccess() {
  const session = await getAnyServerSession();

  if (!session?.user?.id) {
    return {
      ok: false as const,
      response: adminApiError("Not authenticated.", 401),
    };
  }

  if (!isAim4priceAdminEmail(session.user.email)) {
    return {
      ok: false as const,
      response: adminApiError("Admin access required.", 403),
    };
  }

  return {
    ok: true as const,
    session,
    actor: {
      actorType: "admin" as const,
      userId: session.user.id,
      displayName:
        String(session.user.name ?? "").trim() ||
        String(session.user.email ?? "").trim() ||
        "Aim4price admin",
    },
  };
}
