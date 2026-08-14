import { NextRequest, NextResponse } from "next/server";
import {
  getAccountProfile,
  upsertAccountProfile,
  type UpsertAccountProfileInput,
} from "../../../lib/account-profile";
import { setOwnerDiscoveryParticipation } from "../../../lib/asset-discovery";
import {
  getServerSession,
  isDealerAppSession,
} from "../../../lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () =>
  NextResponse.json(
    { ok: false, error: "You must be signed in." },
    { status: 401 },
  );

export async function GET() {
  const session = await getServerSession({
    allowDealerApp: true,
    allowOwnerApp: true,
  });
  if (!session?.user?.id) return unauthorized();

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (isDealerAppSession(session)) {
    return NextResponse.json({
      ok: true,
      profile: {
        displayName: profile.displayName,
        businessName: profile.businessName,
        accountType: "dealer",
        accountStatus: profile.accountStatus,
        province: profile.province,
        townCity: profile.townCity,
        marketplaceSellerName: profile.marketplaceSellerName,
        marketplacePhone: profile.marketplacePhone,
        marketplaceEmail: profile.marketplaceEmail,
        marketplaceLocation: profile.marketplaceLocation,
        logoUrl: profile.logoUrl,
        phone: profile.phone,
        websiteUrl: profile.websiteUrl,
      },
    });
  }

  return NextResponse.json({ ok: true, profile });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession({
    allowDealerApp: true,
    allowOwnerApp: true,
  });
  if (!session?.user?.id) return unauthorized();
  if (isDealerAppSession(session)) {
    return NextResponse.json(
      { ok: false, error: "Dealer App staff cannot edit account settings." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | UpsertAccountProfileInput
    | null;
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Send valid account settings." },
      { status: 400 },
    );
  }

  try {
    const current = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    const participationWasProvided =
      typeof body.discoveryParticipationEnabled === "boolean";

    if (participationWasProvided && current.accountType !== "owner") {
      return NextResponse.json(
        {
          ok: false,
          error: "Only an owner can change Discovery participation.",
        },
        { status: 403 },
      );
    }

    const {
      discoveryParticipationEnabled,
      ...profileInput
    } = body;
    await upsertAccountProfile(
      {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      profileInput,
    );

    if (participationWasProvided) {
      await setOwnerDiscoveryParticipation({
        ownerUserId: session.user.id,
        enabled: discoveryParticipationEnabled === true,
      });
    }

    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    console.error("account profile PUT failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to save account settings." },
      { status: 500 },
    );
  }
}
