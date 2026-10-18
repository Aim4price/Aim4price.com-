import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "./auth-session";
import { getAssetRegisterAccountAccess } from "./asset-register-account-access";
import { getAssetRegisterItemById } from "./asset-register-db";
import { isTrustedRequestOrigin } from "./trusted-request-origin";
export const trackingJson = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function trackingOwner(request: NextRequest, assetId: string) {
  if (
    !["GET", "HEAD"].includes(request.method) &&
    !isTrustedRequestOrigin(
      request.headers.get("origin"),
      request.nextUrl.origin,
    )
  )
    return trackingJson({ error: "Invalid request origin." }, 403);
  const session = await getServerSession({ allowDealerApp: true });
  if (!session || !(await getAssetRegisterAccountAccess(session)))
    return trackingJson({ error: "Sign in to manage tracking." }, 403);
  if (!/^[0-9a-f-]{36}$/i.test(assetId))
    return trackingJson({ error: "Invalid asset." }, 400);
  const asset = await getAssetRegisterItemById(session.user.id, assetId);
  if (!asset) return trackingJson({ error: "Asset unavailable." }, 404);
  return { ownerId: session.user.id, asset };
}
export async function smallTrackingBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("INVALID_UPLOAD");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65536) {
      await reader.cancel();
      throw Error("INVALID_UPLOAD");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Error("INVALID_UPLOAD");
  }
}
