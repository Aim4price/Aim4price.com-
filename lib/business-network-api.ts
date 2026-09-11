import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "./auth-session";
import { getAccountProfile } from "./account-profile";
import { isAim4priceAdminEmail } from "./account-constants";
export const businessHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
export function businessJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: businessHeaders });
}
export function businessError(e: unknown) {
  const message = e instanceof Error ? e.message : "";
  const safe =
    /^(Enter |Add |Choose |Confirm |Use |This |An asset|Too many|Refresh |The business)/.test(
      message,
    );
  if (!safe) console.error("Business network operation failed", { message });
  return businessJson(
    {
      ok: false,
      error: safe
        ? message
        : "Unable to complete this request. Please try again.",
    },
    message.startsWith("Too many") ? 429 : 400,
  );
}
export function requireBusinessOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new Error("This request must be sent from Aim4price.");
}
export async function businessBody(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") || 0) > 100000)
    throw new Error("This request is too large.");
  const text = await request.text();
  if (text.length > 100000) throw new Error("This request is too large.");
  const body = JSON.parse(text);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("This request is invalid.");
  return body;
}
export async function requireBusinessOwner() {
  const session = await getServerSession({
    allowOwnerApp: true,
    allowAdmin: true,
  });
  if (!session?.user?.id)
    throw new Error("This action requires an owner or admin login.");
  const profile = await getAccountProfile(session.user);
  if (
    !isAim4priceAdminEmail(session.user.email) &&
    (profile.accountType !== "owner" || profile.accountStatus !== "active")
  )
    throw new Error("This action requires an active owner account.");
  return session.user;
}
export function requestBusinessToken(request: NextRequest) {
  return request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
}
