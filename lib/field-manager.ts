import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ensureAssetRegisterTables } from './asset-registers';
import { getDb } from './db';

const scryptAsync = promisify(scrypt);
const FIELD_MANAGER_PASSWORD_MIN_LENGTH = 8;
const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_USERNAME_LENGTH = 80;
const MAX_PASSWORD_LENGTH = 160;

type FieldManagerRow = {
  id: string;
  owner_user_id: string;
  display_name: string | null;
  username: string | null;
  username_normalized: string | null;
  password_hash: string | null;
  is_active: boolean | null;
  last_login_at: string | Date | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
};

type FieldManagerAssetRow = {
  id: string | number | null;
  user_id: string | null;
  public_asset_code: string | null;
  plate_label: string | null;
  qr_status: string | null;
  title: string | null;
  kind: string | null;
  equipment_family_label: string | null;
  brand_name: string | null;
  model_name: string | null;
  typed_model_name: string | null;
  serial_number: string | null;
  license_registration_number: string | null;
  specs_json: unknown;
  hours: string | number | null;
  life_worked_percent: string | number | null;
  last_scanned_at: string | Date | null;
  updated_at: string | Date | null;
};

export type FieldManagerRecord = {
  id: string;
  ownerUserId: string;
  displayName: string;
  username: string;
  isActive: boolean;
  status: 'active' | 'inactive';
  lastLoginAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type FieldManagerPrivateRecord = FieldManagerRecord & {
  passwordHash: string;
};

export type FieldManagerAssetSummary = {
  id: string;
  ownerUserId: string;
  publicAssetCode: string;
  plateLabel: string;
  qrStatus: string;
  title: string;
  kind: string;
  equipmentFamilyLabel: string;
  brandName: string;
  modelName: string;
  typedModelName: string;
  serialNumber: string;
  registrationNumber: string;
  vinNumber: string;
  internalReference: string;
  usageReading: number | null;
  usageLabel: string;
  lifeWorkedPercent: number | null;
  lastScannedAtIso: string | null;
  updatedAtIso: string | null;
};

export type CreateFieldManagerInput = {
  displayName?: unknown;
  username?: unknown;
  password?: unknown;
};

export type UpdateFieldManagerInput = {
  displayName?: unknown;
  username?: unknown;
  password?: unknown;
  isActive?: unknown;
};

let fieldManagerTablesPromise: Promise<void> | null = null;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asDateIso(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  return null;
}

function asNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'active', 'enabled', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'inactive', 'disabled', 'off'].includes(normalized)) return false;
  return fallback;
}

function cleanDisplayName(value: unknown): string {
  return asText(value).replace(/\s+/g, ' ').slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export function normalizeFieldManagerUsername(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._@-]/g, '')
    .slice(0, MAX_USERNAME_LENGTH);
}

