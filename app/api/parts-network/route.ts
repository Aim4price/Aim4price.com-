import { NextRequest, NextResponse } from "next/server";
import { getPartsActor } from "../../../lib/parts-network-access";
import { isTrustedRequestOrigin } from "../../../lib/trusted-request-origin";
import {
  PartsError,
  resolvePartsShare,
  managePartsList,
  partsInbox,
  acceptDirectPartsShare,
  createPartsEnquiry,
  handlePartsEnquiry,
  listPartsNetworks,
  partsData,
  createPartsNetwork,
  invitePartsMember,
  revokePartsInvite,
  changePartsMember,
  partsInvitePin,
  importParts,
  setPartsVisibility,
  networkId,
} from "../../../lib/parts-network";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function reply(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
function failure(error: unknown) {
  if (error instanceof PartsError)
    return reply({ error: error.message }, error.status);
  console.error("Parts network request failed", error);
  return reply(
    {
      error:
        "The parts network could not complete this request. Please try again.",
    },
    500,
  );
}
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    const actor = await getPartsActor(Boolean(token));
    if (!actor)
      return reply(
        { error: "Sign in with an active dealer account with Parts access." },
        403,
      );
    if (token) return reply(await resolvePartsShare(actor, token));
    const q = request.nextUrl.searchParams;
    if (q.get("view") === "inbox") return reply(await partsInbox(actor));
    if (!q.has("network"))
      return reply({
        networks: await listPartsNetworks(actor),
        canContribute: actor.canContribute,
        staff: actor.staff,
      });
    return reply(
      await partsData(
        actor,
        networkId(q.get("network")),
        q.get("view") || "search",
        q.get("search") || "",
        Number(q.get("page") || 0),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    if (
      !isTrustedRequestOrigin(
        request.headers.get("origin"),
        request.nextUrl.origin,
      )
    )
      return reply({ error: "Invalid request origin." }, 403);
    // Bound the stream, not just Content-Length (which callers can omit).
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Request body required." }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_200_000) {
        await reader.cancel();
        return reply({ error: "Use a CSV smaller than 2 MB." }, 413);
      }
      chunks.push(value);
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error();
    } catch {
      return reply({ error: "Invalid request." }, 400);
    }
    const actor = await getPartsActor(
      body.action === "send-pin" || body.action === "accept",
    );
    if (!actor)
      return reply(
        {
          error:
            "Sign in with your dealer account. Active accounts are required for network access.",
        },
        403,
      );
    if (body.action === "create")
      return reply(await createPartsNetwork(actor, body.name, true));
    if (body.action === "send-pin")
      return reply(await partsInvitePin(actor, body.token));
    if (body.action === "accept")
      return reply(await partsInvitePin(actor, body.token, body.pin ?? ""));
    if (body.action === "accept-direct")
      return reply(await acceptDirectPartsShare(actor, body.id));
    if (body.action === "handle-enquiry") {
      await handlePartsEnquiry(actor, body.id);
      return reply({ ok: true });
    }
    const id = networkId(body.network);
    if (body.action === "rename" || body.action === "archive") {
      await managePartsList(actor, id, body.name, body.action === "archive");
      return reply({ ok: true });
    }
    if (body.action === "enquire") {
      await createPartsEnquiry(actor, id, body);
      return reply({ ok: true });
    }
    if (body.action === "invite")
      return reply(
        await invitePartsMember(actor, id, body.email, body.role, body.channel),
      );
    if (body.action === "revoke") {
      await revokePartsInvite(actor, id, body.id);
      return reply({ ok: true });
    }
    if (body.action === "member") {
      await changePartsMember(actor, id, body.dealerId, body.role, body.status);
      return reply({ ok: true });
    }
    if (body.action === "visibility") {
      await setPartsVisibility(actor, id, body.visible);
      return reply({ ok: true });
    }
    if (body.action === "preview" || body.action === "import") {
      return reply(
        await importParts(actor, id, body, body.action === "import"),
      );
    }
    return reply({ error: "Unknown action." }, 400);
  } catch (e) {
    return failure(e);
  }
}
