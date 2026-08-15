import { getDb } from "./db";
import {
  accountStatusLabel,
  cleanIntroducedByName,
  isAim4priceAdminEmail,
  normalizeAccountStatus,
  normalizeIntroducedByOption,
  resolveIntroducedByDisplay,
  type AccountStatus,
  type IntroducedByOption,
} from "./account-constants";
import {
  getOrCreatePrimaryAssetRegister,
  updateAssetRegisterLogo,
} from "./asset-registers";
import { isDatabaseSchemaReady } from "./database-schema-readiness";

export type AccountProfile = {
  userId: string;
  name: string;
  displayName: string;
  email: string;
  logoUrl: string;
  websiteUrl: string;
  extraPhotoUrls: string[];
  businessName: string;
  phone: string;
  accountType: string;
  accountSubtype: string;
  accountStatus: AccountStatus;
  accountStatusLabel: string;
  introducedByOption: IntroducedByOption;
  introducedByName: string;
  introducedByDisplay: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  marketplaceSellerName: string;
  marketplacePhone: string;
  marketplaceEmail: string;
  marketplaceLocation: string;
  discoveryParticipationEnabled: boolean;
  partnerDirectoryEnabled: boolean;
  partnerDirectoryStatus: string;
  partnerDescription: string;
  partnerLatitude: number | null;
  partnerLongitude: number | null;
  partnerServiceRadiusKm: number | null;
  partnerBrandFocus: string;
  partnerServices: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

export type AccountScanPinStatus = {
  enabled: boolean;
  hasPin: boolean;
  updatedAtIso: string | null;
};

export type UpsertAccountProfileInput = {
  displayName?: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  extraPhotoUrls?: unknown;
  businessName?: string | null;
  phone?: string | null;
  accountType?: string | null;
  accountSubtype?: string | null;
  vatNumber?: string | null;
  province?: string | null;
  townCity?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  notes?: string | null;
  marketplaceSellerName?: string | null;
  marketplacePhone?: string | null;
  marketplaceEmail?: string | null;
  marketplaceLocation?: string | null;
  discoveryParticipationEnabled?: boolean | null;
  partnerDirectoryEnabled?: boolean | null;
  partnerDirectoryStatus?: string | null;
  partnerDescription?: string | null;
  partnerLatitude?: string | number | null;
  partnerLongitude?: string | number | null;
  partnerServiceRadiusKm?: string | number | null;
  partnerBrandFocus?: string | null;
  partnerServices?: string | null;
  syncPrimaryLogoToRegister?: boolean | null;
};

type AccountProfileRow = {
  user_id: string;
  display_name: string | null;
  logo_url: string | null;
  website_url: string | null;
  extra_photo_urls: unknown;
  business_name: string | null;
  phone: string | null;
  account_type: string | null;
  account_subtype: string | null;
  account_status: string | null;
  introduced_by_option: string | null;
  introduced_by_name: string | null;
  vat_number: string | null;
  province: string | null;
  town_city: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  notes: string | null;
  marketplace_seller_name: string | null;
  marketplace_phone: string | null;
  marketplace_email: string | null;
  marketplace_location: string | null;
  discovery_participation_enabled: boolean | null;
  partner_directory_enabled: boolean | null;
  partner_directory_status: string | null;
  partner_description: string | null;
  partner_latitude: string | number | null;
  partner_longitude: string | number | null;
  partner_service_radius_km: string | number | null;
  partner_brand_focus: string | null;
  partner_services: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AccountScanPinRow = {
  scan_pin_hash: string | null;
  scan_pin_enabled: boolean | null;
  scan_pin_updated_at: string | null;
};

type AccountTypeRow = {
  account_type: string | null;
  account_subtype: string | null;
  logo_url: string | null;
  discovery_participation_enabled: boolean | null;
};

const MAX_LOGO_URL_LENGTH = 3_000_000;
const MAX_BUSINESS_EXTRA_PHOTOS = 6;
const MAX_BUSINESS_PHOTO_URL_LENGTH = 7_000_000;
const MAX_WEBSITE_URL_LENGTH = 300;
const SOUTH_AFRICAN_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
] as const;
let accountProfileColumnsEnsured = false;
let accountProfileColumnsPromise: Promise<void> | null = null;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProvince(value: unknown): string {
  const raw = asText(value);

  if (!raw) {
    return "";
  }

  const normalized = raw
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized === "kzn") {
    return "KwaZulu-Natal";
  }

  return (
    SOUTH_AFRICAN_PROVINCES.find(
      (province) =>
        province
          .toLowerCase()
          .replace(/[-_]+/g, " ")
          .replace(/\s+/g, " ") === normalized,
    ) ?? raw
  );
}

