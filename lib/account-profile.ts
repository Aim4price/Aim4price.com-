import { getDb } from './db';

export type AccountProfile = {
  userId: string;
  name: string;
  email: string;
  businessName: string;
  phone: string;
  accountType: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

export type AccountScanPinStatus = {
  enabled: boolean;
  hasPin: boolean;
  updatedAtIso: string | null;
};

export type UpsertAccountProfileInput = {
  businessName?: string | null;
  phone?: string | null;
  accountType?: string | null;
  vatNumber?: string | null;
  province?: string | null;
  townCity?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  notes?: string | null;
};

type AccountProfileRow = {
  user_id: string;
  business_name: string | null;
  phone: string | null;
  account_type: string | null;
  vat_number: string | null;
  province: string | null;
  town_city: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AccountScanPinRow = {
  scan_pin_hash: string | null;
  scan_pin_enabled: boolean | null;
  scan_pin_updated_at: string | null;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mapAccountProfileRow(
  row: AccountProfileRow | undefined,
  user: { id: string; name?: string | null; email?: string | null },
): AccountProfile {
  return {
    userId: user.id,
    name: asText(user.name),
    email: asText(user.email),
    businessName: asText(row?.business_name),
    phone: asText(row?.phone),
    accountType: asText(row?.account_type) || 'owner',
    vatNumber: asText(row?.vat_number),
    province: asText(row?.province),
    townCity: asText(row?.town_city),
    addressLine1: asText(row?.address_line_1),
    addressLine2: asText(row?.address_line_2),
    notes: asText(row?.notes),
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
  const db = getDb();

  const result = await db.query<AccountProfileRow>(
    `
      select
        user_id,
        business_name,
        phone,
        account_type,
        vat_number,
        province,
        town_city,
        address_line_1,
        address_line_2,
        notes,
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
  const db = getDb();

  const result = await db.query<AccountProfileRow>(
    `
      insert into account_profiles (
        user_id,
        business_name,
        phone,
        account_type,
        vat_number,
        province,
        town_city,
        address_line_1,
        address_line_2,
        notes,
        created_at,
        updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now()
      )
      on conflict (user_id)
      do update set
        business_name = excluded.business_name,
        phone = excluded.phone,
        account_type = excluded.account_type,
        vat_number = excluded.vat_number,
        province = excluded.province,
        town_city = excluded.town_city,
        address_line_1 = excluded.address_line_1,
        address_line_2 = excluded.address_line_2,
        notes = excluded.notes,
        updated_at = now()
      returning
        user_id,
        business_name,
        phone,
        account_type,
        vat_number,
        province,
        town_city,
        address_line_1,
        address_line_2,
        notes,
        created_at,
        updated_at
    `,
    [
      user.id,
      asText(input.businessName) || null,
      asText(input.phone) || null,
      asText(input.accountType) || 'owner',
      asText(input.vatNumber) || null,
      asText(input.province) || null,
      asText(input.townCity) || null,
      asText(input.addressLine1) || null,
      asText(input.addressLine2) || null,
      asText(input.notes) || null,
    ],
  );

  return mapAccountProfileRow(result.rows[0], user);
}

export async function getAccountScanPinStatus(userId: string): Promise<AccountScanPinStatus> {
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
