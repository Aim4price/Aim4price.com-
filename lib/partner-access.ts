import { ensureAccountProfileColumns, getAccountProfile } from './account-profile';
import { getAssetRegisterItemById, listAssetRegisterItems, type AssetRegisterItem } from './asset-register-db';
import { getAssetRegisterReportLogoUrl } from './asset-registers';
import {
  applyDealerCorrectionToSnapshot,
  listPendingDealerAssetCorrections,
  type DealerAssetCorrectionRequest,
} from './dealer-asset-corrections';
import {
  listActiveDealerMaintenanceLeadAccess,
  type DealerMaintenanceLeadAccess,
} from './dealer-maintenance-tracker';
import { isDatabaseSchemaReady } from './database-schema-readiness';
import { getDb } from './db';
import {
  filterAssetDocumentsForRole,
} from './asset-document-permissions';
import {
  isAssistanceMasterAccountUserId,
  listAssistanceDirectoryEntries,
  type AssistanceMapBounds,
} from './assistance-network';

export type AccountRole = 'owner' | 'dealer' | 'finance' | 'insurance' | 'licensing';
export type PartnerType = Exclude<AccountRole, 'owner'>;
export type LeadType = 'finance' | 'insurance' | 'replacement_quote' | 'license_renewal';
export type AssetLeadStatus = 'sent' | 'viewed' | 'accepted' | 'quoted' | 'declined' | 'closed';

export type PartnerDirectoryEntry = {
  userId: string;
  masterAccountUserId?: string;
  partnerType: PartnerType;
  accountSubtype: string;
  displayName: string;
  businessName: string;
  phone: string;
  email: string;
  province: string;
  townCity: string;
  addressLine1: string;
  logoUrl: string;
  websiteUrl: string;
  extraPhotoUrls: string[];
  description: string;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number | null;
  brandFocus: string;
  services: string;
  isAim4priceManaged?: boolean;
  isActivePartner?: boolean;
  assistanceLocationId?: string;
  assistanceServiceKey?: string;
  serviceAreaNotice?: string;
};

export type AssetLead = {
  id: string;
  ownerUserId: string;
  partnerUserId: string;
  assetRegisterItemId: string;
  leadType: LeadType;
  status: AssetLeadStatus;
  assetSnapshot: Record<string, unknown>;
  includedSections: Record<string, unknown>;
  ownerMessage: string;
  ownerContactName: string;
  ownerContactPhone: string;
  ownerContactEmail: string;
  ownerName: string;
  ownerBusinessName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerProvince: string;
  ownerTownCity: string;
  partnerName: string;
  partnerBusinessName: string;
  partnerPhone: string;
  partnerProvince: string;
  partnerTownCity: string;
  partnerNoteAttachmentCount: number;
  latestPartnerNoteAttachmentFileName: string;
  latestPartnerNoteAttachmentByteSize: number | null;
  latestPartnerNoteAttachmentCreatedAtIso: string | null;
  dealerCorrection?: DealerAssetCorrectionRequest | null;
  maintenanceAccess?: DealerMaintenanceLeadAccess | null;
  createdAtIso: string;
  viewedAtIso: string | null;
  acceptedAtIso: string | null;
  quotedAtIso: string | null;
  declinedAtIso: string | null;
  closedAtIso: string | null;
  updatedAtIso: string;
};

export type AssetLeadSummaryCounts = {
  newLeads: number;
  inProgress: number;
  completed: number;
  total: number;
};

export type AssetPartnerNoteStatus = 'open' | 'noted';

export type AssetPartnerNoteAttachment = {
  fileName: string;
  contentType: string;
  byteSize: number;
  url: string;
};

export type AssetPartnerNote = {
  id: string;
  ownerUserId: string;
  partnerUserId: string;
  assetRegisterItemId: string;
  noteText: string;
  status: AssetPartnerNoteStatus;
  partnerType: PartnerType | null;
  partnerName: string;
  partnerBusinessName: string;
  attachment: AssetPartnerNoteAttachment | null;
  createdAtIso: string;
  notedAtIso: string | null;
  updatedAtIso: string;
};

type CreateAssetLeadNoteAttachmentInput = {
  fileName: string;
  contentType: string;
  byteSize: number;
  data: Buffer;
};

type AccountPartnerProfileRow = {
  user_id: string;
  display_name: string | null;
  business_name: string | null;
  phone: string | null;
  marketplace_email: string | null;
  account_type: string | null;
  account_subtype: string | null;
  province: string | null;
  town_city: string | null;
  address_line_1: string | null;
  logo_url: string | null;
  website_url: string | null;
  extra_photo_urls: unknown;
  partner_description: string | null;
  partner_latitude: string | number | null;
  partner_longitude: string | number | null;
  partner_service_radius_km: string | number | null;
  partner_brand_focus: string | null;
  partner_services: string | null;
  account_status?: string | null;
};

type LeadRow = {
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

type AssetPartnerNoteRow = {
  id: string;
  owner_user_id: string;
  partner_user_id: string;
  asset_register_item_id: string;
  note_text: string | null;
  status: string | null;
  partner_type: string | null;
  partner_display_name: string | null;
  partner_business_name: string | null;
  attachment_file_name: string | null;
  attachment_content_type: string | null;
  attachment_byte_size: string | number | null;
  created_at: string | null;
  noted_at: string | null;
  updated_at: string | null;
};

type LeadAttachmentSummaryRow = {
  owner_user_id: string;
  partner_user_id: string;
  asset_register_item_id: string;
  attachment_count: string | number | null;
  latest_attachment_file_name: string | null;
  latest_attachment_byte_size: string | number | null;
  latest_attachment_created_at: string | null;
};

const ACCOUNT_ROLES = new Set<AccountRole>(['owner', 'dealer', 'finance', 'insurance', 'licensing']);
const PARTNER_TYPES = new Set<PartnerType>(['dealer', 'finance', 'insurance', 'licensing']);
const LEAD_TYPES = new Set<LeadType>(['finance', 'insurance', 'replacement_quote', 'license_renewal']);
const LEAD_STATUSES = new Set<AssetLeadStatus>(['sent', 'viewed', 'accepted', 'quoted', 'declined', 'closed']);
const ASSET_PARTNER_NOTE_STATUSES = new Set<AssetPartnerNoteStatus>(['open', 'noted']);

let partnerAccessTablesEnsured = false;
let partnerAccessTablesPromise: Promise<void> | null = null;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => asText(entry)).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Array.isArray(parsed) ? parsed.map((entry) => asText(entry)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function sanitizePartnerImageUrl(value: unknown): string {
  const next = asText(value);

  if (!next || next.length > 7_000_000) {
    return '';
  }

  if (/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(next)) {
    return next.replace(/\s+/g, '');
  }

  if (next.startsWith('/') || next.startsWith('https://')) {
    return next;
  }

  return '';
}

function sanitizePartnerExtraPhotoUrls(value: unknown): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const entry of asStringArray(value)) {
    const url = sanitizePartnerImageUrl(entry);

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    urls.push(url);

    if (urls.length >= 3) {
      break;
    }
  }

  return urls;
}

function sanitizePartnerWebsiteUrl(value: unknown): string {
  const raw = asText(value);

  if (!raw || raw.length > 300) {
    return '';
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(withProtocol);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }

    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return '';
    }

    return parsed.href.slice(0, 300);
  } catch {
    return '';
  }
}

function asNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asInteger(value: unknown): number | null {
  const numeric = asNumber(value);
  return numeric === null ? null : Math.round(numeric);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function isBlockedLeadDocument(document: AssetRegisterItem['documents'][number]): boolean {
  const fileName = asText(document.fileName).toLowerCase();
  const contentType = asText(document.contentType).toLowerCase();

  return (
    fileName.endsWith('.xlsx') ||
    contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

function leadDocumentsForSnapshot(
  documents: AssetRegisterItem['documents'],
  includedSections: Record<string, unknown>,
  leadType: LeadType,
  partnerSubtype: string | null,
): AssetRegisterItem['documents'] {
  if (includedSections.documents !== true) {
    return [];
  }

  const role = leadType === 'replacement_quote' ? 'dealer' : partnerTypeForLeadType(leadType);

  if (role === 'dealer') return [];

  return filterAssetDocumentsForRole(
    documents.filter((document) => !isBlockedLeadDocument(document)),
    role,
    partnerSubtype,
  );
}

function sanitizeRegisterSnapshotDocuments(
  includedSections: Record<string, unknown>,
  leadType: LeadType,
  partnerSubtype: string | null,
): Record<string, unknown> {
  const registerSnapshot = asRecord(includedSections.registerSnapshot);
  if (!registerSnapshot || !Array.isArray(registerSnapshot.assets)) {
    return includedSections;
  }

  const role = leadType === 'replacement_quote' ? 'dealer' : partnerTypeForLeadType(leadType);
  const assets = registerSnapshot.assets.map((entry) => {
    const asset = asRecord(entry);
    if (!asset) return entry;
    const documents = Array.isArray(asset.documents)
      ? asset.documents
          .map((document) => asRecord(document))
          .filter((document): document is Record<string, unknown> => Boolean(document))
          .filter((document) => {
            const fileName = asText(document.fileName).toLowerCase();
            const contentType = asText(document.contentType).toLowerCase();
            return !fileName.endsWith('.xlsx') &&
              contentType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          })
      : [];

    return {
      ...asset,
      documents: filterAssetDocumentsForRole(documents, role, partnerSubtype),
    };
  });

  return {
    ...includedSections,
    registerSnapshot: {
      ...registerSnapshot,
      assets,
    },
  };
}

function sanitizeLeadMessagePhotoUrl(value: unknown): string {
  const url = asText(value).slice(0, 2000);

  if (!url) {
    return '';
  }

  if (url.startsWith('/api/asset-register/uploads/')) {
    return url.split('?')[0] ?? url;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return '';
}

function leadPhotoUrlsFromArray(value: unknown): string[] {
  return asStringArray(value).map(sanitizeLeadMessagePhotoUrl).filter(Boolean);
}

function leadPhotoUrlsFromAttachments(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const attachment = asRecord(entry);
      return sanitizeLeadMessagePhotoUrl(
        attachment.url ?? attachment.photoUrl ?? attachment.photo_url ?? attachment.href ?? entry,
      );
    })
    .filter(Boolean);
}

function mergeUniqueLeadPhotoUrls(photoUrlGroups: string[][], maxCount = 3): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const group of photoUrlGroups) {
    for (const url of group) {
      const normalizedUrl = sanitizeLeadMessagePhotoUrl(url);

      if (!normalizedUrl || seen.has(normalizedUrl)) {
        continue;
      }

      seen.add(normalizedUrl);
      urls.push(normalizedUrl);

      if (urls.length >= maxCount) {
        return urls;
      }
    }
  }

  return urls;
}

function ownerMessagePhotoUrlsFromSections(sections: Record<string, unknown>): string[] {
  return mergeUniqueLeadPhotoUrls([
    leadPhotoUrlsFromArray(sections.ownerMessagePhotoUrls),
    leadPhotoUrlsFromArray(sections.messageAttachmentPhotoUrls),
    leadPhotoUrlsFromArray(sections.ownerSharePhotoUrls),
    leadPhotoUrlsFromArray(sections.sharePhotoUrls),
    leadPhotoUrlsFromAttachments(sections.ownerMessageAttachments),
    leadPhotoUrlsFromAttachments(sections.messageAttachments),
  ]);
}

function buildOwnerMessagePhotoAttachments(photoUrls: string[]): Array<{ type: 'image'; source: 'asset_qr_share'; url: string }> {
  return photoUrls.map((url) => ({
    type: 'image',
    source: 'asset_qr_share',
    url,
  }));
}

function withNormalizedOwnerMessagePhotoSections(sections: Record<string, unknown>): Record<string, unknown> {
  const ownerMessagePhotoUrls = ownerMessagePhotoUrlsFromSections(sections);

  if (!ownerMessagePhotoUrls.length) {
    return sections;
  }

  const ownerMessageAttachments = buildOwnerMessagePhotoAttachments(ownerMessagePhotoUrls);

  return {
    ...sections,
    ownerMessagePhotoUrls,
    messageAttachmentPhotoUrls: ownerMessagePhotoUrls,
    ownerSharePhotoUrls: ownerMessagePhotoUrls,
    sharePhotoUrls: ownerMessagePhotoUrls,
    ownerMessageAttachments,
    messageAttachments: ownerMessageAttachments,
    ownerSharePhotoCount: ownerMessagePhotoUrls.length,
  };
}

export function normalizeAccountRole(value: unknown): AccountRole {
  const normalized = asText(value).toLowerCase();

  if (normalized === 'bank') return 'finance';
  if (normalized === 'broker' || normalized === 'insurer' || normalized === 'short-term-insurer') return 'insurance';
  if (['licence-renewal', 'license-renewal', 'licensing-expert', 'licence-expert'].includes(normalized)) return 'licensing';
  if (ACCOUNT_ROLES.has(normalized as AccountRole)) return normalized as AccountRole;

  return 'owner';
}

export function normalizePartnerType(value: unknown): PartnerType | null {
  const normalized = normalizeAccountRole(value);
  return PARTNER_TYPES.has(normalized as PartnerType) ? (normalized as PartnerType) : null;
}

export function normalizeLeadType(value: unknown): LeadType | null {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'replacement' || normalized === 'machinery' || normalized === 'dealer') return 'replacement_quote';
  if (['licence_renewal', 'license', 'licence', 'licensing'].includes(normalized)) return 'license_renewal';
  return LEAD_TYPES.has(normalized as LeadType) ? (normalized as LeadType) : null;
}

export function partnerTypesForLeadType(leadType: LeadType): PartnerType[] {
  if (leadType === 'replacement_quote') return ['dealer'];
  if (leadType === 'insurance') return ['insurance'];
  if (leadType === 'license_renewal') return ['licensing'];
  return ['finance'];
}

export function partnerTypeForLeadType(leadType: LeadType): PartnerType {
  return partnerTypesForLeadType(leadType)[0];
}

function canUsePartnerForRequestedType(actualType: PartnerType | null, requestedType: PartnerType): boolean {
  if (!actualType) return false;
  return actualType === requestedType;
}

export function normalizeLeadStatus(value: unknown): AssetLeadStatus | null {
  const normalized = asText(value).toLowerCase();
  return LEAD_STATUSES.has(normalized as AssetLeadStatus) ? (normalized as AssetLeadStatus) : null;
}

function isoNowFallback(value: string | null | undefined): string {
  return value || new Date().toISOString();
}