function normalizeAccountType(value: unknown): string {
  const normalized = asText(value)
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

  if (
    normalized === "bank" ||
    normalized === "finance-house" ||
    normalized === "accountant" ||
    normalized === "accounting" ||
    normalized === "finance"
  ) {
    return "finance";
  }

  if (
    normalized === "auction-house" ||
    normalized === "auctioneer" ||
    normalized === "middleman" ||
    normalized === "machinery-middleman" ||
    normalized === "equipment-middleman" ||
    normalized === "dealer" ||
    normalized === "machinery-dealer" ||
    normalized === "motor-dealer"
  ) {
    return "dealer";
  }

  if (
    normalized === "broker" ||
    normalized === "insurer" ||
    normalized === "insurance" ||
    normalized === "short-term-insurer"
  ) {
    return "insurance";
  }

  if (
    normalized === "licensing" ||
    normalized === "license-renewal" ||
    normalized === "licence-renewal" ||
    normalized === "licensing-expert" ||
    normalized === "licence-renewal-expert"
  ) {
    return "licensing";
  }

  return "owner";
}

function normalizeAccountSubtype(accountType: string, value: unknown): string {
  const normalized = asText(value)
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  const allowedByType: Record<string, Set<string>> = {
    owner: new Set([
      "farmer",
      "contractor",
      "construction-company",
      "asset-owner",
    ]),
    finance: new Set(["bank", "finance-house", "accountant"]),
    insurance: new Set([
      "short-term-insurer",
      "insurer",
      "broker",
      "insurance-broker",
    ]),
    dealer: new Set([
      "machinery-dealer",
      "motor-dealer",
      "auctioneer",
      "auction-house",
      "equipment-middleman",
      "machinery-middleman",
      "middleman",
    ]),
    licensing: new Set([
      "licence-renewal-expert",
      "fleet-licensing-service",
    ]),
  };
  const defaults: Record<string, string> = {
    owner: "farmer",
    finance: "bank",
    insurance: "short-term-insurer",
    dealer: "machinery-dealer",
    licensing: "licence-renewal-expert",
  };

  if (
    accountType === "insurance" &&
    ["insurer", "broker", "insurance-broker"].includes(normalized)
  ) {
    return "short-term-insurer";
  }

  if (accountType === "dealer" && normalized === "auction-house") {
    return "auctioneer";
  }

  if (accountType === "dealer" && ["middleman", "machinery-middleman"].includes(normalized)) {
    return "equipment-middleman";
  }

  if (allowedByType[accountType]?.has(normalized)) {
    return normalized;
  }

  return defaults[accountType] ?? "farmer";
}

function resolveAccountType(
  accountType: unknown,
  accountSubtype: unknown,
): string {
  const normalizedType = normalizeAccountType(accountType);
  const normalizedSubtype = asText(accountSubtype)
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

  if (
    normalizedType === "finance" &&
    [
      "insurer",
      "insurance",
      "short-term-insurer",
      "broker",
      "insurance-broker",
    ].includes(normalizedSubtype)
  ) {
    return "insurance";
  }

  return normalizedType;
}

function normalizeDirectoryStatus(value: unknown): string {
  const normalized = asText(value).toLowerCase();
  if (
    normalized === "pending" ||
    normalized === "hidden" ||
    normalized === "rejected"
  )
    return normalized;
  return "approved";
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asNullableInteger(value: unknown): number | null {
  const numeric = asNullableNumber(value);
  return numeric === null ? null : Math.round(numeric);
}

function sanitizeLogoUrl(value: unknown): string {
  return sanitizeImageUrl(value, MAX_LOGO_URL_LENGTH);
}

function sanitizeImageUrl(
  value: unknown,
  maxLength = MAX_BUSINESS_PHOTO_URL_LENGTH,
): string {
  const next = asText(value);

  if (!next || next.length > maxLength) {
    return "";
  }

  if (/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(next)) {
    return next.replace(/\s+/g, "");
  }

  if (next.startsWith("/") || next.startsWith("https://")) {
    return next;
  }

  return "";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => asText(entry)).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Array.isArray(parsed)
        ? parsed.map((entry) => asText(entry)).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

function sanitizeExtraPhotoUrls(value: unknown): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const entry of asStringArray(value)) {
    const url = sanitizeImageUrl(entry);

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    urls.push(url);

    if (urls.length >= MAX_BUSINESS_EXTRA_PHOTOS) {
      break;
    }
  }

  return urls;
}

function sanitizeWebsiteUrl(value: unknown): string {
  const raw = asText(value);

  if (!raw || raw.length > MAX_WEBSITE_URL_LENGTH) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(withProtocol);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return "";
    }

    return parsed.href.slice(0, MAX_WEBSITE_URL_LENGTH);
  } catch {
    return "";
  }
}

