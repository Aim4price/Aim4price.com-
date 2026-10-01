import { licenceShareMissingDetails, licenceShareRenewalDate } from "./licence-share-readiness";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb } from "./db";
import { sendAim4priceEmail, getSiteOrigin } from "./email";
import { getAccountProfile } from "./account-profile";
import { getAssetRegisterItemById } from "./asset-register-db";
import type { PartnerDirectoryEntry } from "./partner-access";
import type { PartnerMapBounds } from "./partner-access";
import {
  businessText,
  businessEmail,
  businessCoversLocation,
  validateBusinessDetails,
  type BusinessDetails,
  type BusinessLeadView,
} from "./business-network-shared";

export const BUSINESS_SCHEMA = `
create table if not exists business_network (
 id uuid primary key, email text not null unique, name text not null,
 status text not null default 'invited' check(status in ('invited','active','paused')),
 details jsonb not null default '{}', invited_by text not null,
 accepted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists business_network_google_place on business_network ((details->>'googlePlaceId')) where status = 'active' and coalesce(details->>'googlePlaceId','') <> '';
create table if not exists business_network_tokens (
 hash text primary key, business_id uuid not null references business_network(id),
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists business_network_requests (
 id uuid primary key, owner_id text not null, business_id uuid not null references business_network(id),
 request_key text not null, token_hash text not null unique, snapshot jsonb not null,
 status text not null default 'pending' check(status in ('pending','sent','failed')),
 expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now(),
 unique(owner_id, business_id, request_key)
);
alter table business_network_requests add column if not exists live_share_token text;
create table if not exists business_network_rate_limits (
 key text primary key, count integer not null, started_at timestamptz not null default now()
);`;
let schema: Promise<void> | undefined;
export async function ensureBusinessNetwork() {
  if (!schema)
    schema = getDb()
      .query(BUSINESS_SCHEMA)
      .then(() => {})
      .catch((e) => {
        schema = undefined;
        throw e;
      });
  await schema;
}
export const hashBusinessToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function readBusinessToken(value: string | null): string {
  if (!value || !/^[a-f0-9]{64}$/.test(value))
    throw new Error("This link is invalid or has expired.");
  return value;
}
export async function limitBusinessAction(key: string, limit = 10) {
  await ensureBusinessNetwork();
  const result = await getDb().query<{ count: number }>(
    `insert into business_network_rate_limits (key,count) values ($1,1)
    on conflict(key) do update set count = case when business_network_rate_limits.started_at < now() - interval '1 hour' then 1 else business_network_rate_limits.count + 1 end,
    started_at = case when business_network_rate_limits.started_at < now() - interval '1 hour' then now() else business_network_rate_limits.started_at end returning count`,
    [hashBusinessToken(key)],
  );
  if (result.rows[0].count > limit)
    throw new Error("Too many requests. Please try again later.");
}
function requireEmailDelivery() {
  if (!process.env.RESEND_API_KEY)
    throw new Error(
      "This email service is not configured yet. Please contact Aim4price.",
    );
}
const esc = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function businessEmailHtml(title: string, body: string) {
  return `<div style="font-family:Montserrat,Arial,sans-serif;color:#153d31;max-width:640px;margin:auto;padding:24px"><p style="font-weight:700">Aim4price</p><h2>${esc(title)}</h2>${body}<p style="font-size:12px">Know what you have, know what it’s worth, know what it costs.</p></div>`;
}
async function newManagementToken(id: string) {
  const token = randomBytes(32).toString("hex");
  await getDb().query(
    `insert into business_network_tokens(hash,business_id,expires_at) values($1,$2,now()+interval '30 days')`,
    [hashBusinessToken(token), id],
  );
  return token;
}
export async function inviteBusiness(
  ownerId: string,
  nameInput: unknown,
  emailInput: unknown,
) {
  requireEmailDelivery();
  const email = businessEmail(emailInput),
    name = businessText(nameInput);
  if (name.length < 2) throw new Error("Enter the business name.");
  await limitBusinessAction(`invite-owner:${ownerId}`, 20);
  await limitBusinessAction(`invite-email:${email}`, 3);
  const result = await getDb().query<{
    id: string;
    name: string;
    status: string;
  }>(
    `insert into business_network(id,email,name,invited_by) values($1,$2,$3,$4)
    on conflict(email) do update set email=excluded.email returning id,name,status`,
    [randomUUID(), email, name, ownerId],
  );
  const business = result.rows[0];
  const token = await newManagementToken(business.id);
  const url = `${getSiteOrigin()}/business-network/join#${token}`;
  const title =
    business.status === "invited"
      ? "You’re invited to join Aim4price"
      : "Manage your Aim4price business listing";
  await sendAim4priceEmail({
    to: email,
    subject: title,
    text: `${business.name}, list your business for free and receive asset enquiries by email or WhatsApp. No login required. Only after you accept will your business be visible to all Aim4price owners. Confirm your details: ${url}`,
    html: businessEmailHtml(
      title,
      `<p>${esc(business.name)}, receive asset enquiries by email or WhatsApp. Joining is free and no login is needed.</p><p>Your listing becomes visible to all Aim4price owners only when you accept.</p><p><a href="${esc(url)}">${business.status === "invited" ? "Review invitation" : "Manage listing"}</a></p><p>If you are not interested, ignore this email. This link expires in 30 days.</p>`,
    ),
  });
}
export async function getBusinessByToken(rawToken: string) {
  await ensureBusinessNetwork();
  const token = readBusinessToken(rawToken);
  const result = await getDb().query<{
    id: string;
    name: string;
    email: string;
    status: string;
    details: Partial<BusinessDetails>;
  }>(
    `select b.id,b.name,b.email,b.status,b.details from business_network b join business_network_tokens t on t.business_id=b.id where t.hash=$1 and t.expires_at>now()`,
    [hashBusinessToken(token)],
  );
  if (!result.rows[0]) throw new Error("This link is invalid or has expired.");
  return result.rows[0];
}
export async function saveBusiness(
  token: string,
  input: Record<string, unknown>,
) {
  const b = await getBusinessByToken(token);
  if (input.action === "pause") {
    await getDb().query(
      `update business_network set status='paused',updated_at=now() where id=$1`,
      [b.id],
    );
    return;
  }
  if (input.accepted !== true)
    throw new Error(
      "Confirm that you want your business listed and to receive requests.",
    );
  const details = validateBusinessDetails(input, b.email);
  try {
    await getDb().query(
      `update business_network set name=$2,details=$3,accepted_at=coalesce(accepted_at,now()),updated_at=now() where id=$1`,
      [b.id, details.name, JSON.stringify(details)],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      throw new Error(
        "This Google business is already listed. Contact Aim4price to update its contact email.",
      );
    throw e;
  }
}
export async function listExternalBusinesses(input: {
  partnerType?: string | null;
  search?: string | null;
  area?: string | null;
  bounds?: PartnerMapBounds | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<PartnerDirectoryEntry[]> {
  await ensureBusinessNetwork();

  const result = await getDb().query<{
    id: string;
    email: string;
    details: BusinessDetails;
  }>(
    `select id,email,details from business_network where status='active' and accepted_at is not null order by name limit 1000`,
  );
  const query = (input.search || "").trim().toLowerCase();
  return result.rows
    .filter(({ details: b }) => {
      // Published businesses are recipients, not a category-based marketplace.
      if (query && !b.name.toLowerCase().includes(query)) return false;
      const areaParts = (input.area || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
      if (!b.nationwide && !areaParts.every(area => `${b.town} ${b.address}`.toLowerCase().includes(area))) return false;
      const bounds = input.bounds;
      const latitude =
        input.latitude ?? (bounds ? (bounds.south + bounds.north) / 2 : null);
      const longitude =
        input.longitude ?? (bounds ? (bounds.west + bounds.east) / 2 : null);
      return (
        latitude == null ||
        longitude == null ||
        businessCoversLocation(b, latitude, longitude)
      );
    })
    .map(({ id, email, details: b }) => ({
      userId: `external:${id}`,
      googlePlaceId: b.googlePlaceId,
      partnerType: (input.partnerType || "dealer") as PartnerDirectoryEntry["partnerType"],
      accountSubtype: "external-business",
      displayName: b.name,
      businessName: b.name,
      phone: b.phone,
      email,
      province: "",
      townCity: b.town,
      addressLine1: b.address,
      logoUrl: "",
      websiteUrl: b.website,
      extraPhotoUrls: [],
      description: "",
      latitude: b.latitude,
      longitude: b.longitude,
      serviceRadiusKm: b.nationwide ? null : b.radiusKm,
      brandFocus: "",
      services: "",
      isExternalBusiness: true,
      googleMapsUrl:
        b.googleMapsUrl ||
        (b.googlePlaceId
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name)}&query_place_id=${encodeURIComponent(b.googlePlaceId)}`
          : ""),
      serviceAreaNotice: b.nationwide
        ? "Nationwide"
        : `Within ${b.radiusKm} km`,
    }));
}
export async function buildBusinessLeadView(
  user: { id: string; name?: string | null; email?: string | null },
  input: Record<string, unknown>,
): Promise<{ businessId: string; email: string; view: BusinessLeadView }> {
  await ensureBusinessNetwork();
  const id = businessText(input.partnerUserId).replace(/^external:/, "");
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new Error("Choose an available business.");
  const business = (
    await getDb().query<{ id: string; email: string; name: string }>(
      `select id,email,name from business_network where id=$1 and status='active'`,
      [id],
    )
  ).rows[0];
  if (!business)
    throw new Error("This business is no longer receiving requests.");
  const ids = Array.isArray(input.assetIds)
    ? [...new Set(input.assetIds.map((v) => businessText(v)))]
    : [businessText(input.assetId)];
  if (
    !ids.length ||
    ids.length > 250 ||
    ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))
  )
    throw new Error("Choose valid assets.");
  if (ids.length > 1 && !businessText(input.assetGroupId))
    throw new Error(
      "Use an umbrella to share multiple assets with this business.",
    );
  if (ids.length > 1) {
    // Membership must be checked against the actual umbrella, not client snapshot data.
    const { getAssetGroupById } = await import("./asset-groups");
    const group = await getAssetGroupById(
      user.id,
      businessText(input.assetGroupId),
    );
    if (
      !group ||
      ids.some((id) => !group.members.some((member) => member.assetId === id))
    )
      throw new Error("Choose assets from your umbrella.");
  }
  const profile = await getAccountProfile(user);
  const email = businessEmail(profile.marketplaceEmail || user.email);
  const sections =
    input.includedSections && typeof input.includedSections === "object"
      ? (input.includedSections as Record<string, unknown>)
      : {};
  const assets: BusinessLeadView["assets"] = [];
  for (const id of ids) {
    const a = await getAssetRegisterItemById(user.id, id);
    if (!a)
      throw new Error("An asset is unavailable or does not belong to you.");
    if (input.leadType === 'license_renewal' && licenceShareMissingDetails(a).length) {
      throw new Error('Every selected asset must be licensed and have a valid renewal date.');
    }
    const values: Array<[string, unknown]> = [
      ["Brand", a.brandName],
      ["Model", a.modelName || a.typedModelName],
      ["Year", a.yearModel],
      ["Hours", a.hours],
      ["Condition", a.condition],
      ["Serial number", a.serialNumber],
      ["Registration", a.licenseRegistrationNumber],
    ];
    if (input.leadType === 'license_renewal') {
      values.push(['Licence status', 'Licensed'], ['Renewal / expiry date', licenceShareRenewalDate(a)]);
    }
    if (sections.valuationSummary === true)
      values.push([
        "Estimated value (excl. VAT)",
        `R ${Math.round(a.selectedValueExVat || a.value).toLocaleString("en-ZA")}`,
      ]);
    // Deliberate allowlist: never serialize specs, documents, report URLs, ledgers or live permissions.
    assets.push({
      title: a.title,
      details: values
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => [k, String(v)]),
      photos:
        sections.photos === true
          ? a.photos.slice(0, 12)
          : sections.mainPhoto === true
            ? a.photos.slice(0, 1)
            : [],
    });
  }
  return {
    businessId: business.id,
    email: business.email,
    view: {
      businessName: business.name,
      message: businessText(input.ownerMessage, 5000),
      contact: {
        name: profile.businessName || profile.name || user.name || "Owner",
        email,
        phone: profile.phone || "",
        additional: businessText(input.additionalContact, 500),
      },
      umbrella: businessText(input.assetGroupName),
      assets,
    },
  };
}
export async function sendBusinessLead(
  user: { id: string; name?: string | null; email?: string | null },
  input: Record<string, unknown>,
) {
  requireEmailDelivery();
  const { businessId, email, view } = await buildBusinessLeadView(user, input);
  const key = businessText(input.requestKey, 80);
  if (!/^[0-9a-f-]{36}$/i.test(key))
    throw new Error("Refresh the preview before sending.");
  await limitBusinessAction(`share:${user.id}`, 40);
  const id = randomUUID(),
    token = randomBytes(32).toString("hex");
  const inserted = await getDb().query<{ id: string }>(
    `insert into business_network_requests(id,owner_id,business_id,request_key,token_hash,snapshot,expires_at) values($1,$2,$3,$4,$5,$6,now()+interval '30 days') on conflict(owner_id,business_id,request_key) do nothing returning id`,
    [
      id,
      user.id,
      businessId,
      key,
      hashBusinessToken(token),
      JSON.stringify(view),
    ],
  );
  if (!inserted.rows.length) {
    const existing = (
      await getDb().query<{ status: string }>(
        `select status from business_network_requests where owner_id=$1 and request_key=$2 and business_id=$3`,
        [user.id, key, businessId],
      )
    ).rows[0];
    if (existing?.status === "sent") return;
    throw new Error(
      "This request is already being processed or delivery failed. Refresh the preview to try again.",
    );
  }
  let liveToken: string | undefined;
  try {
  const {createGuestLead}=await import('./guest-leads');
  const {getAssetGroupById}=await import('./asset-groups');
  const group=input.assetGroupId?await getAssetGroupById(user.id,String(input.assetGroupId)):null;
  const ids=group?group.members.map(member=>member.assetId):Array.isArray(input.assetIds)?input.assetIds:[input.assetId];
  const sections=input.includedSections as Record<string,unknown>|undefined;
  const share=await createGuestLead(user.id,ids,sections?.photos===true||sections?.mainPhoto===true,{
    recipientName:view.businessName,recipientEmail:email,request:view.message||'Please review the shared assets.',
    replyName:view.contact.name,replyEmail:view.contact.email,replyPhone:view.contact.phone,allowReply:true,
    permissions:{reports:false,documents:false,serialNumber:false,replacementPrice:false},
  },[],group?{id:group.id,name:group.name}:undefined,{valuation:sections?.valuationSummary===true,replacementPrice:false,mainPhotoOnly:sections?.photos!==true});
  liveToken=share.token;
  await getDb().query('UPDATE business_network_requests SET live_share_token=$2 WHERE id=$1',[id,share.token]);
  const url = `${getSiteOrigin()}/asset-share/${share.token}`;
  const titles = view.assets.map((a) => a.title).join(", ");
    await sendAim4priceEmail({
      to: email,
      usage: { accountId:user.id, actorId:user.id, eventKey:`business-share:${id}` },
      replyTo: view.contact.email,
      subject: `Asset enquiry: ${titles.slice(0, 120)}`,
      text: `${view.contact.name}\n${view.contact.email}\n${view.contact.phone}\n${view.contact.additional}\n\n${view.message}\n\n${titles}\nView the shared assets and photos: ${url}\nReply to this email to contact the owner.`,
      html: businessEmailHtml(
        "Asset enquiry",
        `<p><strong>${esc(view.contact.name)}</strong><br>${esc(view.contact.email)}<br>${esc(view.contact.phone)}<br>${esc(view.contact.additional)}</p><p style="white-space:pre-wrap">${esc(view.message)}</p>${view.assets.map((a) => `<h3>${esc(a.title)}</h3><table>${a.details.map(([k, v]) => `<tr><td style="padding:5px">${esc(k)}</td><td style="padding:5px">${esc(v)}</td></tr>`).join("")}</table>`).join("")}<p><a href="${esc(url)}">View shared assets and photos</a></p><p>Reply to this email to contact the owner directly.</p><p>This is a read-only enquiry. <a href="${getSiteOrigin()}/register">Explore an Aim4price subscription</a> for reports and more tools. Additional asset access still requires owner permission.</p><p><a href="${getSiteOrigin()}/business-network/manage">Manage your business listing or stop requests</a></p>`,
      ),
    });
    await getDb().query(
      `update business_network_requests set status='sent' where id=$1`,
      [id],
    );
  } catch (e) {
    const {revokeAssetShareLink}=await import('./asset-share-links');
    if(liveToken)await revokeAssetShareLink(user.id,liveToken);
    await getDb().query(
      `update business_network_requests set status='failed' where id=$1`,
      [id],
    );
    throw e;
  }
}
export async function getBusinessRequest(
  token: string,
): Promise<BusinessLeadView> {
  await ensureBusinessNetwork();
  let shareToken=token;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    readBusinessToken(token);
    const row=(await getDb().query<{live_share_token:string}>(`SELECT live_share_token FROM business_network_requests WHERE token_hash=$1 AND revoked_at IS NULL AND status='sent'`,[hashBusinessToken(token)])).rows[0];
    if(!row?.live_share_token)throw new Error('This older enquiry is unavailable or expired. Ask the owner for a new live asset link.');
    shareToken=row.live_share_token;
  }
  const {readLeadPage}=await import('./guest-leads');
  const {externalLeadAccess}=await import('./external-lead-access');
  const lead=await readLeadPage(shareToken);
  if(!lead?.details)throw new Error('This enquiry is unavailable or expired.');
  if(!['active','read-only','owner'].includes((await externalLeadAccess(lead)).access))throw new Error('Sign in with the authorised recipient account to view this enquiry.');
  return {
    businessName:lead.details.recipientName,message:lead.details.request,umbrella:lead.share.umbrellaName||'',
    contact:{name:lead.share.senderName||lead.details.replyName,email:lead.details.replyEmail,phone:lead.details.replyPhone,additional:''},
    assets:lead.share.assets.map(asset=>({title:asset.title,details:[['Serial number',asset.serialNumber],['Usage',asset.usage],['Condition',asset.condition]],photos:asset.photoUrls})),
  };
}
export async function revokeBusinessRequest(ownerId: string, id: string) {
  await ensureBusinessNetwork();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Choose a valid enquiry.");
  const result = await getDb().query(
    `update business_network_requests set revoked_at=now() where id=$1 and owner_id=$2 returning id,live_share_token`,
    [id, ownerId],
  );
  if (!result.rows.length) throw new Error("This enquiry is unavailable.");
  if(result.rows[0].live_share_token){const {revokeAssetShareLink}=await import('./asset-share-links');await revokeAssetShareLink(ownerId,result.rows[0].live_share_token);}
}