async function ensurePartnerRoleConstraints(
  db: ReturnType<typeof getDb>,
): Promise<void> {
  await db.query(`
    do $migration$
    begin
      perform pg_advisory_xact_lock(
        hashtext('aim4price:partner-access:licensing-role')
      );

      if to_regclass('public.asset_register_access_grants') is not null
        and not exists (
          select 1
          from pg_constraint
          where conrelid = 'public.asset_register_access_grants'::regclass
            and conname = 'asset_register_access_grants_partner_type_check'
            and pg_get_constraintdef(oid) ilike '%licensing%'
        ) then
        alter table public.asset_register_access_grants
          drop constraint if exists asset_register_access_grants_partner_type_check;

        alter table public.asset_register_access_grants
          add constraint asset_register_access_grants_partner_type_check
          check (partner_type in ('dealer', 'finance', 'insurance', 'licensing'))
          not valid;

        alter table public.asset_register_access_grants
          validate constraint asset_register_access_grants_partner_type_check;
      end if;

      if to_regclass('public.asset_leads') is not null
        and not exists (
          select 1
          from pg_constraint
          where conrelid = 'public.asset_leads'::regclass
            and conname = 'asset_leads_lead_type_check'
            and pg_get_constraintdef(oid) ilike '%license_renewal%'
        ) then
        alter table public.asset_leads
          drop constraint if exists asset_leads_lead_type_check;

        alter table public.asset_leads
          add constraint asset_leads_lead_type_check
          check (lead_type in
            ('finance', 'insurance', 'replacement_quote', 'license_renewal'))
          not valid;

        alter table public.asset_leads
          validate constraint asset_leads_lead_type_check;
      end if;
    end
    $migration$;
  `);
}