async function ensureAccountRoleSchema(
  db: ReturnType<typeof getDb>,
): Promise<void> {
  await db.query(`
    do $migration$
    declare
      role_constraint record;
    begin
      perform pg_advisory_xact_lock(
        hashtext('aim4price:account-profiles:licensing-role')
      );

      if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.account_profiles'::regclass
          and contype = 'c'
          and conname = 'account_profiles_account_role_check'
          and pg_get_constraintdef(oid) ilike '%licensing%'
          and pg_get_constraintdef(oid) ilike '%licence-renewal-expert%'
      )
      and not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.account_profiles'::regclass
          and contype = 'c'
          and conname <> 'account_profiles_account_role_check'
          and (
            pg_get_constraintdef(oid) ilike '%account_type%'
            or pg_get_constraintdef(oid) ilike '%account_subtype%'
          )
      )
      and not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'account_profiles'
          and column_name in ('account_type', 'account_subtype')
          and (
            data_type <> 'text'
            or is_nullable = 'YES'
            or column_default is null
          )
      )
      and 2 = (
        select count(*)
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'account_profiles'
          and column_name in ('account_type', 'account_subtype')
      ) then
        return;
      end if;

      for role_constraint in
        select conname
        from pg_constraint
        where conrelid = 'public.account_profiles'::regclass
          and contype = 'c'
          and (
            pg_get_constraintdef(oid) ilike '%account_type%'
            or pg_get_constraintdef(oid) ilike '%account_subtype%'
          )
      loop
        execute format(
          'alter table public.account_profiles drop constraint %I',
          role_constraint.conname
        );
      end loop;

      alter table public.account_profiles
        alter column account_type drop default,
        alter column account_subtype drop default;

      alter table public.account_profiles
        alter column account_type type text using account_type::text,
        alter column account_subtype type text using account_subtype::text;

      update public.account_profiles
      set account_type = case lower(regexp_replace(trim(coalesce(account_type, '')), '[ _]+', '-', 'g'))
        when 'bank' then 'finance'
        when 'finance-house' then 'finance'
        when 'accountant' then 'finance'
        when 'accounting' then 'finance'
        when 'finance' then 'finance'
        when 'broker' then 'insurance'
        when 'insurer' then 'insurance'
        when 'short-term-insurer' then 'insurance'
        when 'insurance' then 'insurance'
        when 'auction-house' then 'dealer'
        when 'auctioneer' then 'dealer'
        when 'middleman' then 'dealer'
        when 'machinery-middleman' then 'dealer'
        when 'equipment-middleman' then 'dealer'
        when 'machinery-dealer' then 'dealer'
        when 'motor-dealer' then 'dealer'
        when 'dealer' then 'dealer'
        when 'license-renewal' then 'licensing'
        when 'licence-renewal' then 'licensing'
        when 'licensing-expert' then 'licensing'
        when 'license-renewal-expert' then 'licensing'
        when 'licence-renewal-expert' then 'licensing'
        when 'licensing' then 'licensing'
        when 'owner' then 'owner'
        else 'owner'
      end;

      update public.account_profiles
      set account_subtype = case account_type
        when 'owner' then case
          when lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) in
            ('farmer', 'contractor', 'construction-company', 'asset-owner')
            then lower(regexp_replace(trim(account_subtype), '[ _]+', '-', 'g'))
          else 'farmer'
        end
        when 'finance' then case
          when lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) in
            ('bank', 'finance-house', 'accountant')
            then lower(regexp_replace(trim(account_subtype), '[ _]+', '-', 'g'))
          else 'bank'
        end
        when 'insurance' then 'short-term-insurer'
        when 'dealer' then case
          when lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) in
            ('machinery-dealer', 'motor-dealer')
            then lower(regexp_replace(trim(account_subtype), '[ _]+', '-', 'g'))
          when lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) in
            ('auction-house', 'auctioneer')
            then 'auctioneer'
          when lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) in
            ('middleman', 'machinery-middleman', 'equipment-middleman')
            then 'equipment-middleman'
          else 'machinery-dealer'
        end
        when 'licensing' then case
          when lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) =
            'fleet-licensing-service'
            then 'fleet-licensing-service'
          else 'licence-renewal-expert'
        end
      end;

      alter table public.account_profiles
        alter column account_type set default 'owner',
        alter column account_type set not null,
        alter column account_subtype set default 'farmer',
        alter column account_subtype set not null;

      alter table public.account_profiles
        add constraint account_profiles_account_role_check
        check (
          (account_type = 'owner' and account_subtype in
            ('farmer', 'contractor', 'construction-company', 'asset-owner'))
          or (account_type = 'finance' and account_subtype in
            ('bank', 'finance-house', 'accountant'))
          or (account_type = 'insurance' and account_subtype = 'short-term-insurer')
          or (account_type = 'dealer' and account_subtype in
            ('machinery-dealer', 'motor-dealer', 'auctioneer', 'equipment-middleman'))
          or (account_type = 'licensing' and account_subtype in
            ('licence-renewal-expert', 'fleet-licensing-service'))
        ) not valid;

      alter table public.account_profiles
        validate constraint account_profiles_account_role_check;
    end
    $migration$;
  `);
}

