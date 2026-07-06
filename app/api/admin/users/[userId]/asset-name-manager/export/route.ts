import { NextRequest, NextResponse } from "next/server";
import { isAim4priceAdminEmail } from "../../../../../../../lib/account-constants";
import { findAdminUserEmail } from "../../../../../../../lib/admin-users";
import {
  buildAdminAssetNameTemplateFileName,
  createAdminAssetNameTemplateCsv,
} from "../../../../../../../lib/admin-asset-name-manager";
import { getAnyServerSession } from "../../../../../../../lib/auth-session";

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

function cleanUserId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .slice(0, 200);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { userId: string } },
) {
  const { response } = await requireAdminSession();

  if (response) {
    return response;
  }

  const userId = cleanUserId(params.userId);

  if (!userId) {
    return jsonError("Missing user ID.");
  }

  try {
    const email = await findAdminUserEmail(userId);
    const csv = await createAdminAssetNameTemplateCsv(userId);
    const fileName = buildAdminAssetNameTemplateFileName(email);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export admin asset name CSV template", error);
    return jsonError(
      error instanceof Error
        ? error.message
        : "Failed to export asset name CSV template.",
      500,
    );
  }
}
