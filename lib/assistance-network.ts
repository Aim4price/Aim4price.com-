import { ensureAccountProfileColumns, getAccountProfile } from './account-profile';
import { getDb } from './db';
import { sendAim4priceEmail } from './email';
import type { LeadType, PartnerDirectoryEntry, PartnerType } from './partner-access';
import locationSeedJson from '../database/seeds/aim4price-assistance-locations.json';

export type AssistanceServiceKey = 'finance' | 'accounting' | 'insurance' | 'dealer' | 'licensing';

export type AssistanceMapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type AssistanceLocationSeed = {
  province: string;
  town: string;
  slug: string;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  geonamesId: string;
};

export type AssistanceMasterDefinition = {
  serviceKey: AssistanceServiceKey;
  partnerUserId: string;
  partnerType: PartnerType;
  accountSubtype: string;
  displayName: string;
  listingPrefix: string;
  notificationEmail: string;
  routingEmail: string;
};

export const AIM4PRICE_ASSISTANCE_ROUTING_EMAIL = 'aim4price@gmail.com';
export const AIM4PRICE_MANAGED_BADGE = 'Aim4price managed';
export const AIM4PRICE_SERVICE_AREA_NOTICE =
  'This location represents an Aim4price service area, not a physical branch.';
export const AIM4PRICE_PROVIDER_APPROVAL_NOTICE =
  'Aim4price will help locate a suitable provider. Your assets will not be shared with an external provider without your further approval.';

export const ASSISTANCE_MASTER_DEFINITIONS: readonly AssistanceMasterDefinition[] = [
  {
    serviceKey: 'finance',
    partnerUserId: 'aim4price-assistance-finance',
    partnerType: 'finance',
    accountSubtype: 'finance-house',
    displayName: 'Aim4price Finance Assistance',
    listingPrefix: 'Aim4price Finance Assistance',
    notificationEmail: 'finance@aim4price.com',
    routingEmail: AIM4PRICE_ASSISTANCE_ROUTING_EMAIL,
  },
  {
    serviceKey: 'accounting',
    partnerUserId: 'aim4price-assistance-accounting',
    partnerType: 'finance',
    accountSubtype: 'accountant',
    displayName: 'Aim4price Accounting Assistance',
    listingPrefix: 'Aim4price Accounting Assistance',
    notificationEmail: 'accounting@aim4price.com',
    routingEmail: AIM4PRICE_ASSISTANCE_ROUTING_EMAIL,
  },
  {
    serviceKey: 'insurance',
    partnerUserId: 'aim4price-assistance-insurance',
    partnerType: 'insurance',
    accountSubtype: 'short-term-insurer',
    displayName: 'Aim4price Insurance Assistance',
    listingPrefix: 'Aim4price Insurance Assistance',
    notificationEmail: 'insurance@aim4price.com',
    routingEmail: AIM4PRICE_ASSISTANCE_ROUTING_EMAIL,
  },
  {
    serviceKey: 'dealer',
    partnerUserId: 'aim4price-assistance-dealer',
    partnerType: 'dealer',
    accountSubtype: 'machinery-dealer',
    displayName: 'Aim4price Dealer Assistance',
    listingPrefix: 'Aim4price Dealer Assistance',
    notificationEmail: 'dealers@aim4price.com',
    routingEmail: AIM4PRICE_ASSISTANCE_ROUTING_EMAIL,
  },
  {
    serviceKey: 'licensing',
    partnerUserId: 'aim4price-assistance-licensing',
    partnerType: 'licensing',
    accountSubtype: 'licence-renewal-expert',
    displayName: 'Aim4price Licence Renewal Assistance',
    listingPrefix: 'Aim4price Licence Renewal Assistance',
    notificationEmail: 'licensing@aim4price.com',
    routingEmail: AIM4PRICE_ASSISTANCE_ROUTING_EMAIL,
  },
] as const;

export const ASSISTANCE_LOCATION_SEED = locationSeedJson as AssistanceLocationSeed[];

