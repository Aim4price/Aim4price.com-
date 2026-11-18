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
  requireBusinessOwner,
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
      if (!session?.user?.id) return businessJson({ok:false,error:"Sign in to find a business."},403);
      if (session?.user?.id && isAim4priceAdminEmail(session.user.email)) {
        lookupId = `admin:${session.user.id}`;
      } else {
        const owner = await requireBusinessOwner();
        lookupId = `owner:${owner.id}`;
      }
    }
    await limitBusinessAction(`google:${lookupId}`, 20);
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key)
      return businessJson(
        {
          ok: false,
          error:
            "Google search is not configured on this site. Enter the business manually or open Google Maps.",
        },
        503,
      );
    const body = await businessBody(request);
    if (body.placeId !== undefined) {
      const placeId = businessText(body.placeId, 250);
      if (!/^[A-Za-z0-9_-]{1,250}$/.test(placeId))
        throw new Error("Choose a valid Google business.");
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
        {
          cache: "no-store",
          headers: {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,location,nationalPhoneNumber,websiteUri,googleMapsUri,primaryTypeDisplayName,attributions,businessStatus",
          },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok)
        throw new Error("This business detail lookup is unavailable. Try again or enter the business manually.");
      const place = await response.json();
      if (place.id !== placeId)
        throw new Error("This Google business could not be confirmed. Search again.");
      return businessJson({ ok: true, place });
    }
    const query = businessText(body.query);
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
