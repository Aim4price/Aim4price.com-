import { NextRequest, NextResponse } from "next/server";
import {
  createInitialAccountProfile,
  getAccountStatusForUser,
} from "../../../../lib/account-profile";
import { getAnyServerSession } from "../../../../lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNUP_ACCOUNT_TYPES = new Set([
  "owner",
  "finance",
  "insurance",
  "dealer",
  "licensing",
]);

export async function POST(request: NextRequest) {
  const session = await getAnyServerSession();

  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "You must be signed in." },
      { status: 401 },
    );
  }

  const accountStatus = await getAccountStatusForUser({
    id: session.user.id,
    email: session.user.email,
  });

  if (accountStatus !== "pending_payment") {
    return NextResponse.json(
      { ok: false, error: "The account type is locked after activation." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Send valid signup details." },
      { status: 400 },
    );
  }

  const accountType =
    typeof body.accountType === "string" ? body.accountType.trim() : "";

  if (!SIGNUP_ACCOUNT_TYPES.has(accountType)) {
    return NextResponse.json(
      { ok: false, error: "Choose a valid account type." },
      { status: 400 },
    );
  }

  await createInitialAccountProfile(
    {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    {
      accountType,
      accountSubtype: body.accountSubtype,
      province: body.province,
      townCity: body.townCity,
      partnerDirectoryEnabled: body.partnerDirectoryEnabled,
      phone: body.phone,
    },
  );

  return NextResponse.json({ ok: true });
}
