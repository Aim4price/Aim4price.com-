import { NextRequest, NextResponse } from "next/server";
import { getAccountProfile } from "../../../lib/account-profile";
import { getServerSession } from "../../../lib/auth-session";
import {
  createAssetDiscoveryEnquiry,
  listAssetDiscoveryAssets,
} from "../../../lib/asset-discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateBody = {
  assetId?: unknown;
  message?: unknown;
};

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "You must be signed in." },
    { status: 401 },
  );
}

function forbidden() {
  return NextResponse.json(
    {
      ok: false,
      error: "Discovery is available to active dealer accounts only.",
    },
    { status: 403 },
  );
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveIntParam(value: string | null, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0
    ? Math.trunc(numeric)
    : fallback;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) return unauthorized();

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });

    if (profile.accountType !== "dealer") return forbidden();

    const { searchParams } = request.nextUrl;
    const result = await listAssetDiscoveryAssets({
      dealerUserId: session.user.id,
      search: searchParams.get("search") ?? undefined,
      province: searchParams.get("province") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      page: positiveIntParam(searchParams.get("page"), 1),
      pageSize: positiveIntParam(searchParams.get("pageSize"), 10),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("asset-discovery GET failed", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error, "Failed to load Discovery.") },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) return unauthorized();

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Send a valid enquiry." },
      { status: 400 },
    );
  }

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });

    if (profile.accountType !== "dealer") return forbidden();

    const enquiry = await createAssetDiscoveryEnquiry({
      dealerUserId: session.user.id,
      assetId: asText(body.assetId),
      message: asText(body.message),
    });

    return NextResponse.json({ ok: true, enquiry });
  } catch (error) {
    console.error("asset-discovery POST failed", error);
    const message = errorMessage(error, "Failed to send enquiry.");
    const status = message.includes("not available")
      ? 404
      : message.includes("again after") || message.includes("pending")
        ? 409
        : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
