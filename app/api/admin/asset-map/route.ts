import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "../../../../lib/admin-api-access";
import { getAdminAssetMapReport } from "../../../../lib/admin-global-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;

  try {
    const report = await getAdminAssetMapReport();
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    console.error("admin global asset map GET failed", error);
    return NextResponse.json(
      { ok: false, error: "The global asset map could not be loaded." },
      { status: 500 },
    );
  }
}
