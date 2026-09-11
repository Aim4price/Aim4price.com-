import { NextRequest, NextResponse } from "next/server";
import { getSiteOrigin } from "../../../../lib/email";
import { getBusinessRequest } from "../../../../lib/business-network";
import { resolveAssetRegisterUploadBytes } from "../../../../lib/asset-register-uploads";
import {
  businessError,
  businessJson,
  businessHeaders,
  requestBusinessToken,
} from "../../../../lib/business-network-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const view = await getBusinessRequest(requestBusinessToken(request));
    if (request.nextUrl.searchParams.has("asset")) {
      const asset = Number(request.nextUrl.searchParams.get("asset")),
        photo = Number(request.nextUrl.searchParams.get("photo"));
      if (!Number.isInteger(asset) || !Number.isInteger(photo))
        throw new Error("This photo is unavailable.");
      const url = view.assets[asset]?.photos[photo];
      if (!url) throw new Error("This photo is unavailable.");
      const parsed = new URL(url, getSiteOrigin());
      const local =
        parsed.hostname.replace(/^www\./, "") ===
        new URL(getSiteOrigin()).hostname.replace(/^www\./, "");
      const match = (local ? parsed.pathname : "").match(
        /^\/api\/asset-register\/uploads\/([a-zA-Z0-9_-]+)(?:\?.*)?$/,
      );
      if (match) {
        const result = await resolveAssetRegisterUploadBytes(match[1]);
        if (
          result.status !== "ready" ||
          !["image/jpeg", "image/png", "image/webp"].includes(
            result.upload.mimeType,
          )
        )
          throw new Error("This photo is unavailable.");
        return new NextResponse(new Uint8Array(result.upload.data), {
          headers: {
            ...businessHeaders,
            "Content-Type": result.upload.mimeType,
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (/^https:\/\//.test(url)) return businessJson({ ok: true, url });
      throw new Error("This photo is unavailable.");
    }
    return businessJson({
      ok: true,
      view: {
        ...view,
        assets: view.assets.map((a) => ({
          ...a,
          photos: a.photos.map((_, i) => String(i)),
        })),
      },
    });
  } catch (e) {
    return businessError(e);
  }
}
