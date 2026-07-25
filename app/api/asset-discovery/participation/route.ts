import { NextRequest, NextResponse } from "next/server";
import { getAccountProfile } from "../../../../lib/account-profile";
import { setOwnerDiscoveryParticipation } from "../../../../lib/asset-discovery";
import { getServerSession } from "../../../../lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "You must be signed in." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    enabled?: unknown;
  } | null;
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "Choose whether to participate in Discovery." },
      { status: 400 },
    );
  }

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    if (profile.accountType !== "owner") {
      return NextResponse.json(
        {
          ok: false,
          error: "Only an owner can change Discovery participation.",
        },
        { status: 403 },
      );
    }

    const access = await setOwnerDiscoveryParticipation({
      ownerUserId: session.user.id,
      enabled: body.enabled,
    });
    return NextResponse.json({ ok: true, access });
  } catch (error) {
    console.error("asset-discovery participation PATCH failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update Discovery participation." },
      { status: 500 },
    );
  }
}