async function ensureAccountProfileColumnsOnce(): Promise<void> {
  const db = getDb();

  const schemaReady = await isDatabaseSchemaReady(() => db.query(`
    select
      user_id,
      display_name,
      logo_url,
      website_url,
      extra_photo_urls,
      business_name,
      phone,
      account_type,
      account_subtype,
      account_status,
      introduced_by_option,
      introduced_by_name,
      vat_number,
      province,
      town_city,
      address_line_1,
      address_line_2,
      notes,
      marketplace_seller_name,
      marketplace_phone,
      marketplace_email,
      marketplace_location,
      discovery_participation_enabled,
      partner_directory_enabled,
      partner_directory_status,
      partner_description,
      partner_latitude,
      partner_longitude,
      partner_service_radius_km,
      partner_brand_focus,
      partner_services,
      scan_pin_hash,
      scan_pin_enabled,
      scan_pin_updated_at,
      last_active_at,
      created_at,
      updated_at
    from account_profiles
    where false
  `));

  if (schemaReady) {
    await ensureAccountRoleSchema(db);
    accountProfileColumnsEnsured = true;
    return;
  }

  await db.query(`
    create table if not exists account_profiles (
      user_id text primary key,
      display_name text,
      logo_url text,
      website_url text,
      extra_photo_urls jsonb not null default '[]'::jsonb,
      business_name text,
      phone text,
      account_type text not null default 'owner',
      account_subtype text not null default 'farmer',
      account_status text not null default 'pending_payment',
      introduced_by_option text not null default 'direct',
      introduced_by_name text,
      vat_number text,
      province text,
      town_city text,
      address_line_1 text,
      address_line_2 text,
      notes text,
      marketplace_seller_name text,
      marketplace_phone text,
      marketplace_email text,
      marketplace_location text,
      discovery_participation_enabled boolean not null default false,
      partner_directory_enabled boolean not null default false,
      partner_directory_status text not null default 'approved',
      partner_description text,
      partner_latitude double precision,
      partner_longitude double precision,
      partner_service_radius_km integer,
      partner_brand_focus text,
      partner_services text,
      scan_pin_hash text,
      scan_pin_enabled boolean not null default false,
      scan_pin_updated_at timestamptz,
      last_active_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    alter table account_profiles
      add column if not exists display_name text,
      add column if not exists logo_url text,
      add column if not exists website_url text,
      add column if not exists extra_photo_urls jsonb not null default '[]'::jsonb,
      add column if not exists business_name text,
      add column if not exists phone text,
      add column if not exists account_type text not null default 'owner',
      add column if not exists account_subtype text not null default 'farmer',
      add column if not exists account_status text,
      add column if not exists introduced_by_option text,
      add column if not exists introduced_by_name text,
      add column if not exists vat_number text,
      add column if not exists province text,
      add column if not exists town_city text,
      add column if not exists address_line_1 text,
      add column if not exists address_line_2 text,
      add column if not exists notes text,
      add column if not exists marketplace_seller_name text,
      add column if not exists marketplace_phone text,
      add column if not exists marketplace_email text,
      add column if not exists marketplace_location text,
      add column if not exists discovery_participation_enabled boolean not null default false,
      add column if not exists partner_directory_enabled boolean not null default false,
      add column if not exists partner_directory_status text not null default 'approved',
      add column if not exists partner_description text,
      add column if not exists partner_latitude double precision,
      add column if not exists partner_longitude double precision,
      add column if not exists partner_service_radius_km integer,
      add column if not exists partner_brand_focus text,
      add column if not exists partner_services text,
      add column if not exists scan_pin_hash text,
      add column if not exists scan_pin_enabled boolean not null default false,
      add column if not exists scan_pin_updated_at timestamptz,
      add column if not exists last_active_at timestamptz,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now()
  `);

  await db.query(`
    update account_profiles
    set
      account_status = case
        when account_status is null or trim(account_status) = '' then 'pending_payment'
        when lower(replace(trim(account_status), '-', '_')) in ('pending_payment', 'active', 'suspended')
          then lower(replace(trim(account_status), '-', '_'))
        else 'pending_payment'
      end,
      introduced_by_option = case
        when lower(replace(trim(coalesce(introduced_by_option, '')), '-', '_')) in ('kuyler', 'andre', 'direct', 'other')
          then lower(replace(trim(introduced_by_option), '-', '_'))
        when lower(replace(trim(coalesce(introduced_by_option, '')), '-', '_')) in ('no_one', 'none', 'direct_signup')
          then 'direct'
        else 'direct'
      end,
      introduced_by_name = nullif(trim(coalesce(introduced_by_name, '')), '')
  `);

  await db.query(`
    do $$
    begin
      if to_regclass('public."user"') is not null then
        update account_profiles ap
        set account_status = 'active', updated_at = now()
        from public."user" u
        where ap.user_id = u.id
          and lower(trim(coalesce(u.email, ''))) = 'aim4price@gmail.com';
      end if;
    end $$
  `);

  await db.query(`
    alter table account_profiles
      alter column account_status set default 'pending_payment',
      alter column account_status set not null,
      alter column introduced_by_option set default 'direct',
      alter column introduced_by_option set not null
  `);

  await db.query(`
    update account_profiles
    set extra_photo_urls = '[]'::jsonb
    where extra_photo_urls is null
  `);

  await db.query(`
    alter table account_profiles
      alter column extra_photo_urls set default '[]'::jsonb,
      alter column extra_photo_urls set not null
  `);

  await ensureAccountRoleSchema(db);

  await db.query(`
    create index if not exists idx_account_profiles_user_id
      on account_profiles(user_id)
  `);

  await db.query(`
    create index if not exists idx_account_profiles_partner_directory
      on account_profiles(account_type, partner_directory_enabled, partner_directory_status, province, town_city)
  `);

  await db.query(`
    create index if not exists idx_account_profiles_discovery_participation
      on account_profiles(account_type, account_status, discovery_participation_enabled)
  `);

  await db.query(`
    create index if not exists idx_account_profiles_account_status
      on account_profiles(account_status)
  `);

  await db.query(`
    create index if not exists idx_account_profiles_last_active_at
      on account_profiles(last_active_at desc)
  `);

  accountProfileColumnsEnsured = true;
}