async function ensurePartnerAccessTablesOnce(): Promise<void> {
  await ensureAccountProfileColumns();
  const db = getDb();

  const schemaReady = await isDatabaseSchemaReady(() => db.query(`
    with lead_schema as (
      select
        id,
        owner_user_id,
        partner_user_id,
        asset_register_item_id,
        lead_type,
        status,
        asset_snapshot_json,
        included_sections_json,
        created_at,
        updated_at
      from asset_leads
      where false
    ), note_schema as (
      select
        id,
        owner_user_id,
        partner_user_id,
        asset_register_item_id,
        status,
        attachment_file_name,
        attachment_data,
        created_at
      from asset_partner_notes
      where false
    ), audit_schema as (
      select id, owner_user_id, actor_user_id, entity_type, metadata_json, created_at
      from access_audit_events
      where false
    )
    select 1
    from lead_schema
    cross join note_schema
    cross join audit_schema
  `));

  if (schemaReady) {
    await ensurePartnerRoleConstraints(db);
    partnerAccessTablesEnsured = true;
    return;
  }

  await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await db.query(`
    alter table account_profiles
      add column if not exists partner_directory_enabled boolean not null default false,
      add column if not exists partner_directory_status text not null default 'approved',
      add column if not exists partner_description text,
      add column if not exists partner_latitude double precision,
      add column if not exists partner_longitude double precision,
      add column if not exists partner_service_radius_km integer,
      add column if not exists partner_brand_focus text,
      add column if not exists partner_services text
  `);

  await db.query(`
    update account_profiles
    set account_type = case lower(trim(account_type))
      when 'bank' then 'finance'
      when 'broker' then 'insurance'
      when 'insurer' then 'insurance'
      when 'insurance' then 'insurance'
      when 'finance' then 'finance'
      when 'dealer' then 'dealer'
      when 'licensing' then 'licensing'
      when 'licence-renewal-expert' then 'licensing'
      when 'license-renewal-expert' then 'licensing'
      else 'owner'
    end
    where account_type is null
       or lower(trim(account_type)) not in ('owner', 'dealer', 'finance', 'insurance', 'licensing')
       or lower(trim(account_type)) in ('bank', 'broker', 'insurer')
  `);

  await db.query(`
    update account_profiles
    set account_type = 'insurance', account_subtype = 'short-term-insurer'
    where lower(trim(coalesce(account_subtype, ''))) in ('insurer', 'short-term-insurer', 'insurance-broker', 'broker')
  `);

  await db.query(`
    update account_profiles
    set account_subtype = 'auctioneer'
    where account_type = 'dealer'
      and lower(trim(coalesce(account_subtype, ''))) in ('auction-house', 'auctioneer')
  `);

  await db.query(`
    create table if not exists asset_leads (
      id uuid primary key default gen_random_uuid(),
      owner_user_id text not null,
      partner_user_id text not null,
      asset_register_item_id uuid not null,
      lead_type text not null,
      status text not null default 'sent',
      asset_snapshot_json jsonb not null default '{}'::jsonb,
      included_sections_json jsonb not null default '{}'::jsonb,
      owner_message text,
      owner_contact_name text,
      owner_contact_phone text,
      owner_contact_email text,
      created_at timestamptz not null default now(),
      viewed_at timestamptz,
      accepted_at timestamptz,
      quoted_at timestamptz,
      declined_at timestamptz,
      closed_at timestamptz,
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    alter table asset_leads
      add column if not exists owner_user_id text,
      add column if not exists partner_user_id text,
      add column if not exists asset_register_item_id uuid,
      add column if not exists lead_type text,
      add column if not exists status text not null default 'sent',
      add column if not exists asset_snapshot_json jsonb not null default '{}'::jsonb,
      add column if not exists included_sections_json jsonb not null default '{}'::jsonb,
      add column if not exists owner_message text,
      add column if not exists owner_contact_name text,
      add column if not exists owner_contact_phone text,
      add column if not exists owner_contact_email text,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists viewed_at timestamptz,
      add column if not exists accepted_at timestamptz,
      add column if not exists quoted_at timestamptz,
      add column if not exists declined_at timestamptz,
      add column if not exists closed_at timestamptz,
      add column if not exists updated_at timestamptz not null default now()
  `);

  await db.query(`
    create table if not exists asset_partner_notes (
      id uuid primary key default gen_random_uuid(),
      owner_user_id text not null,
      partner_user_id text not null,
      asset_register_item_id uuid not null,
      note_text text not null,
      status text not null default 'open',
      created_at timestamptz not null default now(),
      noted_at timestamptz,
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    alter table asset_partner_notes
      add column if not exists owner_user_id text,
      add column if not exists partner_user_id text,
      add column if not exists asset_register_item_id uuid,
      add column if not exists note_text text,
      add column if not exists status text not null default 'open',
      add column if not exists attachment_file_name text,
      add column if not exists attachment_content_type text,
      add column if not exists attachment_byte_size integer,
      add column if not exists attachment_data bytea,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists noted_at timestamptz,
      add column if not exists updated_at timestamptz not null default now()
  `);

  await db.query(`
    create table if not exists access_audit_events (
      id uuid primary key default gen_random_uuid(),
      owner_user_id text,
      actor_user_id text not null,
      event_type text not null,
      entity_type text not null,
      entity_id text,
      metadata_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await db.query(`
    create index if not exists idx_account_profiles_partner_directory
      on account_profiles(account_type, partner_directory_enabled, partner_directory_status, province, town_city)
  `);

  await db.query(`
    create index if not exists idx_asset_leads_owner_status
      on asset_leads(owner_user_id, status, created_at desc)
  `);

  await db.query(`
    create index if not exists idx_asset_leads_partner_status
      on asset_leads(partner_user_id, status, created_at desc)
  `);

  await db.query(`
    create index if not exists idx_asset_partner_notes_owner_status
      on asset_partner_notes(owner_user_id, status, created_at desc)
  `);

  await db.query(`
    create index if not exists idx_asset_partner_notes_partner_status
      on asset_partner_notes(partner_user_id, status, created_at desc)
  `);

  await db.query(`
    create index if not exists idx_asset_partner_notes_asset_open
      on asset_partner_notes(asset_register_item_id, status, created_at desc)
  `);

  await db.query(`
    create index if not exists idx_access_audit_owner_created
      on access_audit_events(owner_user_id, created_at desc)
  `);

  await ensurePartnerRoleConstraints(db);

  partnerAccessTablesEnsured = true;
}

export async function ensurePartnerAccessTables(): Promise<void> {
  if (partnerAccessTablesEnsured) {
    return;
  }

  if (!partnerAccessTablesPromise) {
    partnerAccessTablesPromise = ensurePartnerAccessTablesOnce().catch((error) => {
      partnerAccessTablesPromise = null;
      throw error;
    });
  }

  await partnerAccessTablesPromise;
}

function mapPartnerRow(row: AccountPartnerProfileRow): PartnerDirectoryEntry {
  const partnerType = normalizePartnerType(row.account_type) ?? 'dealer';
  const businessName = asText(row.business_name);
  const displayName = asText(row.display_name) || businessName || 'Aim4price business';

  return {
    userId: row.user_id,
    partnerType,
    accountSubtype: asText(row.account_subtype),
    displayName,
    businessName,
    phone: asText(row.phone),
    email: asText(row.marketplace_email),
    province: asText(row.province),
    townCity: asText(row.town_city),
    addressLine1: asText(row.address_line_1),
    logoUrl: sanitizePartnerImageUrl(row.logo_url),
    websiteUrl: sanitizePartnerWebsiteUrl(row.website_url),
    extraPhotoUrls: [],
    description: asText(row.partner_description),
    latitude: asNumber(row.partner_latitude),
    longitude: asNumber(row.partner_longitude),
    serviceRadiusKm: asInteger(row.partner_service_radius_km),
    brandFocus: asText(row.partner_brand_focus),
    services: asText(row.partner_services),
    isAim4priceManaged: false,
    isActivePartner: asText(row.account_status).toLowerCase() === 'active',
  };
}

function distanceKm(
  latitude: number | null,
  longitude: number | null,
  center: { latitude: number; longitude: number } | null,
): number {
  if (latitude === null || longitude === null || !center) return Number.POSITIVE_INFINITY;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(center.latitude - latitude);
  const longitudeDelta = radians(center.longitude - longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitude)) * Math.cos(radians(center.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapLeadRow(row: LeadRow): AssetLead {
  const leadType = normalizeLeadType(row.lead_type) ?? 'finance';
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
    leadType,
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
    createdAtIso: isoNowFallback(row.created_at),
    viewedAtIso: row.viewed_at,
    acceptedAtIso: row.accepted_at,
    quotedAtIso: row.quoted_at,
    declinedAtIso: row.declined_at,
    closedAtIso: row.closed_at,
    updatedAtIso: isoNowFallback(row.updated_at),
  };
}

function leadSelectSql(whereClause: string): string {
  return `
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
    from asset_leads l
    left join account_profiles owner on owner.user_id = l.owner_user_id
    left join account_profiles partner on partner.user_id = l.partner_user_id
    ${whereClause}
  `;
}

function leadAttachmentSummaryKey(input: Pick<AssetLead, 'ownerUserId' | 'partnerUserId' | 'assetRegisterItemId'>): string {
  return `${input.ownerUserId}::${input.partnerUserId}::${input.assetRegisterItemId}`;
}

async function hydrateLeadAttachmentSummaries(leads: AssetLead[], currentUserId: string): Promise<AssetLead[]> {
  if (!leads.length) {
    return leads;
  }

  const db = getDb();
  const assetIds = Array.from(new Set(leads.map((lead) => lead.assetRegisterItemId)));
  const result = await db.query<LeadAttachmentSummaryRow>(
    `
      select
        owner_user_id,
        partner_user_id,
        asset_register_item_id::text,
        count(*)::int as attachment_count,
        (array_agg(attachment_file_name order by created_at desc, id desc))[1] as latest_attachment_file_name,
        (array_agg(attachment_byte_size order by created_at desc, id desc))[1] as latest_attachment_byte_size,
        max(created_at)::text as latest_attachment_created_at
      from asset_partner_notes
      where (owner_user_id = $1 or partner_user_id = $1)
        and asset_register_item_id = any($2::uuid[])
        and nullif(trim(coalesce(attachment_file_name, '')), '') is not null
        and attachment_data is not null
      group by owner_user_id, partner_user_id, asset_register_item_id
    `,
    [currentUserId, assetIds],
  );

  const summaries = new Map<string, LeadAttachmentSummaryRow>();
  result.rows.forEach((row) => {
    summaries.set(`${row.owner_user_id}::${row.partner_user_id}::${row.asset_register_item_id}`, row);
  });

  return leads.map((lead) => {
    const summary = summaries.get(leadAttachmentSummaryKey(lead));

    if (!summary) {
      return lead;
    }

    return {
      ...lead,
      partnerNoteAttachmentCount: asInteger(summary.attachment_count) ?? 0,
      latestPartnerNoteAttachmentFileName: asText(summary.latest_attachment_file_name),
      latestPartnerNoteAttachmentByteSize: asInteger(summary.latest_attachment_byte_size),
      latestPartnerNoteAttachmentCreatedAtIso: summary.latest_attachment_created_at,
    };
  });
}

async function hydrateDealerAssetCorrections(leads: AssetLead[], currentUserId: string): Promise<AssetLead[]> {
  const dealerLeads = leads.filter((lead) => lead.partnerUserId === currentUserId);
  if (!dealerLeads.length) return leads;

  const corrections = await listPendingDealerAssetCorrections(
    currentUserId,
    dealerLeads.map((lead) => lead.assetRegisterItemId),
  );
  const correctionsByAssetId = new Map(corrections.map((correction) => [correction.assetId, correction]));

  return leads.map((lead) => {
    if (lead.partnerUserId !== currentUserId) return lead;
    const correction = correctionsByAssetId.get(lead.assetRegisterItemId);
    if (!correction) return lead;

    return {
      ...lead,
      assetSnapshot: applyDealerCorrectionToSnapshot(lead.assetSnapshot, correction),
      dealerCorrection: correction,
    };
  });
}

async function hydrateDealerMaintenanceAccess(leads: AssetLead[], currentUserId: string): Promise<AssetLead[]> {
  const dealerLeads = leads.filter((lead) => lead.partnerUserId === currentUserId);
  if (!dealerLeads.length) return leads;
  const accessEntries = await listActiveDealerMaintenanceLeadAccess({
    dealerUserId: currentUserId,
    leads: dealerLeads.map((lead) => ({
      ownerUserId: lead.ownerUserId,
      assetId: lead.assetRegisterItemId,
    })),
  });
  const accessByLeadKey = new Map(
    accessEntries.map((access) => [`${access.ownerUserId}::${access.assetId}`, access]),
  );
  return leads.map((lead) => lead.partnerUserId === currentUserId
    ? {
        ...lead,
        maintenanceAccess: accessByLeadKey.get(`${lead.ownerUserId}::${lead.assetRegisterItemId}`) ?? null,
      }
    : lead);
}

function normalizeAssetPartnerNoteStatus(value: unknown): AssetPartnerNoteStatus {
  const normalized = asText(value).toLowerCase();
  return ASSET_PARTNER_NOTE_STATUSES.has(normalized as AssetPartnerNoteStatus) ? (normalized as AssetPartnerNoteStatus) : 'open';
}

function mapAssetPartnerNoteAttachment(row: Pick<AssetPartnerNoteRow, 'id' | 'attachment_file_name' | 'attachment_content_type' | 'attachment_byte_size'>): AssetPartnerNoteAttachment | null {
  const fileName = asText(row.attachment_file_name);

  if (!fileName) {
    return null;
  }

  return {
    fileName,
    contentType: asText(row.attachment_content_type) || 'application/pdf',
    byteSize: asInteger(row.attachment_byte_size) ?? 0,
    url: `/api/asset-notes/${encodeURIComponent(row.id)}/attachment`,
  };
}

function mapAssetPartnerNoteRow(row: AssetPartnerNoteRow): AssetPartnerNote {
  const partnerBusinessName = asText(row.partner_business_name);
  const partnerName = asText(row.partner_display_name) || partnerBusinessName || 'Aim4price partner';

  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    partnerUserId: row.partner_user_id,
    assetRegisterItemId: row.asset_register_item_id,
    noteText: asText(row.note_text),
    status: normalizeAssetPartnerNoteStatus(row.status),
    partnerType: normalizePartnerType(row.partner_type),
    partnerName,
    partnerBusinessName,
    attachment: mapAssetPartnerNoteAttachment(row),
    createdAtIso: isoNowFallback(row.created_at),
    notedAtIso: row.noted_at,
    updatedAtIso: isoNowFallback(row.updated_at),
  };
}

function assetPartnerNoteSelectSql(whereClause: string): string {
  return `
    select
      n.id::text,
      n.owner_user_id,
      n.partner_user_id,
      n.asset_register_item_id::text,
      n.note_text,
      n.status,
      partner.account_type as partner_type,
      partner.display_name as partner_display_name,
      partner.business_name as partner_business_name,
      n.attachment_file_name,
      n.attachment_content_type,
      n.attachment_byte_size,
      n.created_at::text,
      n.noted_at::text,
      n.updated_at::text
    from asset_partner_notes n
    left join account_profiles partner on partner.user_id = n.partner_user_id
    ${whereClause}
  `;
}

async function writeAuditEvent(input: {
  ownerUserId?: string | null;
  actorUserId: string;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await ensurePartnerAccessTables();
  const db = getDb();

  await db.query(
    `
      insert into access_audit_events (
        owner_user_id,
        actor_user_id,
        event_type,
        entity_type,
        entity_id,
        metadata_json,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, now())
    `,
    [
      input.ownerUserId ?? null,
      input.actorUserId,
      input.eventType,
      input.entityType,
      input.entityId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function listPartnerDirectory(input: {
  currentUserId: string;
  partnerType?: PartnerType | null;
  search?: string | null;
  bounds?: AssistanceMapBounds | null;
}): Promise<PartnerDirectoryEntry[]> {
  await ensurePartnerAccessTables();
  const db = getDb();
  const partnerType = input.partnerType ?? null;
  const search = asText(input.search).toLowerCase();

  const params: unknown[] = [input.currentUserId];
  const filters = [
    `user_id <> $1`,
    `account_type in ('dealer', 'finance', 'insurance', 'licensing')`,
    `partner_directory_enabled = true`,
    `partner_directory_status = 'approved'`,
  ];

  if (partnerType) {
    params.push(partnerType);
    filters.push(`account_type = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    filters.push(`(
      lower(coalesce(business_name, '')) like $${params.length}
      or lower(coalesce(display_name, '')) like $${params.length}
      or lower(coalesce(province, '')) like $${params.length}
      or lower(coalesce(town_city, '')) like $${params.length}
      or lower(coalesce(partner_brand_focus, '')) like $${params.length}
      or lower(coalesce(partner_services, '')) like $${params.length}
    )`);
  } else if (input.bounds) {
    const { west, south, east, north } = input.bounds;
    params.push(south, north, west, east);
    const southIndex = params.length - 3;
    const northIndex = params.length - 2;
    const westIndex = params.length - 1;
    const eastIndex = params.length;
    filters.push(`partner_latitude between $${southIndex} and $${northIndex}`);
    filters.push(west <= east
      ? `partner_longitude between $${westIndex} and $${eastIndex}`
      : `(partner_longitude >= $${westIndex} or partner_longitude <= $${eastIndex})`);
  }

  const result = await db.query<AccountPartnerProfileRow>(
    `
      select
        user_id,
        display_name,
        business_name,
        phone,
        marketplace_email,
        account_type,
        account_subtype,
        province,
        town_city,
        address_line_1,
        logo_url,
        website_url,
        extra_photo_urls,
        partner_description,
        partner_latitude,
        partner_longitude,
        partner_service_radius_km,
        partner_brand_focus,
        partner_services,
        account_status
      from account_profiles
      where ${filters.join('\n        and ')}
      order by
        province nulls last,
        town_city nulls last,
        coalesce(nullif(business_name, ''), nullif(display_name, ''), user_id)
      limit 250
    `,
    params,
  );

  const genuinePartners = result.rows.map(mapPartnerRow);
  const bounds = input.bounds ?? null;
  const center = bounds ? {
    latitude: (bounds.south + bounds.north) / 2,
    longitude: bounds.west <= bounds.east
      ? (bounds.west + bounds.east) / 2
      : (((bounds.west + bounds.east + 360) / 2 + 540) % 360) - 180,
  } : null;
  genuinePartners.sort((left, right) => {
    const activeDifference = Number(Boolean(right.isActivePartner)) - Number(Boolean(left.isActivePartner));
    if (activeDifference) return activeDifference;
    const distanceDifference = distanceKm(left.latitude, left.longitude, center)
      - distanceKm(right.latitude, right.longitude, center);
    if (Number.isFinite(distanceDifference) && distanceDifference !== 0) return distanceDifference;
    return left.displayName.localeCompare(right.displayName);
  });

  const assistancePartners = partnerType
    ? await listAssistanceDirectoryEntries({ partnerType, search, bounds })
    : [];

  // Genuine registered partners remain first, with nearby active partners ranked
  // highest. Aim4price service-area fallbacks follow them.
  return [...genuinePartners, ...assistancePartners];
}