export function isAssistanceMasterAccountUserId(value: unknown): boolean {
  const userId = asText(value);
  return ASSISTANCE_MASTER_DEFINITIONS.some((entry) => entry.partnerUserId === userId);
}

export function validateAssistanceSeed(): void {
  if (ASSISTANCE_MASTER_DEFINITIONS.length !== 5) throw new Error('ASSISTANCE_MASTER_COUNT_INVALID');
  if (ASSISTANCE_LOCATION_SEED.length !== 100) throw new Error('ASSISTANCE_LOCATION_COUNT_INVALID');
  const serviceKeys = new Set<AssistanceServiceKey>();
  const partnerUserIds = new Set<string>();
  for (const master of ASSISTANCE_MASTER_DEFINITIONS) {
    if (serviceKeys.has(master.serviceKey) || partnerUserIds.has(master.partnerUserId)) {
      throw new Error('ASSISTANCE_MASTER_DUPLICATE');
    }
    serviceKeys.add(master.serviceKey);
    partnerUserIds.add(master.partnerUserId);
  }
  const townSlugs = new Set<string>();
  for (const location of ASSISTANCE_LOCATION_SEED) {
    if (townSlugs.has(location.slug)) throw new Error('ASSISTANCE_LOCATION_DUPLICATE');
    if (
      !location.province
      || !location.town
      || !location.slug
      || !Number.isFinite(location.latitude)
      || !Number.isFinite(location.longitude)
      || location.latitude < -90
      || location.latitude > 90
      || location.longitude < -180
      || location.longitude > 180
      || !Number.isInteger(location.serviceRadiusKm)
      || location.serviceRadiusKm < 25
      || location.serviceRadiusKm > 500
    ) {
      throw new Error('ASSISTANCE_LOCATION_INVALID');
    }
    townSlugs.add(location.slug);
  }
}

type AssistanceDirectoryRow = {
  location_id: string;
  service_key: AssistanceServiceKey;
  partner_user_id: string;
  partner_type: PartnerType;
  account_subtype: string;
  display_name: string;
  listing_prefix: string;
  notification_email: string;
  province: string;
  town: string;
  latitude: string | number;
  longitude: string | number;
  service_radius_km: string | number;
};

export type AssistanceSelection = {
  locationId: string;
  serviceKey: AssistanceServiceKey;
  masterAccountUserId: string;
  partnerType: PartnerType;
  accountSubtype: string;
  displayName: string;
  notificationEmail: string;
  routingEmail: string;
  province: string;
  town: string;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
};

export type AssistanceAdminLocation = {
  id: string;
  province: string;
  town: string;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  enabled: boolean;
};

export type AssistanceAdminAccount = AssistanceMasterDefinition & {
  enabled: boolean;
  locations: AssistanceAdminLocation[];
};

let assistanceTablesEnsured = false;
let assistanceTablesPromise: Promise<void> | null = null;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function escapeEmailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function masterForService(serviceKey: AssistanceServiceKey): AssistanceMasterDefinition {
  const master = ASSISTANCE_MASTER_DEFINITIONS.find((entry) => entry.serviceKey === serviceKey);
  if (!master) throw new Error('ASSISTANCE_SERVICE_NOT_FOUND');
  return master;
}

function serviceKeysForPartnerType(partnerType: PartnerType): AssistanceServiceKey[] {
  if (partnerType === 'finance') return ['finance', 'accounting'];
  if (partnerType === 'insurance') return ['insurance'];
  if (partnerType === 'dealer') return ['dealer'];
  return ['licensing'];
}

function serviceKeysForLeadType(leadType: LeadType): AssistanceServiceKey[] {
  if (leadType === 'finance') return ['finance', 'accounting'];
  if (leadType === 'insurance') return ['insurance'];
  if (leadType === 'replacement_quote') return ['dealer'];
  return ['licensing'];
}