export async function ensureAccountProfileColumns(): Promise<void> {
  if (accountProfileColumnsEnsured) {
    return;
  }

  if (!accountProfileColumnsPromise) {
    accountProfileColumnsPromise = ensureAccountProfileColumnsOnce().catch((error) => {
      accountProfileColumnsPromise = null;
      throw error;
    });
  }

  await accountProfileColumnsPromise;
}

function mapAccountProfileRow(
  row: AccountProfileRow | undefined,
  user: { id: string; name?: string | null; email?: string | null },
): AccountProfile {
  const fallbackName = asText(user.name);
  const displayName = asText(row?.display_name) || fallbackName;
  const accountType = resolveAccountType(
    row?.account_type,
    row?.account_subtype,
  );
  const accountStatus = normalizeAccountStatus(row?.account_status);
  const introducedByOption = normalizeIntroducedByOption(
    row?.introduced_by_option,
  );
  const introducedByName = cleanIntroducedByName(row?.introduced_by_name);

  return {
    userId: user.id,
    name: displayName,
    displayName,
    email: asText(user.email),
    logoUrl: sanitizeLogoUrl(row?.logo_url),
    websiteUrl: sanitizeWebsiteUrl(row?.website_url),
    extraPhotoUrls: sanitizeExtraPhotoUrls(row?.extra_photo_urls),
    businessName: asText(row?.business_name),
    phone: asText(row?.phone),
    accountType,
    accountSubtype: normalizeAccountSubtype(accountType, row?.account_subtype),
    accountStatus,
    accountStatusLabel: accountStatusLabel(accountStatus),
    introducedByOption,
    introducedByName,
    introducedByDisplay: resolveIntroducedByDisplay(
      introducedByOption,
      introducedByName,
    ),
    vatNumber: asText(row?.vat_number),
    province: asText(row?.province),
    townCity: asText(row?.town_city),
    addressLine1: asText(row?.address_line_1),
    addressLine2: asText(row?.address_line_2),
    notes: asText(row?.notes),
    marketplaceSellerName: asText(row?.marketplace_seller_name),
    marketplacePhone: asText(row?.marketplace_phone),
    marketplaceEmail: asText(row?.marketplace_email),
    marketplaceLocation: asText(row?.marketplace_location),
    discoveryParticipationEnabled:
      accountType === "owner" &&
      Boolean(row?.discovery_participation_enabled),
    partnerDirectoryEnabled: Boolean(row?.partner_directory_enabled),
    partnerDirectoryStatus: normalizeDirectoryStatus(
      row?.partner_directory_status,
    ),
    partnerDescription: asText(row?.partner_description),
    partnerLatitude: asNullableNumber(row?.partner_latitude),
    partnerLongitude: asNullableNumber(row?.partner_longitude),
    partnerServiceRadiusKm: asNullableInteger(row?.partner_service_radius_km),
    partnerBrandFocus: asText(row?.partner_brand_focus),
    partnerServices: asText(row?.partner_services),
    createdAtIso: row?.created_at ?? null,
    updatedAtIso: row?.updated_at ?? null,
  };
}

async function syncPrimaryAssetRegisterLogo(
  userId: string,
  logoUrl: string,
): Promise<void> {
  const normalizedLogoUrl = sanitizeLogoUrl(logoUrl);
  const primaryRegister = await getOrCreatePrimaryAssetRegister(userId);

  await updateAssetRegisterLogo({
    userId,
    registerId: primaryRegister.id,
    logoUrls: normalizedLogoUrl ? [normalizedLogoUrl] : [],
    showLogosOnRegister: true,
  });
}

