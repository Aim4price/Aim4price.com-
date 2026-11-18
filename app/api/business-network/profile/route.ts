import { NextRequest } from "next/server";
import {
  getBusinessByToken,
  saveBusiness,
} from "../../../../lib/business-network";
import {
  businessBody,
  businessError,
  businessJson,
  requireBusinessOrigin,
  requestBusinessToken,
} from "../../../../lib/business-network-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    return businessJson({
      ok: true,
      business: await getBusinessByToken(requestBusinessToken(request)),
    });
  } catch (e) {
    return businessError(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    requireBusinessOrigin(request);
    const body = await businessBody(request);
    if (body.action !== "pause") return businessJson({ error: "Directory listings have closed." }, 410);
    await saveBusiness(requestBusinessToken(request), body);
    return businessJson({ ok: true });
  } catch (e) {
    return businessError(e);
  }
}
