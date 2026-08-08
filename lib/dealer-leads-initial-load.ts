import { getDb } from './db';
import {
  ensurePartnerAccessTables,
  normalizeLeadStatus,
  normalizeLeadType,
  type AssetLead,
} from './partner-access';

type DealerLeadInitialRow = {
  id: string;
  owner_user_id: string;
  partner_user_id: string;
  asset_register_item_id: string;
  lead_type: string | null;
  status: string | null;
  asset_snapshot_json: unknown;
  has_asset_logo: boolean | null;
  included_sections_json: unknown;
  owner_message: string | null;
  owner_contact_name: string | null;
  owner_contact_phone: string | null;
  owner_contact_email: string | null;
  owner_display_name: string | null;
  owner_business_name: string | null;
  owner_marketplace_email: string | null;
  owner_phone: string | null;
  owner_province: string | null;
  owner_town_city: string | null;
  partner_display_name: string | null;
  partner_business_name: string | null;
  partner_phone: string | null;
  partner_province: string | null;
  partner_town_city: string | null;
  created_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  quoted_at: string | null;
  declined_at: string | null;
  closed_at: string | null;
  updated_at: string | null;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isoFallback(value: string | null): string {
  if (!value) return new Date(0).toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function mapInitialLead(row: DealerLeadInitialRow): AssetLead {
  const ownerBusinessName = asText(row.owner_business_name);
  const ownerName = asText(row.owner_display_name) || ownerBusinessName || 'Aim4price owner';
  const partnerBusinessName = asText(row.partner_business_name);
  const partnerName = asText(row.partner_display_name) || partnerBusinessName || 'Aim4price partner';
  const assetSnapshot = { ...asRecord(row.asset_snapshot_json) };

  if (row.has_asset_logo) {
    assetSnapshot.logoUrl = `/api/asset-leads/${row.id}/logo`;
  }

  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    partnerUserId: row.partner_user_id,
    assetRegisterItemId: row.asset_register_item_id,
    leadType: normalizeLeadType(row.lead_type) ?? 'replacement_quote',
    status: normalizeLeadStatus(row.status) ?? 'sent',
    assetSnapshot,
    includedSections: asRecord(row.included_sections_json),
    ownerMessage: asText(row.owner_message),
    ownerContactName: asText(row.owner_contact_name),
    ownerContactPhone: asText(row.owner_contact_phone),
    ownerContactEmail: asText(row.owner_contact_email),
    ownerName,
    ownerBusinessName,
    ownerEmail: asText(row.owner_marketplace_email),
    ownerPhone: asText(row.owner_phone),
    ownerProvince: asText(row.owner_province),
    ownerTownCity: asText(row.owner_town_city),
    partnerName,
    partnerBusinessName,
    partnerPhone: asText(row.partner_phone),
    partnerProvince: asText(row.partner_province),
    partnerTownCity: asText(row.partner_town_city),
    partnerNoteAttachmentCount: 0,
    latestPartnerNoteAttachmentFileName: '',
    latestPartnerNoteAttachmentByteSize: null,
    latestPartnerNoteAttachmentCreatedAtIso: null,
    createdAtIso: isoFallback(row.created_at),
    viewedAtIso: row.viewed_at,
    acceptedAtIso: row.accepted_at,
    quotedAtIso: row.quoted_at,
    declinedAtIso: row.declined_at,
    closedAtIso: row.closed_at,
    updatedAtIso: isoFallback(row.updated_at),
  };
}

export async function listInitialDealerReceivedLeads(
  dealerUserId: string,
  limit = 10,
): Promise<AssetLead[]> {
  await ensurePartnerAccessTables();
  const safeLimit = Math.min(25, Math.max(1, Math.trunc(limit) || 10));
  const result = await getDb().query<DealerLeadInitialRow>(
    `
      select
        l.id::text,
        l.owner_user_id,
        l.partner_user_id,
        l.asset_register_item_id::text,
        l.lead_type,
        l.status,
        l.asset_snapshot_json - 'logoUrl' as asset_snapshot_json,
        nullif(l.asset_snapshot_json ->> 'logoUrl', '') is not null as has_asset_logo,
        l.included_sections_json,
        l.owner_message,
        l.owner_contact_name,
        l.owner_contact_phone,
        l.owner_contact_email,
        owner.display_name as owner_display_name,
        owner.business_name as owner_business_name,
        owner.marketplace_email as owner_marketplace_email,
        owner.phone as owner_phone,
        owner.province as owner_province,
        owner.town_city as owner_town_city,
        partner.display_name as partner_display_name,
        partner.business_name as partner_business_name,
        partner.phone as partner_phone,
        partner.province as partner_province,
        partner.town_city as partner_town_city,
        l.created_at::text,
        l.viewed_at::text,
        l.accepted_at::text,
        l.quoted_at::text,
        l.declined_at::text,
        l.closed_at::text,
        l.updated_at::text
      from public.asset_leads l
      left join public.account_profiles owner on owner.user_id = l.owner_user_id
      left join public.account_profiles partner on partner.user_id = l.partner_user_id
      where l.partner_user_id = $1
      order by l.created_at desc, l.id desc
      limit $2
    `,
    [dealerUserId, safeLimit],
  );

  return result.rows.map(mapInitialLead);
}
