import { NextResponse } from "next/server";
import { isAim4priceAdminEmail } from "../../../../lib/account-constants";
import {
  getAnyServerSession,
  getServerSession,
  isAdminSupportSession,
} from "../../../../lib/auth-session";
import {
  AdminWorkTrackerError,
  getActiveAdminWorkSession,
  getAdminWorkHistory,
  heartbeatAdminWorkSession,
  startAdminWorkSession,
  stopAdminWorkSession,
  updateAdminWorkSession,
} from "../../../../lib/admin-work-tracker";
import { resolveAdminWorkPage } from "../../../../lib/admin-work-tracker-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function requireAdminSession() {
  const session = await getAnyServerSession();

  if (!session?.user?.id) {
    return { session: null, response: jsonError("Not authenticated.", 401) };
  }
  if (!isAim4priceAdminEmail(session.user.email)) {
    return { session: null, response: jsonError("Admin access required.", 403) };
  }

  return { session, response: null };
}

async function readSupportTargetUserId(
  realSession: NonNullable<Awaited<ReturnType<typeof getAnyServerSession>>>,
): Promise<string | null> {
  const effectiveSession = await getServerSession({
    requireActive: false,
    allowAdmin: true,
    authSession: realSession,
  });

  return isAdminSupportSession(effectiveSession)
    ? effectiveSession.adminSupport.targetUserId
    : null;
}

function readPauseReason(input: {
  activeSession: Awaited<ReturnType<typeof getActiveAdminWorkSession>>;
  supportTargetUserId: string | null;
  pathname?: unknown;
  browserActive?: boolean;
}): string | null {
  const activeSession = input.activeSession;
  if (!activeSession || activeSession.trackingActive) return null;
  const page = resolveAdminWorkPage(input.pathname ?? activeSession.currentPageKey);

  if (
    !page.isAdminArea &&
    input.supportTargetUserId &&
    input.supportTargetUserId !== activeSession.clientUserId
  ) {
    return `Paused because a different account is open. Return to ${activeSession.clientName} or Admin to continue.`;
  }
  if (input.browserActive === false) {
    return "Paused for inactivity. Move the mouse or press a key to continue.";
  }
  return "Timer is open, but time is paused until activity resumes.";
}

function responseForError(error: unknown, fallback: string) {
  if (error instanceof AdminWorkTrackerError) {
    return jsonError(error.message, error.status);
  }

  console.error(fallback, error);
  return jsonError(fallback, 500);
}

export async function GET(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response || !session) return response;

  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "active";

    if (view === "history") {
      const history = await getAdminWorkHistory({
        adminUserId: session.user.id,
        period: url.searchParams.get("period"),
        anchor: url.searchParams.get("anchor"),
        clientUserId: url.searchParams.get("clientUserId"),
      });
      const activeSession = await getActiveAdminWorkSession(session.user.id);
      return NextResponse.json({ ok: true, history, activeSession });
    }

    const [activeSession, supportTargetUserId] = await Promise.all([
      getActiveAdminWorkSession(session.user.id),
      readSupportTargetUserId(session),
    ]);
    return NextResponse.json({
      ok: true,
      activeSession,
      pauseReason: readPauseReason({ activeSession, supportTargetUserId }),
    });
  } catch (error) {
    return responseForError(error, "Failed to load the Admin work tracker.");
  }
}

export async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response || !session) return response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body.");
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";

  try {
    if (action === "start") {
      const supportTargetUserId = await readSupportTargetUserId(session);
      const activeSession = await startAdminWorkSession({
        adminUserId: session.user.id,
        clientUserId: body.clientUserId,
        pathname: body.pathname,
        supportTargetUserId,
      });
      return NextResponse.json({ ok: true, activeSession, message: `Work started for ${activeSession.clientName}.` });
    }

    if (action === "heartbeat") {
      const supportTargetUserId = await readSupportTargetUserId(session);
      const browserActive = body.browserActive === true;
      const activeSession = await heartbeatAdminWorkSession({
        adminUserId: session.user.id,
        sessionId: body.sessionId,
        pathname: body.pathname,
        browserActive,
        supportTargetUserId,
      });
      return NextResponse.json({
        ok: true,
        activeSession,
        pauseReason: readPauseReason({
          activeSession,
          supportTargetUserId,
          pathname: body.pathname,
          browserActive,
        }),
      });
    }

    if (action === "stop") {
      const stoppedSession = await stopAdminWorkSession({
        adminUserId: session.user.id,
        sessionId: body.sessionId,
      });
      return NextResponse.json({
        ok: true,
        activeSession: null,
        stoppedSession,
        message: stoppedSession
          ? `Work stopped for ${stoppedSession.clientName}.`
          : "No work timer was running.",
      });
    }

    return jsonError("Unsupported work tracker action.");
  } catch (error) {
    return responseForError(error, "The Admin work tracker action failed.");
  }
}

export async function PATCH(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response || !session) return response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body.");
  }

  try {
    const workSession = await updateAdminWorkSession({
      adminUserId: session.user.id,
      sessionId: body.sessionId,
      note: body.note,
      includeInReport: body.includeInReport,
      showTimesInReport: body.showTimesInReport,
      showNoteInReport: body.showNoteInReport,
    });
    return NextResponse.json({ ok: true, workSession, message: "Work session updated." });
  } catch (error) {
    return responseForError(error, "Failed to update the work session.");
  }
}
