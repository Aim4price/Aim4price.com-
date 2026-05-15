import { getDb } from './db';

export type AccountProfile = {
  userId: string;
  name: string;
  displayName: string;
  email: string;
  logoUrl: string;
  businessName: string;
  phone: string;
  accountType: string;
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
  businessName?: string | null;
  phone?: string | null;
  accountType?: string | null;
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
  partnerDirectoryEnabled?: boolean | null;
  partnerDirectoryStatus?: string | null;
  partnerDescription?: string | null;
  partnerLatitude?: string | number | null;
  partnerLongitude?: string | number | null;
  partnerServiceRadiusKm?: string | number | null;
  partnerBrandFocus?: string | null;
  partnerServices?: string | null;
};

type AccountProfileRow = {
  user_id: string;
  display_name: string | null;
  logo_url: string | null;
  business_name: string | null;
  phone: string | null;
  account_type: string | null;
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

const MAX_LOGO_URL_LENGTH = 3_000_000;
let accountProfileColumnsEnsured = false;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAccountType(value: unknown): string {
  const normalized = asText(value).toLowerCase();

  if (normalized === 'bank') return 'finance';
  if (normalized === 'broker' || normalized === 'insurer') return 'insurance';
  if (normalized === 'dealer' || normalized === 'finance' || normalized === 'insurance') return normalized;

  return 'owner';
}

function normalizeDirectoryStatus(value: unknown): string {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'pending' || normalized === 'hidden' || normalized === 'rejected') return normalized;
  return 'approved';
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
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
  const next = asText(value);

  if (!next || next.length > MAX_LOGO_URL_LENGTH) {
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

export async function ensureAccountProfileColumns(): Promise<void> {
  if (accountProfileColumnsEnsured) {
    return;
  }

  const db = getDb();

  await db.query(`
    create table if not exists account_profiles (
      user_id text primary key,
      display_name text,
      logo_url text,
      business_name text,
      phone text,
      account_type text not null default 'owner',
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
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    alter table account_profiles
      add column if not exists display_name text,
      add column if not exists logo_url text,
      add column if not exists business_name text,
      add column if not exists phone text,
      add column if not exists account_type text not null default 'owner',
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
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now()
  `);

  await db.query(`
    create index if not exists idx_account_profiles_user_id
      on account_profiles(user_id)
  `);

  await db.query(`
    create index if not exists idx_account_profiles_partner_directory
      on account_profiles(account_type, partner_directory_enabled, partner_directory_status, province, town_city)
  `);

  accountProfileColumnsEnsured = true;
}

function mapAccountProfileRow(
  row: AccountProfileRow | undefined,
  user: { id: string; name?: string | null; email?: string | null },
): AccountProfile {
  const fallbackName = asText(user.name);
  const displayName = asText(row?.display_name) || fallbackName;

  return {
    userId: user.id,
    name: displayName,
    displayName,
    email: asText(user.email),
    logoUrl: sanitizeLogoUrl(row?.logo_url),
    businessName: asText(row?.business_name),
    phone: asText(row?.phone),
    accountType: normalizeAccountType(row?.account_type),
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
    partnerDirectoryEnabled: Boolean(row?.partner_directory_enabled),
    partnerDirectoryStatus: normalizeDirectoryStatus(row?.partner_directory_status),
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

function mapAccountScanPinRow(row?: AccountScanPinRow): AccountScanPinStatus {
  const hasPin = Boolean(asText(row?.scan_pin_hash));
  const enabled = Boolean(row?.scan_pin_enabled) && hasPin;

  return {
    enabled,
    hasPin,
    updatedAtIso: row?.scan_pin_updated_at ?? null,
  };
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
        business_name,
        phone,
        account_type,
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

  const normalizedAccountType = normalizeAccountType(input.accountType);
  const normalizedMarketplaceEmail = asText(input.marketplaceEmail).toLowerCase();
  const normalizedLatitude = asNullableNumber(input.partnerLatitude);
  const normalizedLongitude = asNullableNumber(input.partnerLongitude);
  const normalizedServiceRadiusKm = asNullableInteger(input.partnerServiceRadiusKm);
  const partnerDirectoryEnabled = normalizedAccountType !== 'owner' && Boolean(input.partnerDirectoryEnabled);

  const result = await db.query<AccountProfileRow>(
    `
      insert into account_profiles (
        user_id,
        display_name,
        logo_url,
        business_name,
        phone,
        account_type,
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
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, now(), now()
      )
      on conflict (user_id)
      do update set
        display_name = excluded.display_name,
        logo_url = excluded.logo_url,
        business_name = excluded.business_name,
        phone = excluded.phone,
        account_type = excluded.account_type,
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
        business_name,
        phone,
        account_type,
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
      sanitizeLogoUrl(input.logoUrl) || null,
      asText(input.businessName) || null,
      asText(input.phone) || null,
      normalizedAccountType,
      asText(input.vatNumber) || null,
      asText(input.province) || null,
      asText(input.townCity) || null,
      asText(input.addressLine1) || null,
      asText(input.addressLine2) || null,
      asText(input.notes) || null,
      asText(input.marketplaceSellerName) || null,
      asText(input.marketplacePhone) || null,
      normalizedMarketplaceEmail || null,
      asText(input.marketplaceLocation) || null,
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

  return mapAccountProfileRow(result.rows[0], user);
}

export async function getAccountScanPinStatus(userId: string): Promise<AccountScanPinStatus> {
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

export async function saveAccountScanPin(userId: string, scanPinHash: string): Promise<AccountScanPinStatus> {
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

export async function disableAccountScanPin(userId: string): Promise<AccountScanPinStatus> {
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