async function getPartnerProfile(partnerUserId: string): Promise<AccountPartnerProfileRow | null> {
  await ensurePartnerAccessTables();
  const db = getDb();
  const result = await db.query<AccountPartnerProfileRow>(
    `
      select
        user_id,
        display_name,
        business_name,
        phone,
        marketplace_email,
        account_type,
        account_subtype,
        province,
        town_city,
        address_line_1,
        logo_url,
        website_url,
        extra_photo_urls,
        partner_description,
        partner_latitude,
        partner_longitude,
        partner_service_radius_km,
        partner_brand_focus,
        partner_services
      from account_profiles
      where user_id = $1
      limit 1
    `,
    [partnerUserId],
  );

  return result.rows[0] ?? null;
}

export async function attachOpenPartnerNotesToAssets<T extends { id: string }>(
  ownerUserId: string,
  assets: T[],
): Promise<Array<T & { openPartnerNote: AssetPartnerNote | null }>> {
  if (!assets.length) {
    return [];
  }

  await ensurePartnerAccessTables();
  const db = getDb();
  const result = await db.query<AssetPartnerNoteRow>(
    `
      ${assetPartnerNoteSelectSql("where n.owner_user_id = $1 and n.asset_register_item_id = any($2::uuid[]) and n.status = 'open'")}
      order by n.asset_register_item_id, n.created_at desc
    `,
    [ownerUserId, assets.map((asset) => asset.id)],
  );

  const notesByAssetId = new Map<string, AssetPartnerNote>();

  result.rows.forEach((row) => {
    const note = mapAssetPartnerNoteRow(row);
    if (!notesByAssetId.has(note.assetRegisterItemId)) {
      notesByAssetId.set(note.assetRegisterItemId, note);
    }
  });

  return assets.map((asset) => ({
    ...asset,
    openPartnerNote: notesByAssetId.get(asset.id) ?? null,
  }));
}

