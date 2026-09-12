import { NextRequest, NextResponse } from "next/server";
import { getAnyServerSession } from "../../../../lib/auth-session";
import { isAim4priceAdminEmail } from "../../../../lib/account-constants";
import {
  getMaintenanceCatalogue,
  saveMaintenanceCatalogue,
} from "../../../../lib/maintenance-catalogue-db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function admin() {
  const session = await getAnyServerSession();
  return session?.user?.id && isAim4priceAdminEmail(session.user.email)
    ? session.user
    : null;
}
export async function GET() {
  if (!(await admin())) return json({ error: "Admin access required." }, 403);
  try {
    return json({ catalogue: await getMaintenanceCatalogue() });
  } catch {
    return json({ error: "Could not load maintenance catalogue." }, 503);
  }
}
export async function PUT(request: NextRequest) {
  const user = await admin();
  if (!user) return json({ error: "Admin access required." }, 403);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Invalid request origin." }, 403);
  try {
    if (Number(request.headers.get("content-length") || 0) > 2500000)
      return json({ error: "Import is too large." }, 413);
    const bodyText = await request.text();
    if (bodyText.length > 2500000)
      return json({ error: "Import is too large." }, 413);
    const body = JSON.parse(bodyText);
    const catalogue = await saveMaintenanceCatalogue(
      body.catalogue,
      body.expectedVersion,
      user.id,
    );
    return json({ catalogue });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message.startsWith("Catalogue changed"))
      return json({ error: message }, 409);
    if (
      /^(Invalid |Each checklist|Checklist items|Keep |Family references|Advanced family|Duplicate family)/.test(
        message,
      )
    )
      return json({ error: message }, 400);
    return json(
      {
        error: "Could not save the catalogue. Check the import and try again.",
      },
      400,
    );
  }
}