function mapAccountScanPinRow(row?: AccountScanPinRow): AccountScanPinStatus {
  const hasPin = Boolean(asText(row?.scan_pin_hash));
  const enabled = Boolean(row?.scan_pin_enabled) && hasPin;

  return {
    enabled,
    hasPin,
    updatedAtIso: row?.scan_pin_updated_at ?? null,
  };
}

export async function createInitialAccountProfile(
  user: { id: string; name?: string | null; email?: string | null },
  input?: {
    accountType?: unknown;
    accountSubtype?: unknown;
    introducedByOption?: unknown;
    introducedByName?: unknown;
    province?: unknown;
    townCity?: unknown;
    partnerDirectoryEnabled?: unknown;
    phone?: unknown;
  },
): Promise<void> {
  await ensureAccountProfileColumns();

  const db = getDb();
  const initialAccountType = normalizeAccountType(input?.accountType);
  const hasExplicitAccountType = Boolean(asText(input?.accountType));
  const initialAccountSubtype = normalizeAccountSubtype(
    initialAccountType,
    input?.accountSubtype,
  );
  const initialAccountStatus = isAim4priceAdminEmail(user.email)
    ? "active"
    : "pending_payment";
  const introducedByOption = normalizeIntroducedByOption(
    input?.introducedByOption,
  );
  const introducedByName =
    introducedByOption === "other"
      ? cleanIntroducedByName(input?.introducedByName)
      : "";
  const province = normalizeProvince(input?.province);
  const townCity = asText(input?.townCity);
  const initialPartnerDirectoryEnabled =
    initialAccountType !== "owner" &&
    (input?.partnerDirectoryEnabled === true ||
      String(input?.partnerDirectoryEnabled ?? "").trim().toLowerCase() === "true");
  const phone = asText(input?.phone);

  await db.query(
    `
      insert into account_profiles (
        user_id,
        display_name,
        phone,
        account_type,
        account_subtype,
        account_status,
        introduced_by_option,
        introduced_by_name,
        province,
        town_city,
        partner_directory_enabled,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
      on conflict (user_id) do update set
        account_type = case
          when $12 then excluded.account_type
          else account_profiles.account_type
        end,
        account_subtype = case
          when $12 then excluded.account_subtype
          else account_profiles.account_subtype
        end,
        phone = coalesce(nullif(account_profiles.phone, ''), excluded.phone),
        province = coalesce(nullif(account_profiles.province, ''), excluded.province),
        town_city = coalesce(nullif(account_profiles.town_city, ''), excluded.town_city),
        partner_directory_enabled = case
          when $12 then excluded.partner_directory_enabled
          when account_profiles.account_type <> 'owner' and excluded.partner_directory_enabled then true
          else account_profiles.partner_directory_enabled
        end,
        updated_at = now()
    `,
    [
      user.id,
      asText(user.name) || null,
      phone || null,
      initialAccountType,
      initialAccountSubtype,
      initialAccountStatus,
      introducedByOption,
      introducedByName || null,
      province || null,
      townCity || null,
      initialPartnerDirectoryEnabled,
      hasExplicitAccountType,
    ],
  );
}

export async function getAccountProfile(user: {
  id: string;
  name?: string | null;
  email?: string | null;
}): Promise<AccountProfile> {
  await ensureAccountProfileColumns();

  const db = getDb();

  const result = await db.query<AccountProfileRow>(
    `
      select
        user_id,
        display_name,
        logo_url,
        website_url,
        extra_photo_urls,
        business_name,
        phone,
        account_type,
        account_subtype,
        account_status,
        introduced_by_option,
        introduced_by_name,
        vat_number,
        province,
        town_city,
        address_line_1,
        address_line_2,
        notes,
        marketplace_seller_name,
        marketplace_phone,
        marketplace_email,
        marketplace_location,
        discovery_participation_enabled,
        partner_directory_enabled,
        partner_directory_status,
        partner_description,
        partner_latitude,
        partner_longitude,
        partner_service_radius_km,
        partner_brand_focus,
        partner_services,
        created_at,
        updated_at
      from account_profiles
      where user_id = $1
      limit 1
    `,
    [user.id],
  );

  return mapAccountProfileRow(result.rows[0], user);
}