export async function markAssetPartnerNoteNoted(input: {
  currentUserId: string;
  noteId: string;
}): Promise<AssetPartnerNote> {
  await ensurePartnerAccessTables();
  const db = getDb();
  const current = await db.query<AssetPartnerNoteRow>(`${assetPartnerNoteSelectSql('where n.id = $1::uuid')} limit 1`, [input.noteId]);
  const note = current.rows[0] ? mapAssetPartnerNoteRow(current.rows[0]) : null;

  if (!note) {
    throw new Error('ASSET_NOTE_NOT_FOUND');
  }

  if (note.ownerUserId !== input.currentUserId && note.partnerUserId !== input.currentUserId) {
    throw new Error('ASSET_NOTE_FORBIDDEN');
  }

  await db.query(
    `
      update asset_partner_notes
      set status = 'noted', noted_at = coalesce(noted_at, now()), updated_at = now()
      where id = $1::uuid
    `,
    [input.noteId],
  );

  const updated = await db.query<AssetPartnerNoteRow>(`${assetPartnerNoteSelectSql('where n.id = $1::uuid')} limit 1`, [input.noteId]);
  const updatedRow = updated.rows[0];
  if (!updatedRow) {
    throw new Error('ASSET_NOTE_NOT_FOUND');
  }
  const updatedNote = mapAssetPartnerNoteRow(updatedRow);

  await writeAuditEvent({
    ownerUserId: updatedNote.ownerUserId,
    actorUserId: input.currentUserId,
    eventType: 'asset_note_noted',
    entityType: 'asset_partner_note',
    entityId: updatedNote.id,
    metadata: { assetId: updatedNote.assetRegisterItemId },
  });

  return updatedNote;
}

function readLeadSnapshotText(specs: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = asText(specs[key]);
    if (value) return value;
  }
  return '';
}

function buildAssetLeadSnapshot(
  asset: AssetRegisterItem,
  includedSections: Record<string, unknown>,
  leadType: LeadType,
  partnerSubtype: string | null,
): Record<string, unknown> {
  const ownerMessagePhotoUrls = ownerMessagePhotoUrlsFromSections(includedSections);
  const ownerMessagePhotoUrlSet = new Set(ownerMessagePhotoUrls);
  const assetGalleryPhotos = asset.photos.filter((url) => !ownerMessagePhotoUrlSet.has(sanitizeLeadMessagePhotoUrl(url)));
  const replacementPriceExVat = asNumber(asset.replacementPriceExVat);
  const replacementPriceSnapshot =
    replacementPriceExVat !== null && replacementPriceExVat > 0
      ? {
          replacementPriceExVat,
          replacement_price_ex_vat: replacementPriceExVat,
          replacementPriceUsedExVat: replacementPriceExVat,
          replacement_price_used_ex_vat: replacementPriceExVat,
          userReplacementPriceExVat: replacementPriceExVat,
          user_replacement_price_ex_vat: replacementPriceExVat,
          officialReplacementPriceExVat: replacementPriceExVat,
          official_replacement_price_ex_vat: replacementPriceExVat,
          replacementPrice: replacementPriceExVat,
          replacement_price: replacementPriceExVat,
        }
      : {};
  const licenseRenewalDate = readLeadSnapshotText(asset.specsJson, [
    'licenseRenewalDate',
    'license_renewal_date',
    'licenceRenewalDate',
    'licence_renewal_date',
  ]);
  const snapshotSpecs = leadType === 'license_renewal'
    ? {
        licenseStatus: 'yes',
        licenceStatus: 'yes',
        licenseRenewalDate,
        licenceRenewalDate: licenseRenewalDate,
      }
    : {
        ...asset.specsJson,
        ...replacementPriceSnapshot,
      };

  const baseSnapshot = {
    id: asset.id,
    title: asset.title,
    kind: asset.kind,
    brandName: asset.brandName,
    modelName: asset.modelName,
    typedModelName: asset.typedModelName,
    equipmentFamilyKey: asset.equipmentFamilyKey,
    equipmentFamilyLabel: asset.equipmentFamilyLabel,
    yearModel: asset.yearModel,
    hours: asset.hours,
    specsJson: snapshotSpecs,
    condition: asset.condition,
    isLicensed: asset.isLicensed,
    licenseRegistrationNumber: asset.licenseRegistrationNumber,
    licenseRenewalDate,
    photos: assetGalleryPhotos,
    ownerMessagePhotoUrls,
    messageAttachmentPhotoUrls: ownerMessagePhotoUrls,
    documents: leadDocumentsForSnapshot(
      asset.documents,
      includedSections,
      leadType,
      partnerSubtype,
    ),
    createdAtIso: asset.createdAtIso,
    updatedAtIso: asset.updatedAtIso,
  };

  if (leadType === 'license_renewal') return baseSnapshot;

  return {
    ...baseSnapshot,
    value: asset.value,
    selectedValueExVat: asset.selectedValueExVat,
    ...replacementPriceSnapshot,
    selectedMethod: asset.selectedMethod,
    depreciationMethodUsed: asset.depreciationMethodUsed,
    lifeWorkedPercent: asset.lifeWorkedPercent,
    lifeRemainingPercent: asset.lifeRemainingPercent,
    estimatedHours: asset.estimatedHours,
    maxLifetimeHours: asset.maxLifetimeHours,
    powerKw: asset.powerKw,
    serialNumber: asset.serialNumber,
    isFinanced: asset.isFinanced,
    isInsured: asset.isInsured,
    aim4priceValueExVat: asset.aim4priceValueExVat,
    marketMidExVat: asset.marketMidExVat,
    publicAssetCode: asset.publicAssetCode,
    lastScannedAtIso: asset.lastScannedAtIso,
    lastKnownLat: asset.lastKnownLat,
    lastKnownLng: asset.lastKnownLng,
    lastKnownLocationText: asset.lastKnownLocationText,
  };
}

