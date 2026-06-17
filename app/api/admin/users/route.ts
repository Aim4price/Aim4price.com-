import { NextResponse } from "next/server";
import {
  isAim4priceAdminEmail,
  normalizeAccountStatus,
  type AccountStatus,
} from "../../../../lib/account-constants";
import {
  findAdminUserEmail,
  listAdminUsers,
  setAdminUserAccountStatus,
} from "../../../../lib/admin-users";
import { auth } from "../../../../lib/auth";
import { getAnyServerSession } from "../../../../lib/auth-session";
import { getResetPasswordRedirectUrl } from "../../../../lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set<AccountStatus>([
  "pending_payment",
  "active",
  "suspended",
]);

type AdminAction = "activate" | "pending" | "suspend" | "send_reset";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function requireAdminSession() {
  const session = await getAnyServerSession();

  if (!session?.user?.id) {
    return { session: null, response: jsonError("Not authenticated.", 401) };
  }

  if (!isAim4priceAdminEmail(session.user.email)) {
    return {
      session: null,
      response: jsonError("Admin access required.", 403),
    };
  }

  return { session, response: null };
}

function readActionStatus(action: AdminAction): AccountStatus | null {
  if (action === "activate") return "active";
  if (action === "pending") return "pending_payment";
  if (action === "suspend") return "suspended";
  return null;
}

export async function GET() {
  const { response } = await requireAdminSession();

  if (response) {
    return response;
  }

  try {
    const users = await listAdminUsers();
    return NextResponse.json({ ok: true, users });
  } catch (error) {
    console.error("Failed to list admin users", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load users.",
      500,
    );
  }
}

export async function POST(request: Request) {
  const { response } = await requireAdminSession();

  if (response) {
    return response;
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body.");
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const action =
    typeof body.action === "string"
      ? (body.action.trim() as AdminAction)
      : ("" as AdminAction);

  if (!userId) {
    return jsonError("Missing user ID.");
  }

  try {
    if (action === "send_reset") {
      const email = await findAdminUserEmail(userId);
      await auth.api.requestPasswordReset({
        body: {
          email,
          redirectTo: getResetPasswordRedirectUrl(),
        },
      });

      const users = await listAdminUsers();
      return NextResponse.json({
        ok: true,
        users,
        message: "Reset password email sent.",
      });
    }

    const actionStatus = readActionStatus(action);
    const bodyStatus =
      typeof body.status === "string"
        ? normalizeAccountStatus(body.status)
        : null;
    const nextStatus = actionStatus || bodyStatus;

    if (!nextStatus || !ALLOWED_STATUSES.has(nextStatus)) {
      return jsonError("Unsupported admin action.");
    }

    await setAdminUserAccountStatus(userId, nextStatus);
    const users = await listAdminUsers();

    return NextResponse.json({ ok: true, users });
  } catch (error) {
    console.error("Admin user action failed", error);
    return jsonError(
      error instanceof Error ? error.message : "Admin action failed.",
      500,
    );
  }
}
