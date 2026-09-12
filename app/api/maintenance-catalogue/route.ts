import { NextResponse } from "next/server";
import { getMaintenanceCatalogue } from "../../../lib/maintenance-catalogue-db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// This endpoint contains only equipment checklist definitions, never account data.
export async function GET() {
  try {
    return NextResponse.json(
      { catalogue: await getMaintenanceCatalogue() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Catalogue unavailable." },
      { status: 503 },
    );
  }
}
