import { getAnyServerSession } from "../../../../lib/auth-session";
import { isAim4priceAdminEmail } from "../../../../lib/account-constants";
import { NextRequest } from "next/server";
import {
  getBusinessByToken,
  limitBusinessAction,
} from "../../../../lib/business-network";
import {
  businessBody,
  businessError,
  businessJson,
  requireBusinessOrigin,
  requestBusinessToken,
} from "../../../../lib/business-network-api";
import { businessText } from "../../../../lib/business-network-shared";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    requireBusinessOrigin(request);
    const token = requestBusinessToken(request);
    let lookupId: string;
    if (token) {
      lookupId = (await getBusinessByToken(token)).id;
    } else {
      const session = await getAnyServerSession();
      if (!session?.user?.id || !isAim4priceAdminEmail(session.user.email))
        return businessJson(
          { ok: false, error: "Admin access required." },
          403,
        );
      lookupId = `admin:${session.user.id}`;
    }
    await limitBusinessAction(`google:${lookupId}`, 20);
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key)
      return businessJson(
        {
          ok: false,
          error:
            "Google search is not available yet. You can add your Google Maps link and business details below.",
        },
        503,
      );
    const body = await businessBody(request),
      query = businessText(body.query);
    if (query.length < 3) throw new Error("Enter your business name and town.");
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.primaryTypeDisplayName,places.googleMapsUri",
        },
        body: JSON.stringify({
          textQuery: query,
          regionCode: "ZA",
          maxResultCount: 5,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      throw new Error(
        "This Google search is unavailable. Add your details manually.",
      );
    const payload = await response.json();
    return businessJson({ ok: true, places: payload.places || [] });
  } catch (e) {
    return businessError(e);
  }
}
