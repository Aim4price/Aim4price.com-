import { NextResponse } from "next/server";
import { isAim4priceAdminEmail } from "../../../../lib/account-constants";
import { getAdminDashboardStats } from "../../../../lib/admin-dashboard";
import { getAnyServerSession } from "../../../../lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function requireAdminSession() {
  const session = await getAnyServerSession();

  if (!session?.user?.id) {
    return { response: jsonError("Not authenticated.", 401) };
  }

  if (!isAim4priceAdminEmail(session.user.email)) {
    return { response: jsonError("Admin access required.", 403) };
  }

  return { response: null };
}

export async function GET() {
  const { response } = await requireAdminSession();

  if (response) {
    return response;
  }

  try {
    const dashboard = await getAdminDashboardStats();
    return NextResponse.json({ ok: true, dashboard });
  } catch (error) {
    console.error("Failed to load admin dashboard", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load dashboard.",
      500,
    );
  }
}