function validateFieldManagerPassword(value: unknown): string {
  const password = typeof value === 'string' ? value : '';

  if (!password) {
    throw new Error('Enter a Field Manager password.');
  }

  if (password.length < FIELD_MANAGER_PASSWORD_MIN_LENGTH) {
    throw new Error(`Field Manager password must be at least ${FIELD_MANAGER_PASSWORD_MIN_LENGTH} characters.`);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Field Manager password must be ${MAX_PASSWORD_LENGTH} characters or shorter.`);
  }

  return password;
}

function validateFieldManagerCore(input: CreateFieldManagerInput): {
  displayName: string;
  username: string;
  usernameNormalized: string;
  password: string;
} {
  const displayName = cleanDisplayName(input.displayName);
  const username = normalizeFieldManagerUsername(input.username);
  const password = validateFieldManagerPassword(input.password);

  if (!displayName) {
    throw new Error('Enter the manager display name.');
  }

  if (username.length < 3) {
    throw new Error('Enter a Field Manager username with at least 3 characters.');
  }

  return {
    displayName,
    username,
    usernameNormalized: username,
    password,
  };
}

function normalizeUpdateInput(input: UpdateFieldManagerInput): {
  displayName?: string;
  username?: string;
  usernameNormalized?: string;
  password?: string;
  isActive?: boolean;
} {
  const normalized: {
    displayName?: string;
    username?: string;
    usernameNormalized?: string;
    password?: string;
    isActive?: boolean;
  } = {};

  if (Object.prototype.hasOwnProperty.call(input, 'displayName')) {
    const displayName = cleanDisplayName(input.displayName);
    if (!displayName) {
      throw new Error('Enter the manager display name.');
    }
    normalized.displayName = displayName;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'username')) {
    const username = normalizeFieldManagerUsername(input.username);
    if (username.length < 3) {
      throw new Error('Enter a Field Manager username with at least 3 characters.');
    }
    normalized.username = username;
    normalized.usernameNormalized = username;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'password')) {
    const passwordText = typeof input.password === 'string' ? input.password : '';
    if (passwordText.trim()) {
      normalized.password = validateFieldManagerPassword(passwordText);
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'isActive')) {
    normalized.isActive = normalizeBoolean(input.isActive, true);
  }

  return normalized;
}

function mapFieldManagerRow(row: FieldManagerRow): FieldManagerRecord {
  const id = String(row.id ?? '').trim();
  const ownerUserId = String(row.owner_user_id ?? '').trim();
  const isActive = Boolean(row.is_active);
  const createdAtIso = asDateIso(row.created_at) ?? new Date().toISOString();
  const updatedAtIso = asDateIso(row.updated_at) ?? createdAtIso;

  return {
    id,
    ownerUserId,
    displayName: asText(row.display_name),
    username: asText(row.username),
    isActive,
    status: isActive ? 'active' : 'inactive',
    lastLoginAtIso: asDateIso(row.last_login_at),
    createdAtIso,
    updatedAtIso,
  };
}

function mapFieldManagerPrivateRow(row: FieldManagerRow): FieldManagerPrivateRecord {
  return {
    ...mapFieldManagerRow(row),
    passwordHash: asText(row.password_hash),
  };
}

function readSpecText(specs: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = asText(specs[key]);
    if (value) return value.slice(0, 120);
  }

  return '';
}

function normalizeUsageLabel(row: FieldManagerAssetRow): { usageReading: number | null; usageLabel: string } {
  const specs = asRecord(row.specs_json);
  const usageMetric = asText(specs.usageMetric ?? specs.usage_metric ?? specs.usageUnit ?? specs.usage_unit).toLowerCase();
  const hours = asNumber(row.hours);
  const percent = asNumber(row.life_worked_percent);
  const kind = asText(row.kind).toLowerCase();
  const unit = kind === 'vehicle' || usageMetric === 'km' || usageMetric === 'kms' ? 'km' : 'hours';

  if (hours !== null) {
    return {
      usageReading: hours,
      usageLabel: `${Math.round(hours).toLocaleString('en-ZA')} ${unit}`,
    };
  }

  if (percent !== null) {
    return {
      usageReading: percent,
      usageLabel: `${Math.round(percent * 10) / 10}% worked`,
    };
  }

  return {
    usageReading: null,
    usageLabel: 'No reading saved',
  };
}

function mapFieldManagerAssetRow(row: FieldManagerAssetRow): FieldManagerAssetSummary {
  const specs = asRecord(row.specs_json);
  const usage = normalizeUsageLabel(row);
  const registrationNumber = asText(row.license_registration_number) || readSpecText(specs, [
    'registrationNumber',
    'registration_number',
    'licenseRegistrationNumber',
    'license_registration_number',
    'numberPlate',
    'number_plate',
  ]);

  return {
    id: String(row.id ?? '').trim(),
    ownerUserId: asText(row.user_id),
    publicAssetCode: asText(row.public_asset_code).toUpperCase(),
    plateLabel: asText(row.plate_label),
    qrStatus: asText(row.qr_status) || 'active',
    title: asText(row.title) || 'Untitled asset',
    kind: asText(row.kind),
    equipmentFamilyLabel: asText(row.equipment_family_label),
    brandName: asText(row.brand_name),
    modelName: asText(row.model_name),
    typedModelName: asText(row.typed_model_name),
    serialNumber: asText(row.serial_number),
    registrationNumber,
    vinNumber: readSpecText(specs, ['vin', 'vinNumber', 'vin_number', 'chassisNumber', 'chassis_number']),
    internalReference: readSpecText(specs, ['internalReference', 'internal_reference', 'assetReference', 'asset_reference', 'fleetNumber', 'fleet_number']),
    usageReading: usage.usageReading,
    usageLabel: usage.usageLabel,
    lifeWorkedPercent: asNumber(row.life_worked_percent),
    lastScannedAtIso: asDateIso(row.last_scanned_at),
    updatedAtIso: asDateIso(row.updated_at),
  };
}

async function ensureFieldManagerTablesOnce(): Promise<void> {
  const db = getDb();

  await db.query(`create extension if not exists pgcrypto`);

  await db.query(`
    create table if not exists public.field_managers (
      id uuid primary key default gen_random_uuid(),
      owner_user_id text not null,
      display_name text not null,
      username text not null,
      username_normalized text not null,
      password_hash text not null,
      is_active boolean not null default true,
      last_login_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    alter table public.field_managers
      add column if not exists owner_user_id text,
      add column if not exists display_name text,
      add column if not exists username text,
      add column if not exists username_normalized text,
      add column if not exists password_hash text,
      add column if not exists is_active boolean not null default true,
      add column if not exists last_login_at timestamptz,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now()
  `);

  await db.query(`
    update public.field_managers
    set username_normalized = lower(regexp_replace(coalesce(username, ''), '\\s+', '', 'g'))
    where username_normalized is null or trim(username_normalized) = ''
  `);

  await db.query(`
    create unique index if not exists idx_field_managers_username_normalized
      on public.field_managers(username_normalized)
  `);

  await db.query(`
    create index if not exists idx_field_managers_owner_user_id
      on public.field_managers(owner_user_id, created_at desc)
  `);

  await db.query(`
    create table if not exists public.field_manager_asset_access (
      field_manager_id uuid not null references public.field_managers(id) on delete cascade,
      asset_id uuid not null,
      created_at timestamptz not null default now(),
      primary key (field_manager_id, asset_id)
    )
  `);

  await db.query(`
    create index if not exists idx_field_manager_asset_access_asset
      on public.field_manager_asset_access(asset_id)
  `);

  await db.query(`
    alter table if exists public.asset_scan_events
      add column if not exists field_manager_id uuid,
      add column if not exists field_manager_display_name text,
      add column if not exists field_manager_session_id text
  `).catch(() => undefined);
}

export async function ensureFieldManagerTables(): Promise<void> {
  if (!fieldManagerTablesPromise) {
    fieldManagerTablesPromise = ensureFieldManagerTablesOnce().catch((error) => {
      fieldManagerTablesPromise = null;
      throw error;
    });
  }

  return fieldManagerTablesPromise;
}

export async function hashFieldManagerPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('base64url')}`;
}

export async function verifyFieldManagerPassword(password: string, storedHash: string): Promise<boolean> {
  const [scheme, salt, key] = storedHash.split('$');

  if (scheme !== 'scrypt' || !salt || !key) {
    return false;
  }

  const expected = Buffer.from(key, 'base64url');
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function listFieldManagers(ownerUserId: string): Promise<FieldManagerRecord[]> {
  await ensureFieldManagerTables();
  const db = getDb();
  const result = await db.query<FieldManagerRow>(
    `
      select
        id::text as id,
        owner_user_id,
        display_name,
        username,
        username_normalized,
        password_hash,
        is_active,
        last_login_at,
        created_at,
        updated_at
      from public.field_managers
      where owner_user_id = $1
      order by created_at desc, id desc
    `,
    [ownerUserId],
  );

  return result.rows.map(mapFieldManagerRow);
}

export async function createFieldManager(ownerUserId: string, input: CreateFieldManagerInput): Promise<FieldManagerRecord> {
  await ensureFieldManagerTables();
  const db = getDb();
  const normalized = validateFieldManagerCore(input);
  const passwordHash = await hashFieldManagerPassword(normalized.password);

  try {
    const result = await db.query<FieldManagerRow>(
      `
        insert into public.field_managers (
          owner_user_id,
          display_name,
          username,
          username_normalized,
          password_hash,
          is_active,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, true, now(), now())
        returning
          id::text as id,
          owner_user_id,
          display_name,
          username,
          username_normalized,
          password_hash,
          is_active,
          last_login_at,
          created_at,
          updated_at
      `,
      [ownerUserId, normalized.displayName, normalized.username, normalized.usernameNormalized, passwordHash],
    );

    const row = result.rows[0];
    if (!row) throw new Error('Failed to create Field Manager login.');
    return mapFieldManagerRow(row);
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && (error as { code?: unknown }).code === '23505') {
      throw new Error('That Field Manager username is already in use. Choose another username.');
    }

    throw error;
  }
}

export async function updateFieldManager(
  ownerUserId: string,
  managerId: string,
  input: UpdateFieldManagerInput,
): Promise<FieldManagerRecord> {
  await ensureFieldManagerTables();
  const db = getDb();
  const normalized = normalizeUpdateInput(input);
  const passwordHash = normalized.password ? await hashFieldManagerPassword(normalized.password) : null;

  try {
    const result = await db.query<FieldManagerRow>(
      `
        update public.field_managers
        set
          display_name = coalesce($3::text, display_name),
          username = coalesce($4::text, username),
          username_normalized = coalesce($5::text, username_normalized),
          password_hash = coalesce($6::text, password_hash),
          is_active = coalesce($7::boolean, is_active),
          updated_at = now()
        where owner_user_id = $1
          and id = $2::uuid
        returning
          id::text as id,
          owner_user_id,
          display_name,
          username,
          username_normalized,
          password_hash,
          is_active,
          last_login_at,
          created_at,
          updated_at
      `,
      [
        ownerUserId,
        managerId,
        normalized.displayName ?? null,
        normalized.username ?? null,
        normalized.usernameNormalized ?? null,
        passwordHash,
        typeof normalized.isActive === 'boolean' ? normalized.isActive : null,
      ],
    );

    const row = result.rows[0];
    if (!row) throw new Error('Field Manager login was not found.');
    return mapFieldManagerRow(row);
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && (error as { code?: unknown }).code === '23505') {
      throw new Error('That Field Manager username is already in use. Choose another username.');
    }

    throw error;
  }
}

export async function getFieldManagerById(managerId: string): Promise<FieldManagerPrivateRecord | null> {
  await ensureFieldManagerTables();
  const db = getDb();
  const result = await db.query<FieldManagerRow>(
    `
      select
        id::text as id,
        owner_user_id,
        display_name,
        username,
        username_normalized,
        password_hash,
        is_active,
        last_login_at,
        created_at,
        updated_at
      from public.field_managers
      where id = $1::uuid
      limit 1
    `,
    [managerId],
  );

  const row = result.rows[0];
  return row ? mapFieldManagerPrivateRow(row) : null;
}

export async function getFieldManagerByUsername(username: string): Promise<FieldManagerPrivateRecord | null> {
  await ensureFieldManagerTables();
  const db = getDb();
  const usernameNormalized = normalizeFieldManagerUsername(username);

  if (!usernameNormalized) {
    return null;
  }

  const result = await db.query<FieldManagerRow>(
    `
      select
        id::text as id,
        owner_user_id,
        display_name,
        username,
        username_normalized,
        password_hash,
        is_active,
        last_login_at,
        created_at,
        updated_at
      from public.field_managers
      where username_normalized = $1
      limit 1
    `,
    [usernameNormalized],
  );

  const row = result.rows[0];
  return row ? mapFieldManagerPrivateRow(row) : null;
}

export async function markFieldManagerLastLogin(managerId: string): Promise<void> {
  await ensureFieldManagerTables();
  const db = getDb();
  await db.query(
    `
      update public.field_managers
      set last_login_at = now(), updated_at = now()
      where id = $1::uuid
    `,
    [managerId],
  );
}

function fieldManagerAssetSelect(whereSql: string): string {
  return `
    select
      a.id::text as id,
      a.user_id,
      a.public_asset_code,
      a.plate_label,
      a.qr_status,
      a.title,
      a.kind,
      coalesce(ef.family_label, '') as equipment_family_label,
      a.brand_name,
      a.model_name,
      a.typed_model_name,
      a.serial_number,
      to_jsonb(a)->>'license_registration_number' as license_registration_number,
      coalesce(a.specs_json, '{}'::jsonb) as specs_json,
      a.hours,
      a.life_worked_percent,
      a.last_scanned_at,
      a.updated_at
    from public.asset_register_items a
    left join public.valuation_runs vr
      on vr.id = a.valuation_run_id
    left join public.equipment_families ef
      on ef.id = coalesce(a.equipment_family_id, vr.equipment_family_id)
    ${whereSql}
  `;
}

export async function listFieldManagerAssets(
  ownerUserId: string,
  managerId: string,
): Promise<FieldManagerAssetSummary[]> {
  await ensureAssetRegisterTables();
  await ensureFieldManagerTables();

  const db = getDb();
  const result = await db.query<FieldManagerAssetRow>(
    `
      with restricted_access as (
        select asset_id
        from public.field_manager_asset_access
        where field_manager_id = $2::uuid
      ), access_state as (
        select exists(select 1 from restricted_access) as has_restrictions
      )
      ${fieldManagerAssetSelect(`
        where a.user_id = $1
          and nullif(trim(coalesce(a.public_asset_code, '')), '') is not null
          and lower(coalesce(a.qr_status, 'active')) <> 'deleted'
          and (
            (select has_restrictions from access_state) = false
            or exists (
              select 1
              from restricted_access ra
              where ra.asset_id = a.id
            )
          )
      `)}
      order by a.last_scanned_at desc nulls last, a.updated_at desc nulls last, a.created_at desc nulls last, a.id desc
      limit 1000
    `,
    [ownerUserId, managerId],
  );

  return result.rows.map(mapFieldManagerAssetRow);
}

export async function getFieldManagerAssetForOpen(input: {
  ownerUserId: string;
  managerId: string;
  assetId: string;
}): Promise<FieldManagerAssetSummary | null> {
  await ensureAssetRegisterTables();
  await ensureFieldManagerTables();

  const db = getDb();
  const result = await db.query<FieldManagerAssetRow>(
    `
      with restricted_access as (
        select asset_id
        from public.field_manager_asset_access
        where field_manager_id = $2::uuid
      ), access_state as (
        select exists(select 1 from restricted_access) as has_restrictions
      )
      ${fieldManagerAssetSelect(`
        where a.user_id = $1
          and a.id = $3::uuid
          and nullif(trim(coalesce(a.public_asset_code, '')), '') is not null
          and lower(coalesce(a.qr_status, 'active')) <> 'deleted'
          and (
            (select has_restrictions from access_state) = false
            or exists (
              select 1
              from restricted_access ra
              where ra.asset_id = a.id
            )
          )
      `)}
      limit 1
    `,
    [input.ownerUserId, input.managerId, input.assetId],
  );

  const row = result.rows[0];
  return row ? mapFieldManagerAssetRow(row) : null;
}

export async function validateFieldManagerScanAsset(input: {
  managerId: string;
  ownerUserId: string;
  publicAssetCode: string;
}): Promise<FieldManagerRecord | null> {
  await ensureFieldManagerTables();
  const db = getDb();

  const result = await db.query<FieldManagerRow>(
    `
      select
        fm.id::text as id,
        fm.owner_user_id,
        fm.display_name,
        fm.username,
        fm.username_normalized,
        fm.password_hash,
        fm.is_active,
        fm.last_login_at,
        fm.created_at,
        fm.updated_at
      from public.field_managers fm
      inner join public.asset_register_items a
        on a.user_id = fm.owner_user_id
      where fm.id = $1::uuid
        and fm.owner_user_id = $2
        and fm.is_active = true
        and upper(coalesce(a.public_asset_code, '')) = upper($3)
        and lower(coalesce(a.qr_status, 'active')) <> 'deleted'
        and (
          not exists (
            select 1
            from public.field_manager_asset_access access_check
            where access_check.field_manager_id = fm.id
          )
          or exists (
            select 1
            from public.field_manager_asset_access allowed
            where allowed.field_manager_id = fm.id
              and allowed.asset_id = a.id
          )
        )
      limit 1
    `,
    [input.managerId, input.ownerUserId, input.publicAssetCode],
  );

  const row = result.rows[0];
  return row ? mapFieldManagerRow(row) : null;
}