export async function createAssetLead(input: {
  ownerUserId: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  assetId: string;
  partnerUserId: string;
  leadType: LeadType;
  ownerMessage?: string | null;
  includedSections?: Record<string, unknown> | null;
  allowAim4priceAssistance?: boolean;
}): Promise<AssetLead> {
  await ensurePartnerAccessTables();
  if (isAssistanceMasterAccountUserId(input.partnerUserId) && input.allowAim4priceAssistance !== true) {
    throw new Error('PARTNER_NOT_FOUND');
  }
  const allowedPartnerTypes = partnerTypesForLeadType(input.leadType);
  const partner = await getPartnerProfile(input.partnerUserId);
  const actualPartnerType = normalizePartnerType(partner?.account_type);

  if (!partner || !actualPartnerType || !allowedPartnerTypes.includes(actualPartnerType)) {
    throw new Error('PARTNER_NOT_FOUND');
  }

  const asset = await getAssetRegisterItemById(input.ownerUserId, input.assetId);

  if (!asset) {
    throw new Error('ASSET_NOT_FOUND');
  }

  if (input.leadType === 'license_renewal') {
    const renewalDate = readLeadSnapshotText(asset.specsJson, [
      'licenseRenewalDate',
      'license_renewal_date',
      'licenceRenewalDate',
      'licence_renewal_date',
    ]);
    if (!asset.isLicensed || !renewalDate) {
      throw new Error('LICENSE_RENEWAL_DETAILS_REQUIRED');
    }
  }

  const includedSections = sanitizeRegisterSnapshotDocuments(
    withNormalizedOwnerMessagePhotoSections(
      input.includedSections ?? { assetDetails: true, valuationSummary: true, mainPhoto: true },
    ),
    input.leadType,
    partner.account_subtype,
  );
  const registerLogoUrl = await getAssetRegisterReportLogoUrl(input.ownerUserId, asset.registerId).catch(() => '');

  const ownerProfile = await getAccountProfile({ id: input.ownerUserId, name: input.ownerName, email: input.ownerEmail });
  const ownerContactName = ownerProfile.businessName || ownerProfile.name || input.ownerName || 'Aim4price owner';
  const ownerContactPhone = ownerProfile.phone;
  const ownerContactEmail = ownerProfile.marketplaceEmail;

  const db = getDb();
  const insertResult = await db.query<{ id: string }>(
    `
      insert into asset_leads (
        owner_user_id,
        partner_user_id,
        asset_register_item_id,
        lead_type,
        status,
        asset_snapshot_json,
        included_sections_json,
        owner_message,
        owner_contact_name,
        owner_contact_phone,
        owner_contact_email,
        created_at,
        updated_at
      )
      values ($1, $2, $3::uuid, $4, 'sent', $5::jsonb, $6::jsonb, $7, $8, $9, $10, now(), now())
      returning id::text
    `,
    [
      input.ownerUserId,
      input.partnerUserId,
      asset.id,
      input.leadType,
      JSON.stringify({
        ...buildAssetLeadSnapshot(
          asset,
          includedSections,
          input.leadType,
          partner.account_subtype,
        ),
        logoUrl: registerLogoUrl,
      }),
      JSON.stringify(includedSections),
      asText(input.ownerMessage) || null,
      ownerContactName,
      ownerContactPhone || null,
      ownerContactEmail || null,
    ],
  );

  const leadId = insertResult.rows[0]?.id;
  const loaded = await db.query<LeadRow>(`${leadSelectSql('where l.id = $1::uuid')} limit 1`, [leadId]);
  const lead = mapLeadRow(loaded.rows[0]);

  await writeAuditEvent({
    ownerUserId: input.ownerUserId,
    actorUserId: input.ownerUserId,
    eventType: 'lead_sent',
    entityType: 'asset_lead',
    entityId: lead.id,
    metadata: { partnerUserId: input.partnerUserId, leadType: input.leadType, assetId: input.assetId },
  });

  return lead;
}

export async function listAssetLeadsForUser(
  userId: string,
  options: { limit?: number } = {},
): Promise<AssetLead[]> {
  await ensurePartnerAccessTables();
  const db = getDb();
  const requestedLimit = Number.isFinite(options.limit) ? Math.trunc(options.limit as number) : 0;
  const limit = requestedLimit > 0 ? Math.min(requestedLimit, 100) : 0;
  const queryParams: unknown[] = [userId];
  const limitSql = limit ? ' limit $2' : '';
  if (limit) queryParams.push(limit);
  const result = await db.query<LeadRow>(
    `${leadSelectSql('where l.owner_user_id = $1 or l.partner_user_id = $1')} order by l.created_at desc${limitSql}`,
    queryParams,
  );
  const leads = result.rows.map(mapLeadRow);
  const [attachmentLeads, correctionLeads, maintenanceLeads] = await Promise.all([
    hydrateLeadAttachmentSummaries(leads, userId),
    hydrateDealerAssetCorrections(leads, userId),
    hydrateDealerMaintenanceAccess(leads, userId),
  ]);

  return leads.map((lead, index) => ({
    ...lead,
    partnerNoteAttachmentCount: attachmentLeads[index]?.partnerNoteAttachmentCount ?? 0,
    latestPartnerNoteAttachmentFileName: attachmentLeads[index]?.latestPartnerNoteAttachmentFileName ?? '',
    latestPartnerNoteAttachmentByteSize: attachmentLeads[index]?.latestPartnerNoteAttachmentByteSize ?? null,
    latestPartnerNoteAttachmentCreatedAtIso: attachmentLeads[index]?.latestPartnerNoteAttachmentCreatedAtIso ?? null,
    assetSnapshot: correctionLeads[index]?.assetSnapshot ?? lead.assetSnapshot,
    dealerCorrection: correctionLeads[index]?.dealerCorrection,
    maintenanceAccess: maintenanceLeads[index]?.maintenanceAccess,
  }));
}

export async function getAssetLeadSummaryCountsForPartner(
  userId: string,
  leadType?: LeadType,
): Promise<AssetLeadSummaryCounts> {
  await ensurePartnerAccessTables();
  const params: unknown[] = [userId];
  const leadTypeSql = leadType ? 'and lead_type = $2' : '';
  if (leadType) params.push(leadType);

  const result = await getDb().query<{
    new_count: number | string;
    in_progress_count: number | string;
    completed_count: number | string;
    total_count: number | string;
  }>(
    `
      select
        count(*) filter (where status = 'sent' and viewed_at is null)::int as new_count,
        count(*) filter (
          where not (status = 'sent' and viewed_at is null)
            and status not in ('quoted', 'closed')
        )::int as in_progress_count,
        count(*) filter (where status in ('quoted', 'closed'))::int as completed_count,
        count(*)::int as total_count
      from public.asset_leads
      where partner_user_id = $1
        ${leadTypeSql}
    `,
    params,
  );
  const row = result.rows[0];

  return {
    newLeads: Number(row?.new_count ?? 0),
    inProgress: Number(row?.in_progress_count ?? 0),
    completed: Number(row?.completed_count ?? 0),
    total: Number(row?.total_count ?? 0),
  };
}

export async function getAssetLeadForPartner(input: {
  dealerUserId: string;
  leadId: string;
}): Promise<AssetLead | null> {
  await ensurePartnerAccessTables();
  const result = await getDb().query<LeadRow>(
    `${leadSelectSql('where l.id = $1::uuid and l.partner_user_id = $2')} limit 1`,
    [input.leadId, input.dealerUserId],
  );

  return result.rows[0] ? mapLeadRow(result.rows[0]) : null;
}

export async function updateAssetLeadPhotosForPartner(input: {
  dealerUserId: string;
  leadId: string;
  photos: string[];
}): Promise<void> {
  await ensurePartnerAccessTables();
  const photos = Array.from(new Set(input.photos.map(asText).filter(Boolean)));
  const result = await getDb().query<{ id: string }>(
    `
      update asset_leads
      set
        asset_snapshot_json = jsonb_set(
          coalesce(asset_snapshot_json, '{}'::jsonb),
          '{photos}',
          $3::jsonb,
          true
        ),
        updated_at = now()
      where id = $1::uuid
        and partner_user_id = $2
      returning id::text
    `,
    [input.leadId, input.dealerUserId, JSON.stringify(photos)],
  );

  if (!result.rows[0]) {
    throw new Error('LEAD_NOT_FOUND');
  }
}

export async function getAssetLeadLogoForUser(input: {
  currentUserId: string;
  leadId: string;
}): Promise<string> {
  await ensurePartnerAccessTables();
  const result = await getDb().query<{ logo_url: string | null }>(
    `
      select asset_snapshot_json ->> 'logoUrl' as logo_url
      from asset_leads
      where id = $1::uuid
        and (owner_user_id = $2 or partner_user_id = $2)
      limit 1
    `,
    [input.leadId, input.currentUserId],
  );
  const logoUrl = asText(result.rows[0]?.logo_url);

  if (
    logoUrl.startsWith('/')
    || /^https?:\/\//i.test(logoUrl)
    || /^data:image\/[a-z0-9.+-]+;base64,/i.test(logoUrl)
  ) {
    return logoUrl;
  }

  return '';
}

