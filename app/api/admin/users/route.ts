import { NextResponse } from "next/server";
import {
  isAim4priceAdminEmail,
  normalizeAccountStatus,
  type AccountStatus,
} from "../../../../lib/account-constants";
import {
  ADMIN_SUPPORT_COOKIE_MAX_AGE_SECONDS,
  ADMIN_SUPPORT_COOKIE_NAME,
  getAnyServerSession,
} from "../../../../lib/auth-session";
import {
  assertAdminCanOpenUser,
  deleteAdminManagedUser,
  findAdminUserEmail,
  listAdminUsers,
  setAdminUserAccountStatus,
} from "../../../../lib/admin-users";
import {
  DEFAULT_ADMIN_NOTIFICATION_TITLE,
  MAX_ADMIN_NOTIFICATION_BODY_LENGTH,
  MAX_ADMIN_NOTIFICATION_TITLE_LENGTH,
  sendAdminAccountNotification,
} from "../../../../lib/admin-account-notifications";
import { auth } from "../../../../lib/auth";
import { getResetPasswordRedirectUrl } from "../../../../lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set<AccountStatus>([
  "pending_payment",
  "active",
  "suspended",
]);

type AdminAction =
  | "activate"
  | "pending"
  | "suspend"
  | "send_reset"
  | "send_notification"
  | "open_account"
  | "close_account"
  | "delete_user";

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

function withClearedAdminSupportCookie(response: NextResponse): NextResponse {
  response.cookies.set(ADMIN_SUPPORT_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

function withAdminSupportCookie(
  response: NextResponse,
  userId: string,
): NextResponse {
  response.cookies.set(ADMIN_SUPPORT_COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SUPPORT_COOKIE_MAX_AGE_SECONDS,
  });

  return response;
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
  const { session, response } = await requireAdminSession();

  if (response) {
    return response;
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body.");
  }

  const action =
    typeof body.action === "string"
      ? (body.action.trim() as AdminAction)
      : ("" as AdminAction);

  if (action === "close_account") {
    return withClearedAdminSupportCookie(
      NextResponse.json({ ok: true, message: "Admin support access closed." }),
    );
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";

  if (!userId) {
    return jsonError("Missing user ID.");
  }

  try {
    if (action === "send_notification") {
      const notificationTitle =
        typeof body.notificationTitle === "string"
          ? body.notificationTitle.trim()
          : DEFAULT_ADMIN_NOTIFICATION_TITLE;
      const notificationBody =
        typeof body.notificationBody === "string"
          ? body.notificationBody.trim()
          : "";

      if (!notificationBody) {
        return jsonError("A notification message is required.");
      }
      if (notificationTitle.length > MAX_ADMIN_NOTIFICATION_TITLE_LENGTH) {
        return jsonError(
          `Notification titles may not exceed ${MAX_ADMIN_NOTIFICATION_TITLE_LENGTH} characters.`,
        );
      }
      if (notificationBody.length > MAX_ADMIN_NOTIFICATION_BODY_LENGTH) {
        return jsonError(
          `Notification messages may not exceed ${MAX_ADMIN_NOTIFICATION_BODY_LENGTH} characters.`,
        );
      }

      const sent = await sendAdminAccountNotification({
        targetUserId: userId,
        senderUserId: session?.user?.id || "",
        title: notificationTitle,
        body: notificationBody,
      });
      return NextResponse.json({
        ok: true,
        message: sent.targetEmail
          ? `Notification sent to ${sent.targetEmail}.`
          : "Notification sent.",
      });
    }

    if (action === "open_account") {
      const email = await assertAdminCanOpenUser(userId);
      const users = await listAdminUsers();
      return withAdminSupportCookie(
        NextResponse.json({
          ok: true,
          users,
          redirectUrl: "/account",
          message: `Admin support access opened for ${email}.`,
        }),
        userId,
      );
    }

    if (action === "delete_user") {
      await deleteAdminManagedUser(userId);
      const users = await listAdminUsers();
      return NextResponse.json({
        ok: true,
        users,
        message: "Account deleted.",
      });
    }

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
