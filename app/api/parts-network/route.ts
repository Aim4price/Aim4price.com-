import { TeamAccessError } from '../../../lib/team-access-policy';
import { NextRequest, NextResponse } from "next/server";
import { getPartsActor } from "../../../lib/parts-network-access";
import { isTrustedRequestOrigin } from "../../../lib/trusted-request-origin";
import {
  PartsError,
  partsRecipients,
  resolvePartsShare,
  managePartsList,
  partsInbox,
  acceptDirectPartsShare,
  createPartsEnquiry,
  handlePartsEnquiry,
  listPartsNetworks,
  partsData,
  partsReportOwnerId,
  createPartsNetwork,
  invitePartsMember,
  revokePartsInvite,
  changePartsMember,
  partsInvitePin,
  importParts,
  editPartsRow,
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
  if (error instanceof Error && error.message === 'Your monthly Business credits have been used.') return reply({error:error.message,code:'BUSINESS_CREDIT_LIMIT'},402);
  if (error instanceof PartsError || error instanceof TeamAccessError)
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
    const actor = await getPartsActor(Boolean(token), request.nextUrl.searchParams.get("desktopMembershipId") || undefined);
    if (!actor)
      return reply(
        { error: "Sign in to view parts shared with your account." },
        403,
      );
    if (token) return reply(await resolvePartsShare(actor, token));
    const q = request.nextUrl.searchParams;
    if (q.get("view") === "recipients")
      return reply(
        await partsRecipients(
          actor,
          networkId(q.get("network")),
          q.get("search") || "",
          q.get("area") || "",
        ),
      );
    if (q.get("view") === "inbox") return reply(await partsInbox(actor));
    if (!q.has("network"))
      return reply({
        networks: await listPartsNetworks(actor),
        canContribute: actor.canContribute,
        staff: actor.staff,
        desktop: Boolean(actor.team),
      });
    if (q.get("format") === "pdf" || q.get("format") === "xlsx") {
      const data = await partsData(actor, networkId(q.get("network")), q.get("view") === "mine" ? "mine" : "search", q.get("search") || "", 0, true);
      const { buildPartsStockReportHtml } = await import("../../../lib/parts-network-report");
      const { renderReportHtmlToPdf } = await import("../../../lib/report-pdf");
      const { normaliseReportPdfFileName } = await import("../../../lib/report-pdf-request");
      const { getAssetRegisterReportLogoUrl } = await import("../../../lib/asset-registers");
      const { resolveReportLogoUrlForHtml } = await import("../../../lib/report-logo");
      const ownerId = await partsReportOwnerId(actor, networkId(q.get("network")));
      const rawLogoUrl = await getAssetRegisterReportLogoUrl(ownerId).catch(() => "");
      const logoUrl = await resolveReportLogoUrlForHtml(rawLogoUrl, request.url);
      const included = q.get("vat") === "incl";
      const vat = included ? "Incl. VAT" : "Excl. VAT";
      const title = (q.get("title") || "Parts stock list").slice(0, 150);
      const rows = (data.rows || []).map(row => ({
        details:Object.fromEntries((data.fields || []).filter(f=>row.details?.[f.id]).map(f=>[f.label+(f.private ? " (private)" : ""),row.details[f.id]])),
        part: row.part_number, description: row.description || "", brand: row.brand || "", quantity: row.quantity,
        price: row.price === null ? null : Number((Number(row.price) * (row.vat_included === included ? 1 : included ? 1.15 : 1 / 1.15)).toFixed(2)),
        vat, dealer: row.business_name, town: row.town || "",
      }));
      const countReport = async () => {
        if (actor.metered) await (await import('../../../lib/business-credits')).recordBusinessReport(actor.id,'Generated a parts report',[q.get('network'),vat,rows]);
      };
      if (q.get("format") === "xlsx") {
        const {buildPartsWorkbook} = await import("../../../lib/parts-network-report");
        const book = await buildPartsWorkbook(rows);
        const bytes = new Uint8Array(await book.xlsx.writeBuffer());
        await countReport();
        return new NextResponse(bytes,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Cache-Control':'private, no-store'}});
      }
      const scope = q.get("search")?.trim() ? `Matching parts for “${q.get("search")!.trim()}”` : "Complete parts list";
      const date = new Intl.DateTimeFormat("en-ZA", {dateStyle:"medium",timeZone:"Africa/Johannesburg"}).format(new Date());
      const pdf = await renderReportHtmlToPdf(buildPartsStockReportHtml(title, rows, vat, scope, date, {logoUrl}), {baseUrl:request.url,cookie:request.headers.get("cookie") || ""});
      const filename = normaliseReportPdfFileName(title).replace(/[^\x20-\x7e]/g, "_");
      await countReport();
      return new NextResponse(pdf, {headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${filename}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
    }
    return reply(
      await partsData(
        actor,
        networkId(q.get("network")),
        q.get("view") || "search",
        q.get("search") || "",
        Number(q.get("page") || 0),
        q.get("download") === "true",
        q.get("pageSize") === "all" ? "all" : Number(q.get("pageSize") || 50),
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
        return reply({ error: "Use a parts table smaller than 2 MB." }, 413);
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
      request.nextUrl.searchParams.get("desktopMembershipId") || undefined,
    );
    if (!actor)
      return reply(
        {
          error:
            "Sign in with your dealer account. Active accounts are required for network access.",
        },
        403,
      );
    if (actor.team && !["preview", "import", "edit-part"].includes(String(body.action))) return reply({error:"Stocklist administration and external communication stay with the account holder."},403);
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
    if (["create-share","share-history","update-share","revoke-share","delete-share"].includes(String(body.action))) {
      const { managePartsShare } = await import("../../../lib/parts-share");
      return reply(await managePartsShare(actor, id, body));
    }
    if (body.action === "edit-part") return reply(await editPartsRow(actor, id, body));
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