export async function updateAssetLeadStatus(input: {
  currentUserId: string;
  leadId: string;
  status: AssetLeadStatus;
}): Promise<AssetLead> {
  await ensurePartnerAccessTables();

  const db = getDb();
  const current = await db.query<LeadRow>(`${leadSelectSql('where l.id = $1::uuid')} limit 1`, [input.leadId]);
  const lead = current.rows[0] ? mapLeadRow(current.rows[0]) : null;

  if (!lead) {
    throw new Error('LEAD_NOT_FOUND');
  }

  const isOwner = lead.ownerUserId === input.currentUserId;
  const isPartner = lead.partnerUserId === input.currentUserId;

  if (!isOwner && !isPartner) {
    throw new Error('LEAD_FORBIDDEN');
  }

  if (input.status === 'closed' && !isOwner) {
    throw new Error('LEAD_FORBIDDEN');
  }

  if (input.status !== 'closed' && !isPartner) {
    throw new Error('LEAD_FORBIDDEN');
  }

  const timestampColumn = `${input.status}_at`;
  const allowedTimestampColumns = new Set(['viewed_at', 'accepted_at', 'quoted_at', 'declined_at', 'closed_at']);
  const timestampUpdate = allowedTimestampColumns.has(timestampColumn) ? `, ${timestampColumn} = coalesce(${timestampColumn}, now())` : '';

  await db.query(
    `
      update asset_leads
      set status = $1,
          updated_at = now()
          ${timestampUpdate}
      where id = $2::uuid
    `,
    [input.status, input.leadId],
  );

  const updated = await db.query<LeadRow>(`${leadSelectSql('where l.id = $1::uuid')} limit 1`, [input.leadId]);
  const withAttachments = await hydrateLeadAttachmentSummaries([mapLeadRow(updated.rows[0])], input.currentUserId);
  const withCorrections = await hydrateDealerAssetCorrections(withAttachments, input.currentUserId);
  const [updatedLead] = await hydrateDealerMaintenanceAccess(withCorrections, input.currentUserId);
  await writeAuditEvent({
    ownerUserId: updatedLead.ownerUserId,
    actorUserId: input.currentUserId,
    eventType: `lead_${input.status}`,
    entityType: 'asset_lead',
    entityId: updatedLead.id,
  });

  return updatedLead;
}

export async function createAssetLeadNote(input: {
  currentUserId: string;
  leadId: string;
  noteText: unknown;
  attachment?: CreateAssetLeadNoteAttachmentInput | null;
}): Promise<AssetPartnerNote> {
  await ensurePartnerAccessTables();
  const noteText = asText(input.noteText);
  const attachment = input.attachment ?? null;

  if (!noteText && !attachment) {
    throw new Error('NOTE_REQUIRED');
  }

  const storedNoteText = noteText || 'PDF quote attached.';

  const db = getDb();
  const current = await db.query<LeadRow>(`${leadSelectSql('where l.id = $1::uuid')} limit 1`, [input.leadId]);
  const lead = current.rows[0] ? mapLeadRow(current.rows[0]) : null;

  if (!lead) {
    throw new Error('LEAD_NOT_FOUND');
  }

  if (lead.partnerUserId !== input.currentUserId) {
    throw new Error('LEAD_FORBIDDEN');
  }

  const profile = await getAccountProfile({ id: input.currentUserId });
  if (!normalizePartnerType(profile.accountType)) {
    throw new Error('PARTNER_NOTE_FORBIDDEN');
  }

  const created = await db.query<AssetPartnerNoteRow>(
    `
      insert into asset_partner_notes (
        owner_user_id,
        partner_user_id,
        asset_register_item_id,
        note_text,
        status,
        attachment_file_name,
        attachment_content_type,
        attachment_byte_size,
        attachment_data,
        created_at,
        updated_at
      )
      values ($1, $2, $3::uuid, $4, 'open', $5, $6, $7, $8, now(), now())
      returning
        id::text,
        owner_user_id,
        partner_user_id,
        asset_register_item_id::text,
        note_text,
        status,
        null::text as partner_type,
        null::text as partner_display_name,
        null::text as partner_business_name,
        attachment_file_name,
        attachment_content_type,
        attachment_byte_size,
        created_at::text,
        noted_at::text,
        updated_at::text
    `,
    [
      lead.ownerUserId,
      input.currentUserId,
      lead.assetRegisterItemId,
      storedNoteText,
      attachment?.fileName ?? null,
      attachment?.contentType ?? null,
      attachment?.byteSize ?? null,
      attachment?.data ?? null,
    ],
  );

  const createdRow = created.rows[0];
  if (!createdRow) {
    throw new Error('ASSET_NOTE_NOT_CREATED');
  }

  const note = mapAssetPartnerNoteRow({
    ...createdRow,
    partner_type: profile.accountType,
    partner_display_name: profile.displayName || profile.name,
    partner_business_name: profile.businessName,
  });

  await writeAuditEvent({
    ownerUserId: lead.ownerUserId,
    actorUserId: input.currentUserId,
    eventType: 'lead_asset_note_left',
    entityType: 'asset_partner_note',
    entityId: note.id,
    metadata: { leadId: lead.id, assetId: lead.assetRegisterItemId },
  });

  return note;
}

export async function getAssetPartnerNoteAttachmentForUser(input: {
  currentUserId: string;
  noteId: string;
}): Promise<{ fileName: string; contentType: string; byteSize: number; data: Buffer }> {
  await ensurePartnerAccessTables();
  const db = getDb();
  const result = await db.query<{
    owner_user_id: string;
    partner_user_id: string;
    attachment_file_name: string | null;
    attachment_content_type: string | null;
    attachment_byte_size: string | number | null;
    attachment_data: Buffer | null;
  }>(
    `
      select
        owner_user_id,
        partner_user_id,
        attachment_file_name,
        attachment_content_type,
        attachment_byte_size,
        attachment_data
      from asset_partner_notes
      where id = $1::uuid
      limit 1
    `,
    [input.noteId],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error('ASSET_NOTE_NOT_FOUND');
  }

  if (row.owner_user_id !== input.currentUserId && row.partner_user_id !== input.currentUserId) {
    throw new Error('ASSET_NOTE_FORBIDDEN');
  }

  if (!row.attachment_data || !asText(row.attachment_file_name)) {
    throw new Error('ASSET_NOTE_ATTACHMENT_NOT_FOUND');
  }

  return {
    fileName: asText(row.attachment_file_name),
    contentType: asText(row.attachment_content_type) || 'application/pdf',
    byteSize: asInteger(row.attachment_byte_size) ?? row.attachment_data.length,
    data: row.attachment_data,
  };
}

export async function deleteDeclinedAssetLead(input: {
  currentUserId: string;
  leadId: string;
}): Promise<void> {
  await ensurePartnerAccessTables();
  const db = getDb();
  const current = await db.query<LeadRow>(`${leadSelectSql('where l.id = $1::uuid')} limit 1`, [input.leadId]);
  const lead = current.rows[0] ? mapLeadRow(current.rows[0]) : null;

  if (!lead) {
    throw new Error('LEAD_NOT_FOUND');
  }

  if (lead.partnerUserId !== input.currentUserId) {
    throw new Error('LEAD_FORBIDDEN');
  }

  if (lead.status !== 'declined') {
    throw new Error('LEAD_DELETE_REQUIRES_DECLINED');
  }

  await db.query('delete from asset_leads where id = $1::uuid', [input.leadId]);

  await writeAuditEvent({
    ownerUserId: lead.ownerUserId,
    actorUserId: input.currentUserId,
    eventType: 'lead_deleted',
    entityType: 'asset_lead',
    entityId: lead.id,
  });
}
