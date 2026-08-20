import { NextResponse } from "next/server";
import { isAim4priceAdminEmail } from "../../../../../lib/account-constants";
import { getAnyServerSession } from "../../../../../lib/auth-session";
import {
  AdminWorkTrackerError,
  getAdminWorkClient,
  getAdminWorkHistory,
} from "../../../../../lib/admin-work-tracker";
import { buildAdminWorkReportHtml } from "../../../../../lib/admin-work-tracker-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilename(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "account";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: Request) {
  const session = await getAnyServerSession();

  if (!session?.user?.id) return jsonError("Not authenticated.", 401);
  if (!isAim4priceAdminEmail(session.user.email)) {
    return jsonError("Admin access required.", 403);
  }

  const url = new URL(request.url);
  const clientUserId = url.searchParams.get("clientUserId")?.trim() || "";
  if (!clientUserId) return jsonError("Choose an account before opening a report.", 400);

  try {
    const [client, history] = await Promise.all([
      getAdminWorkClient(clientUserId),
      getAdminWorkHistory({
        adminUserId: session.user.id,
        clientUserId,
        period: url.searchParams.get("period"),
        anchor: url.searchParams.get("anchor"),
      }),
    ]);
    const html = buildAdminWorkReportHtml({ client, history });
    const filename = `${safeFilename(client.name)}-${history.period}-work-report.html`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:",
      },
    });
  } catch (error) {
    if (error instanceof AdminWorkTrackerError) {
      return jsonError(error.message, error.status);
    }
    console.error("Failed to build the Admin work report", error);
    return jsonError("Failed to build the work report.", 500);
  }
}