export async function upsertAccountProfile(
  user: { id: string; name?: string | null; email?: string | null },
  input: UpsertAccountProfileInput,
): Promise<AccountProfile> {
  await ensureAccountProfileColumns();

  const db = getDb();

  const existingAccountTypeResult = await db.query<AccountTypeRow>(
    `
      select account_type, account_subtype, logo_url, discovery_participation_enabled
      from account_profiles
      where user_id = $1
      limit 1
    `,
    [user.id],
  );

  const existingAccount = existingAccountTypeResult.rows[0];
  const normalizedAccountType = existingAccount
    ? resolveAccountType(
        existingAccount.account_type,
        existingAccount.account_subtype,
      )
    : resolveAccountType(input.accountType, input.accountSubtype);
  const normalizedAccountSubtype = normalizeAccountSubtype(
    normalizedAccountType,
    asText(existingAccount?.account_subtype) || input.accountSubtype,
  );
  const normalizedLogoUrl = sanitizeLogoUrl(input.logoUrl);
  const previousLogoUrl = sanitizeLogoUrl(existingAccount?.logo_url);
  const shouldSyncPrimaryLogo =
    normalizedAccountType === "owner" &&
    (input.syncPrimaryLogoToRegister === true ||
      normalizedLogoUrl !== previousLogoUrl);
  const normalizedMarketplaceEmail = asText(
    input.marketplaceEmail,
  ).toLowerCase();
  const normalizedWebsiteUrl = sanitizeWebsiteUrl(input.websiteUrl);
  const normalizedExtraPhotoUrls: string[] = [];
  const normalizedLatitude = asNullableNumber(input.partnerLatitude);
  const normalizedLongitude = asNullableNumber(input.partnerLongitude);
  const normalizedServiceRadiusKm = asNullableInteger(
    input.partnerServiceRadiusKm,
  );
  const partnerDirectoryEnabled =
    normalizedAccountType !== "owner" && Boolean(input.partnerDirectoryEnabled);
  const discoveryParticipationEnabled =
    normalizedAccountType === "owner"
      ? typeof input.discoveryParticipationEnabled === "boolean"
        ? input.discoveryParticipationEnabled
        : Boolean(existingAccount?.discovery_participation_enabled)
      : false;

  const result = await db.query<AccountProfileRow>(
    `
      insert into account_profiles (
        user_id,
        display_name,
        logo_url,
        website_url,
        extra_photo_urls,
        business_name,
        phone,
        account_type,
        account_subtype,
        vat_number,
        province,
        town_city,
        address_line_1,
        address_line_2,
        notes,
        marketplace_seller_name,
        marketplace_phone,
        marketplace_email,
        marketplace_location,
        discovery_participation_enabled,
        partner_directory_enabled,
        partner_directory_status,
        partner_description,
        partner_latitude,
        partner_longitude,
        partner_service_radius_km,
        partner_brand_focus,
        partner_services,
        created_at,
        updated_at
      )
      values (
        $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, now(), now()
      )
      on conflict (user_id)
      do update set
        display_name = excluded.display_name,
        logo_url = excluded.logo_url,
        website_url = excluded.website_url,
        extra_photo_urls = excluded.extra_photo_urls,
        business_name = excluded.business_name,
        phone = excluded.phone,
        account_type = excluded.account_type,
        account_subtype = excluded.account_subtype,
        vat_number = excluded.vat_number,
        province = excluded.province,
        town_city = excluded.town_city,
        address_line_1 = excluded.address_line_1,
        address_line_2 = excluded.address_line_2,
        notes = excluded.notes,
        marketplace_seller_name = excluded.marketplace_seller_name,
        marketplace_phone = excluded.marketplace_phone,
        marketplace_email = excluded.marketplace_email,
        marketplace_location = excluded.marketplace_location,
        discovery_participation_enabled = excluded.discovery_participation_enabled,
        partner_directory_enabled = excluded.partner_directory_enabled,
        partner_directory_status = excluded.partner_directory_status,
        partner_description = excluded.partner_description,
        partner_latitude = excluded.partner_latitude,
        partner_longitude = excluded.partner_longitude,
        partner_service_radius_km = excluded.partner_service_radius_km,
        partner_brand_focus = excluded.partner_brand_focus,
        partner_services = excluded.partner_services,
        updated_at = now()
      returning
        user_id,
        display_name,
        logo_url,
        website_url,
        extra_photo_urls,
        business_name,
        phone,
        account_type,
        account_subtype,
        account_status,
        introduced_by_option,
        introduced_by_name,
        vat_number,
        province,
        town_city,
        address_line_1,
        address_line_2,
        notes,
        marketplace_seller_name,
        marketplace_phone,
        marketplace_email,
        marketplace_location,
        discovery_participation_enabled,
        partner_directory_enabled,
        partner_directory_status,
        partner_description,
        partner_latitude,
        partner_longitude,
        partner_service_radius_km,
        partner_brand_focus,
        partner_services,
        created_at,
        updated_at
    `,
    [
      user.id,
      asText(input.displayName) || asText(user.name) || null,
      normalizedLogoUrl || null,
      normalizedWebsiteUrl || null,
      JSON.stringify(normalizedExtraPhotoUrls),
      asText(input.businessName) || null,
      asText(input.phone) || null,
      normalizedAccountType,
      normalizedAccountSubtype,
      asText(input.vatNumber) || null,
      normalizeProvince(input.province) || null,
      asText(input.townCity) || null,
      asText(input.addressLine1) || null,
      asText(input.addressLine2) || null,
      asText(input.notes) || null,
      asText(input.marketplaceSellerName) || null,
      asText(input.marketplacePhone) || null,
      normalizedMarketplaceEmail || null,
      asText(input.marketplaceLocation) || null,
      discoveryParticipationEnabled,
      partnerDirectoryEnabled,
      normalizeDirectoryStatus(input.partnerDirectoryStatus),
      asText(input.partnerDescription) || null,
      normalizedLatitude,
      normalizedLongitude,
      normalizedServiceRadiusKm,
      asText(input.partnerBrandFocus) || null,
      asText(input.partnerServices) || null,
    ],
  );

  const savedProfile = mapAccountProfileRow(result.rows[0], user);

  if (shouldSyncPrimaryLogo) {
    await syncPrimaryAssetRegisterLogo(user.id, savedProfile.logoUrl).catch(
      (error) => {
        console.warn(
          "Failed to sync account logo to primary asset register.",
          error,
        );
      },
    );
  }

  return savedProfile;
}