async function seedAssistanceNetwork(): Promise<void> {
  validateAssistanceSeed();
  await ensureAccountProfileColumns();
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtext('aim4price:national-assistance-network:v1'))");
    await client.query('create extension if not exists pgcrypto');

    await client.query(`
      create table if not exists aim4price_assistance_accounts (
        service_key text primary key,
        partner_user_id text not null unique,
        partner_type text not null,
        account_subtype text not null,
        display_name text not null,
        listing_prefix text not null,
        notification_email text not null,
        routing_email text not null default 'aim4price@gmail.com',
        managed_by_user_id text,
        enabled boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint aim4price_assistance_accounts_service_check
          check (service_key in ('finance', 'accounting', 'insurance', 'dealer', 'licensing')),
        constraint aim4price_assistance_accounts_partner_check
          check (partner_type in ('finance', 'insurance', 'dealer', 'licensing'))
      )
    `);

    await client.query(`
      create table if not exists aim4price_assistance_locations (
        id text primary key,
        service_key text not null references aim4price_assistance_accounts(service_key) on delete restrict,
        province text not null,
        town text not null,
        town_slug text not null,
        latitude double precision not null,
        longitude double precision not null,
        service_radius_km integer not null,
        geonames_id text,
        enabled boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint aim4price_assistance_locations_unique unique (service_key, town_slug),
        constraint aim4price_assistance_locations_latitude_check check (latitude between -90 and 90),
        constraint aim4price_assistance_locations_longitude_check check (longitude between -180 and 180),
        constraint aim4price_assistance_locations_radius_check check (service_radius_km between 25 and 500)
      )
    `);

    await client.query(`
      create table if not exists aim4price_assistance_requests (
        id uuid primary key default gen_random_uuid(),
        assistance_location_id text not null references aim4price_assistance_locations(id) on delete restrict,
        service_key text not null references aim4price_assistance_accounts(service_key) on delete restrict,
        master_partner_user_id text not null,
        owner_user_id text not null,
        owner_name text,
        owner_email text,
        owner_phone text,
        province text not null,
        town text not null,
        selected_asset_ids_json jsonb not null default '[]'::jsonb,
        asset_lead_ids_json jsonb not null default '[]'::jsonb,
        asset_group_id text,
        asset_group_name text,
        included_sections_json jsonb not null default '{}'::jsonb,
        owner_message text,
        notification_email text not null,
        notification_status text not null default 'pending',
        notification_error text,
        provider_approval_status text not null default 'not_requested',
        external_provider_user_id text,
        provider_approved_at timestamptz,
        provider_approved_by_user_id text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint aim4price_assistance_requests_notification_check
          check (notification_status in ('pending', 'sent', 'failed')),
        constraint aim4price_assistance_requests_provider_approval_check
          check (provider_approval_status in ('not_requested', 'requested', 'approved', 'declined')),
        constraint aim4price_assistance_requests_external_share_check
          check (
            external_provider_user_id is null
            or (
              provider_approval_status = 'approved'
              and provider_approved_at is not null
              and provider_approved_by_user_id = owner_user_id
            )
          )
      )
    `);

    await client.query(`
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

    await client.query(`
      create index if not exists idx_assistance_locations_viewport
        on aim4price_assistance_locations(service_key, enabled, latitude, longitude)
    `);
    await client.query(`
      create index if not exists idx_assistance_requests_owner_created
        on aim4price_assistance_requests(owner_user_id, created_at desc)
    `);

    const authUserTable = await client.query<{ exists: boolean }>(`
      select to_regclass('public."user"') is not null as exists
    `);
    const adminResult = authUserTable.rows[0]?.exists
      ? await client.query<{ id: string }>(`
          select id from public."user" where lower(trim(email)) = $1 limit 1
        `, [AIM4PRICE_ASSISTANCE_ROUTING_EMAIL])
      : { rows: [] as { id: string }[] };
    const managedByUserId = adminResult.rows[0]?.id ?? null;

    for (const master of ASSISTANCE_MASTER_DEFINITIONS) {
      await client.query(`
        insert into aim4price_assistance_accounts (
          service_key, partner_user_id, partner_type, account_subtype, display_name,
          listing_prefix, notification_email, routing_email, managed_by_user_id, enabled,
          created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, now(), now())
        on conflict (service_key) do update set
          partner_user_id = excluded.partner_user_id,
          partner_type = excluded.partner_type,
          account_subtype = excluded.account_subtype,
          display_name = excluded.display_name,
          listing_prefix = excluded.listing_prefix,
          notification_email = excluded.notification_email,
          routing_email = excluded.routing_email,
          managed_by_user_id = excluded.managed_by_user_id,
          updated_at = now()
      `, [
        master.serviceKey,
        master.partnerUserId,
        master.partnerType,
        master.accountSubtype,
        master.displayName,
        master.listingPrefix,
        master.notificationEmail,
        master.routingEmail,
        managedByUserId,
      ]);

      await client.query(`
        insert into account_profiles (
          user_id, display_name, business_name, account_type, account_subtype, account_status,
          introduced_by_option, marketplace_email, marketplace_location,
          discovery_participation_enabled, partner_directory_enabled, partner_directory_status,
          partner_description, partner_brand_focus, partner_services, notes, created_at, updated_at
        ) values (
          $1, $2, $2, $3, $4, 'active', 'direct', $5, 'South Africa',
          false, false, 'approved', $6, 'Aim4price national assistance network', $7, $8, now(), now()
        )
        on conflict (user_id) do update set
          display_name = excluded.display_name,
          business_name = excluded.business_name,
          account_type = excluded.account_type,
          account_subtype = excluded.account_subtype,
          account_status = 'active',
          marketplace_email = excluded.marketplace_email,
          marketplace_location = excluded.marketplace_location,
          discovery_participation_enabled = false,
          partner_directory_enabled = false,
          partner_description = excluded.partner_description,
          partner_brand_focus = excluded.partner_brand_focus,
          partner_services = excluded.partner_services,
          notes = excluded.notes,
          updated_at = now()
      `, [
        master.partnerUserId,
        master.displayName,
        master.partnerType,
        master.accountSubtype,
        master.notificationEmail,
        AIM4PRICE_SERVICE_AREA_NOTICE,
        master.displayName,
        `System-managed by ${master.routingEmail}. This is not a login account.`,
      ]);

      await client.query(`
        insert into aim4price_assistance_locations (
          id, service_key, province, town, town_slug, latitude, longitude,
          service_radius_km, geonames_id, enabled, created_at, updated_at
        )
        select
          'aim4price-assistance-' || $1 || '-' || seed.slug,
          $1,
          seed.province,
          seed.town,
          seed.slug,
          seed.latitude,
          seed.longitude,
          seed."serviceRadiusKm",
          seed."geonamesId",
          true,
          now(),
          now()
        from jsonb_to_recordset($2::jsonb) as seed(
          province text,
          town text,
          slug text,
          latitude double precision,
          longitude double precision,
          "serviceRadiusKm" integer,
          "geonamesId" text
        )
        on conflict (service_key, town_slug) do update set
          id = excluded.id,
          province = excluded.province,
          town = excluded.town,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          service_radius_km = excluded.service_radius_km,
          geonames_id = excluded.geonames_id,
          updated_at = now()
      `, [master.serviceKey, JSON.stringify(ASSISTANCE_LOCATION_SEED)]);
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function isAssistanceNetworkReady(): Promise<boolean> {
  try {
    const partnerUserIds = ASSISTANCE_MASTER_DEFINITIONS.map((entry) => entry.partnerUserId);
    const result = await getDb().query<{
      account_count_ready: boolean;
      location_count_ready: boolean;
      profile_count_ready: boolean;
      request_schema_ready: boolean;
    }>(`
      select
        (select count(*) = 5 from aim4price_assistance_accounts) as account_count_ready,
        (select count(*) = 500 from aim4price_assistance_locations) as location_count_ready,
        (
          select count(*) = 5
          from account_profiles
          where user_id = any($1::text[])
        ) as profile_count_ready,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'aim4price_assistance_requests'
            and column_name = 'provider_approval_status'
        ) as request_schema_ready
    `, [partnerUserIds]);
    const row = result.rows[0];
    return row?.account_count_ready === true
      && row?.location_count_ready === true
      && row?.profile_count_ready === true
      && row?.request_schema_ready === true;
  } catch {
    return false;
  }
}

export async function ensureAssistanceNetwork(): Promise<void> {
  if (assistanceTablesEnsured) return;
  if (!assistanceTablesPromise) {
    assistanceTablesPromise = isAssistanceNetworkReady()
      .then((ready) => ready ? undefined : seedAssistanceNetwork())
      .then(() => {
        assistanceTablesEnsured = true;
      })
      .catch((error) => {
        assistanceTablesPromise = null;
        throw error;
      });
  }
  await assistanceTablesPromise;
}

export async function listAssistanceDirectoryEntries(input: {
  partnerType: PartnerType;
  search?: string | null;
  bounds?: AssistanceMapBounds | null;
}): Promise<PartnerDirectoryEntry[]> {
  await ensureAssistanceNetwork();
  const db = getDb();
  const serviceKeys = serviceKeysForPartnerType(input.partnerType);
  const search = asText(input.search).toLowerCase();
  const params: unknown[] = [serviceKeys];
  const filters = [
    'a.enabled = true',
    'l.enabled = true',
    'a.service_key = any($1::text[])',
  ];

  if (search) {
    params.push(`%${search}%`);
    filters.push(`(
      lower(a.listing_prefix) like $${params.length}
      or lower(a.display_name) like $${params.length}
      or lower(l.town) like $${params.length}
      or lower(l.province) like $${params.length}
      or lower(a.service_key) like $${params.length}
    )`);
  } else if (input.bounds) {
    const { west, south, east, north } = input.bounds;
    params.push(south, north, west, east);
    const southIndex = params.length - 3;
    const northIndex = params.length - 2;
    const westIndex = params.length - 1;
    const eastIndex = params.length;
    filters.push(`l.latitude between $${southIndex} and $${northIndex}`);
    filters.push(west <= east
      ? `l.longitude between $${westIndex} and $${eastIndex}`
      : `(l.longitude >= $${westIndex} or l.longitude <= $${eastIndex})`);
  } else {
    // Managed locations are intentionally viewport/search driven; this prevents
    // loading all 500 service-area markers into an unopened map.
    filters.push('false');
  }

  const result = await db.query<AssistanceDirectoryRow>(`
    select
      l.id as location_id,
      a.service_key,
      a.partner_user_id,
      a.partner_type,
      a.account_subtype,
      a.display_name,
      a.listing_prefix,
      a.notification_email,
      l.province,
      l.town,
      l.latitude,
      l.longitude,
      l.service_radius_km
    from aim4price_assistance_locations l
    join aim4price_assistance_accounts a on a.service_key = l.service_key
    where ${filters.join('\n      and ')}
    order by l.province, l.town, a.service_key
    limit 500
  `, params);

  return result.rows.map((row) => ({
    userId: `assistance-location:${row.location_id}`,
    masterAccountUserId: row.partner_user_id,
    partnerType: row.partner_type,
    accountSubtype: row.account_subtype,
    displayName: `${row.listing_prefix} – ${row.town}`,
    businessName: `${row.listing_prefix} – ${row.town}`,
    phone: '',
    email: row.notification_email,
    province: row.province,
    townCity: row.town,
    addressLine1: '',
    logoUrl: '',
    websiteUrl: '',
    extraPhotoUrls: [],
    description: AIM4PRICE_SERVICE_AREA_NOTICE,
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    serviceRadiusKm: Math.round(asNumber(row.service_radius_km)),
    brandFocus: AIM4PRICE_MANAGED_BADGE,
    services: row.display_name,
    isAim4priceManaged: true,
    isActivePartner: false,
    assistanceLocationId: row.location_id,
    assistanceServiceKey: row.service_key,
    serviceAreaNotice: AIM4PRICE_SERVICE_AREA_NOTICE,
  }));
}

export async function resolveAssistanceSelection(input: {
  assistanceLocationId: string;
  masterAccountUserId: string;
  leadType: LeadType;
}): Promise<AssistanceSelection> {
  await ensureAssistanceNetwork();
  const result = await getDb().query<AssistanceDirectoryRow & { routing_email: string }>(`
    select
      l.id as location_id,
      a.service_key,
      a.partner_user_id,
      a.partner_type,
      a.account_subtype,
      a.display_name,
      a.listing_prefix,
      a.notification_email,
      a.routing_email,
      l.province,
      l.town,
      l.latitude,
      l.longitude,
      l.service_radius_km
    from aim4price_assistance_locations l
    join aim4price_assistance_accounts a on a.service_key = l.service_key
    where l.id = $1
      and a.partner_user_id = $2
      and l.enabled = true
      and a.enabled = true
    limit 1
  `, [input.assistanceLocationId, input.masterAccountUserId]);
  const row = result.rows[0];
  if (!row || !serviceKeysForLeadType(input.leadType).includes(row.service_key)) {
    throw new Error('ASSISTANCE_LOCATION_NOT_FOUND');
  }

  return {
    locationId: row.location_id,
    serviceKey: row.service_key,
    masterAccountUserId: row.partner_user_id,
    partnerType: row.partner_type,
    accountSubtype: row.account_subtype,
    displayName: `${row.listing_prefix} – ${row.town}`,
    notificationEmail: row.notification_email,
    routingEmail: row.routing_email,
    province: row.province,
    town: row.town,
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    serviceRadiusKm: Math.round(asNumber(row.service_radius_km)),
  };
}

export async function createAssistanceRequest(input: {
  selection: AssistanceSelection;
  ownerUserId: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  selectedAssetIds: string[];
  assetLeadIds: string[];
  assetGroupId?: string | null;
  assetGroupName?: string | null;
  includedSections?: Record<string, unknown> | null;
  ownerMessage?: string | null;
}): Promise<{ id: string; notificationStatus: 'sent' | 'failed' }> {
  await ensureAssistanceNetwork();
  const selectedAssetIds = Array.from(new Set(input.selectedAssetIds.map(asText).filter(Boolean)));
  const assetLeadIds = Array.from(new Set(input.assetLeadIds.map(asText).filter(Boolean)));
  if (!selectedAssetIds.length) throw new Error('ASSISTANCE_ASSETS_REQUIRED');

  const ownerProfile = await getAccountProfile({
    id: input.ownerUserId,
    name: input.ownerName,
    email: input.ownerEmail,
  });
  const ownerName = ownerProfile.businessName || ownerProfile.name || asText(input.ownerName) || 'Aim4price owner';
  const ownerEmail = ownerProfile.marketplaceEmail || asText(input.ownerEmail);
  const ownerPhone = ownerProfile.phone;
  const db = getDb();
  const insert = await db.query<{ id: string }>(`
    insert into aim4price_assistance_requests (
      assistance_location_id, service_key, master_partner_user_id,
      owner_user_id, owner_name, owner_email, owner_phone,
      province, town, selected_asset_ids_json, asset_lead_ids_json,
      asset_group_id, asset_group_name, included_sections_json, owner_message,
      notification_email, notification_status, created_at, updated_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb,
      $12, $13, $14::jsonb, $15, $16, 'pending', now(), now()
    ) returning id::text
  `, [
    input.selection.locationId,
    input.selection.serviceKey,
    input.selection.masterAccountUserId,
    input.ownerUserId,
    ownerName,
    ownerEmail || null,
    ownerPhone || null,
    input.selection.province,
    input.selection.town,
    JSON.stringify(selectedAssetIds),
    JSON.stringify(assetLeadIds),
    asText(input.assetGroupId) || null,
    asText(input.assetGroupName) || null,
    JSON.stringify(input.includedSections ?? {}),
    asText(input.ownerMessage) || null,
    input.selection.notificationEmail,
  ]);
  const requestId = insert.rows[0]?.id;
  if (!requestId) throw new Error('ASSISTANCE_REQUEST_NOT_CREATED');

  await db.query(`
    insert into access_audit_events (
      owner_user_id, actor_user_id, event_type, entity_type, entity_id, metadata_json, created_at
    ) values ($1, $1, 'aim4price_assistance_requested', 'aim4price_assistance_request', $2, $3::jsonb, now())
  `, [input.ownerUserId, requestId, JSON.stringify({
    service: input.selection.serviceKey,
    town: input.selection.town,
    province: input.selection.province,
    masterAccountUserId: input.selection.masterAccountUserId,
    selectedAssetIds,
    externalProviderShared: false,
  })]);

  const subject = `${input.selection.displayName}: assistance request from ${ownerName}`;
  const text = [
    'A new Aim4price-managed assistance request was submitted.',
    '',
    `Request: ${requestId}`,
    `Service: ${input.selection.serviceKey}`,
    `Service area: ${input.selection.town}, ${input.selection.province}`,
    `Owner: ${ownerName}`,
    `Owner email: ${ownerEmail || 'Not provided'}`,
    `Owner phone: ${ownerPhone || 'Not provided'}`,
    `Assets: ${selectedAssetIds.join(', ')}`,
    `Lead records: ${assetLeadIds.join(', ') || 'None'}`,
    `Group: ${asText(input.assetGroupName) || asText(input.assetGroupId) || 'Not grouped'}`,
    `Owner message: ${asText(input.ownerMessage) || 'None'}`,
    '',
    'Do not share these assets with an external provider until the owner gives further approval.',
    `Managed by: ${input.selection.routingEmail}`,
  ].join('\n');
  const html = `<h2>New Aim4price-managed assistance request</h2>
    <p><strong>Request:</strong> ${escapeEmailHtml(requestId)}</p>
    <p><strong>Service:</strong> ${escapeEmailHtml(input.selection.serviceKey)}</p>
    <p><strong>Service area:</strong> ${escapeEmailHtml(`${input.selection.town}, ${input.selection.province}`)}</p>
    <p><strong>Owner:</strong> ${escapeEmailHtml(ownerName)}</p>
    <p><strong>Owner email:</strong> ${escapeEmailHtml(ownerEmail || 'Not provided')}</p>
    <p><strong>Owner phone:</strong> ${escapeEmailHtml(ownerPhone || 'Not provided')}</p>
    <p><strong>Assets:</strong> ${escapeEmailHtml(selectedAssetIds.join(', '))}</p>
    <p><strong>Lead records:</strong> ${escapeEmailHtml(assetLeadIds.join(', ') || 'None')}</p>
    <p><strong>Group:</strong> ${escapeEmailHtml(asText(input.assetGroupName) || asText(input.assetGroupId) || 'Not grouped')}</p>
    <p><strong>Owner message:</strong> ${escapeEmailHtml(asText(input.ownerMessage) || 'None')}</p>
    <p><strong>Owner approval required:</strong> Do not share these assets with an external provider until the owner gives further approval.</p>`;

  try {
    await sendAim4priceEmail({
      to: input.selection.notificationEmail,
      replyTo: input.selection.routingEmail,
      subject,
      html,
      text,
    });
    await db.query(`
      update aim4price_assistance_requests
      set notification_status = 'sent', notification_error = null, updated_at = now()
      where id = $1::uuid
    `, [requestId]);
    return { id: requestId, notificationStatus: 'sent' };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2000) : 'Notification failed';
    await db.query(`
      update aim4price_assistance_requests
      set notification_status = 'failed', notification_error = $2, updated_at = now()
      where id = $1::uuid
    `, [requestId, message]);
    throw new Error('ASSISTANCE_NOTIFICATION_FAILED');
  }
}

export async function assertAssistanceProviderShareApproved(input: {
  requestId: string;
  ownerUserId: string;
  externalProviderUserId: string;
}): Promise<void> {
  await ensureAssistanceNetwork();
  const result = await getDb().query(`
    select 1
    from aim4price_assistance_requests
    where id = $1::uuid
      and owner_user_id = $2
      and external_provider_user_id = $3
      and provider_approval_status = 'approved'
      and provider_approved_at is not null
      and provider_approved_by_user_id = owner_user_id
    limit 1
  `, [input.requestId, input.ownerUserId, input.externalProviderUserId]);
  if (!result.rowCount) throw new Error('ASSISTANCE_PROVIDER_APPROVAL_REQUIRED');
}

export async function listAssistanceNetworkForAdmin(): Promise<AssistanceAdminAccount[]> {
  await ensureAssistanceNetwork();
  type Row = AssistanceDirectoryRow & { account_enabled: boolean; location_enabled: boolean; routing_email: string };
  const result = await getDb().query<Row>(`
    select
      l.id as location_id,
      a.service_key,
      a.partner_user_id,
      a.partner_type,
      a.account_subtype,
      a.display_name,
      a.listing_prefix,
      a.notification_email,
      a.routing_email,
      a.enabled as account_enabled,
      l.enabled as location_enabled,
      l.province,
      l.town,
      l.latitude,
      l.longitude,
      l.service_radius_km
    from aim4price_assistance_accounts a
    join aim4price_assistance_locations l on l.service_key = a.service_key
    order by a.service_key, l.province, l.town
  `);
  const rowsByService = new Map<AssistanceServiceKey, Row[]>();
  for (const row of result.rows) {
    const rows = rowsByService.get(row.service_key) ?? [];
    rows.push(row);
    rowsByService.set(row.service_key, rows);
  }

  return ASSISTANCE_MASTER_DEFINITIONS.map((definition) => {
    const rows = rowsByService.get(definition.serviceKey) ?? [];
    return {
      ...definition,
      enabled: rows[0]?.account_enabled ?? true,
      locations: rows.map((row) => ({
        id: row.location_id,
        province: row.province,
        town: row.town,
        latitude: asNumber(row.latitude),
        longitude: asNumber(row.longitude),
        serviceRadiusKm: Math.round(asNumber(row.service_radius_km)),
        enabled: row.location_enabled,
      })),
    };
  });
}

export async function setAssistanceEnabled(input: {
  actorUserId: string;
  serviceKey: AssistanceServiceKey;
  locationId?: string | null;
  enabled: boolean;
}): Promise<void> {
  await ensureAssistanceNetwork();
  masterForService(input.serviceKey);
  const db = getDb();
  if (input.locationId) {
    const result = await db.query(`
      update aim4price_assistance_locations
      set enabled = $3, updated_at = now()
      where id = $1 and service_key = $2
    `, [input.locationId, input.serviceKey, input.enabled]);
    if (!result.rowCount) throw new Error('ASSISTANCE_LOCATION_NOT_FOUND');
  } else {
    const result = await db.query(`
      update aim4price_assistance_accounts
      set enabled = $2, updated_at = now()
      where service_key = $1
    `, [input.serviceKey, input.enabled]);
    if (!result.rowCount) throw new Error('ASSISTANCE_SERVICE_NOT_FOUND');
  }

  await db.query(`
    insert into access_audit_events (
      actor_user_id, event_type, entity_type, entity_id, metadata_json, created_at
    ) values ($1, 'aim4price_assistance_availability_changed', $2, $3, $4::jsonb, now())
  `, [
    input.actorUserId,
    input.locationId ? 'aim4price_assistance_location' : 'aim4price_assistance_account',
    input.locationId || input.serviceKey,
    JSON.stringify({ serviceKey: input.serviceKey, enabled: input.enabled }),
  ]);
}