export async function getAccountStatusForUser(user: {
  id: string;
  email?: string | null;
}): Promise<AccountStatus> {
  if (isAim4priceAdminEmail(user.email)) {
    return "active";
  }

  await ensureAccountProfileColumns();

  const db = getDb();
  const result = await db.query<{ account_status: string | null }>(
    `
      select account_status
      from account_profiles
      where user_id = $1
      limit 1
    `,
    [user.id],
  );

  return normalizeAccountStatus(result.rows[0]?.account_status);
}

export async function isAccountActive(user: {
  id: string;
  email?: string | null;
}): Promise<boolean> {
  return (await getAccountStatusForUser(user)) === "active";
}

export async function markAccountLastActive(user: {
  id: string;
  name?: string | null;
  email?: string | null;
}): Promise<boolean> {
  const userId = asText(user.id);

  if (!userId) {
    return false;
  }

  await ensureAccountProfileColumns();

  const db = getDb();
  const initialAccountStatus = isAim4priceAdminEmail(user.email)
    ? "active"
    : "pending_payment";
  const result = await db.query<{ user_id: string }>(
    `
      insert into account_profiles (
        user_id,
        display_name,
        account_type,
        account_subtype,
        account_status,
        introduced_by_option,
        last_active_at,
        created_at,
        updated_at
      )
      values ($1, $2, 'owner', 'farmer', $3, 'direct', now(), now(), now())
      on conflict (user_id)
      do update set
        last_active_at = now()
      where account_profiles.last_active_at is null
        or account_profiles.last_active_at < now() - interval '5 minutes'
      returning user_id
    `,
    [userId, asText(user.name) || null, initialAccountStatus],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function getAccountScanPinStatus(
  userId: string,
): Promise<AccountScanPinStatus> {
  await ensureAccountProfileColumns();

  const db = getDb();

  const result = await db.query<AccountScanPinRow>(
    `
      select
        scan_pin_hash,
        scan_pin_enabled,
        scan_pin_updated_at
      from account_profiles
      where user_id = $1
      limit 1
    `,
    [userId],
  );

  return mapAccountScanPinRow(result.rows[0]);
}

export async function saveAccountScanPin(
  userId: string,
  scanPinHash: string,
): Promise<AccountScanPinStatus> {
  await ensureAccountProfileColumns();

  const db = getDb();

  const result = await db.query<AccountScanPinRow>(
    `
      insert into account_profiles (
        user_id,
        scan_pin_hash,
        scan_pin_enabled,
        scan_pin_updated_at,
        created_at,
        updated_at
      )
      values (
        $1, $2, true, now(), now(), now()
      )
      on conflict (user_id)
      do update set
        scan_pin_hash = excluded.scan_pin_hash,
        scan_pin_enabled = true,
        scan_pin_updated_at = now(),
        updated_at = now()
      returning
        scan_pin_hash,
        scan_pin_enabled,
        scan_pin_updated_at
    `,
    [userId, scanPinHash],
  );

  return mapAccountScanPinRow(result.rows[0]);
}

export async function disableAccountScanPin(
  userId: string,
): Promise<AccountScanPinStatus> {
  await ensureAccountProfileColumns();

  const db = getDb();

  const result = await db.query<AccountScanPinRow>(
    `
      insert into account_profiles (
        user_id,
        scan_pin_hash,
        scan_pin_enabled,
        scan_pin_updated_at,
        created_at,
        updated_at
      )
      values (
        $1, null, false, now(), now(), now()
      )
      on conflict (user_id)
      do update set
        scan_pin_hash = null,
        scan_pin_enabled = false,
        scan_pin_updated_at = now(),
        updated_at = now()
      returning
        scan_pin_hash,
        scan_pin_enabled,
        scan_pin_updated_at
    `,
    [userId],
  );

  return mapAccountScanPinRow(result.rows[0]);
}
