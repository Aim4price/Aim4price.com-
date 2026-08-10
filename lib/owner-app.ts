import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getDb } from './db';
import { listAssetGroups } from './asset-groups';
import { listAllOwnerAppAssets } from './owner-app-assets';

const scryptAsync = promisify(scrypt);

export const OWNER_APP_PASSCODE_LENGTH = 4;
export const OWNER_APP_MAX_FAILED_ATTEMPTS = 5;
export const OWNER_APP_LOCK_MINUTES = 15;
export type OwnerAppAccessRole = 'admin' | 'operations' | 'view_only';

type OwnerAppUserRow = {
  id: string;
  parent_owner_user_id: string;
  display_name: string;
  username: string;
  username_normalized: string;
  password_hash: string;
  is_active: boolean;
  access_role: OwnerAppAccessRole;
  session_version: number;
  failed_login_attempts: number;
  login_locked_until: string | Date | null;
  last_login_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export type OwnerAppUserRecord = {
  id: string;
  parentOwnerUserId: string;
  displayName: string;
  username: string;
  isActive: boolean;
  accessRole: OwnerAppAccessRole;
  sessionVersion: number;
  lastLoginAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type OwnerAppAssetAccessSettings = {
  assetScope: 'all' | 'selected';
  assetIds: string[];
  groupIds: string[];
};

let ownerAppTablesPromise: Promise<void> | null = null;

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toIso(value: string | Date | null): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function mapOwnerAppUser(row: OwnerAppUserRow): OwnerAppUserRecord {
  return {
    id: row.id,
    parentOwnerUserId: row.parent_owner_user_id,
    displayName: row.display_name,
    username: row.username,
    isActive: Boolean(row.is_active),
    accessRole: normalizeOwnerAppAccessRole(row.access_role),
    sessionVersion: Number(row.session_version || 1),
    lastLoginAtIso: toIso(row.last_login_at),
    createdAtIso: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAtIso: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

async function ensureOwnerAppTablesOnce(): Promise<void> {
  const db = getDb();
  await db.query('create extension if not exists pgcrypto');
  await db.query(`
    create table if not exists public.owner_app_users (
      id uuid primary key default gen_random_uuid(),
      parent_owner_user_id text not null references public."user"(id) on delete cascade,
      display_name text not null,
      username text not null,
      username_normalized text not null,
      password_hash text not null,
      is_active boolean not null default true,
      access_role text not null default 'operations',
      session_version integer not null default 1 check (session_version > 0),
      failed_login_attempts integer not null default 0 check (failed_login_attempts >= 0),
      login_locked_until timestamptz,
      last_login_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await db.query('alter table public.owner_app_users add column if not exists failed_login_attempts integer not null default 0');
  await db.query('alter table public.owner_app_users add column if not exists login_locked_until timestamptz');
  await db.query(`alter table public.owner_app_users add column if not exists access_role text not null default 'operations'`);
  await db.query('create unique index if not exists idx_owner_app_users_username_normalized on public.owner_app_users(username_normalized)');
  await db.query('create index if not exists idx_owner_app_users_parent on public.owner_app_users(parent_owner_user_id, created_at desc)');
  await db.query('create index if not exists idx_owner_app_users_active on public.owner_app_users(parent_owner_user_id, is_active)');
  await db.query(`
    create table if not exists public.owner_app_user_access_settings (
      owner_app_user_id uuid primary key references public.owner_app_users(id) on delete cascade,
      asset_scope text not null default 'all' check (asset_scope in ('all', 'selected')),
      updated_at timestamptz not null default now()
    )
  `);
  await db.query(`
    create table if not exists public.owner_app_user_asset_access (
      owner_app_user_id uuid not null references public.owner_app_users(id) on delete cascade,
      asset_id uuid not null,
      created_at timestamptz not null default now(),
      primary key (owner_app_user_id, asset_id)
    )
  `);
  await db.query('create index if not exists idx_owner_app_user_asset_access_asset on public.owner_app_user_asset_access(asset_id)');
  await db.query(`
    create table if not exists public.owner_app_user_group_access (
      owner_app_user_id uuid not null references public.owner_app_users(id) on delete cascade,
      group_id uuid not null,
      created_at timestamptz not null default now(),
      primary key (owner_app_user_id, group_id)
    )
  `);
  await db.query('create index if not exists idx_owner_app_user_group_access_group on public.owner_app_user_group_access(group_id)');
  await db.query(`
    create table if not exists public.owner_app_overview_dismissals (
      parent_owner_user_id text not null references public."user"(id) on delete cascade,
      viewer_key text not null default 'legacy-owner',
      source_kind text not null check (source_kind in ('maintenance', 'problem', 'license')),
      source_id text not null,
      overview_item_id text not null,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      dismissed_at timestamptz not null default now(),
      primary key (parent_owner_user_id, viewer_key, source_kind, source_id)
    )
  `);
  await db.query(`alter table public.owner_app_overview_dismissals add column if not exists viewer_key text not null default 'legacy-owner'`);
  await db.query('alter table public.owner_app_overview_dismissals drop constraint if exists owner_app_overview_dismissals_pkey');
  await db.query('create unique index if not exists idx_owner_app_overview_viewer_source on public.owner_app_overview_dismissals(parent_owner_user_id, viewer_key, source_kind, source_id)');
  await db.query('create index if not exists idx_owner_app_overview_dismissals_asset on public.owner_app_overview_dismissals(asset_register_item_id)');
}

export async function ensureOwnerAppTables(): Promise<void> {
  if (!ownerAppTablesPromise) {
    ownerAppTablesPromise = ensureOwnerAppTablesOnce().catch((error) => {
      ownerAppTablesPromise = null;
      throw error;
    });
  }
  await ownerAppTablesPromise;
}

export function normalizeOwnerAppUsername(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._@-]/g, '')
    .slice(0, 80);
}

export function normalizeOwnerAppAccessRole(value: unknown): OwnerAppAccessRole {
  const normalized = cleanText(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'admin' || normalized === 'owner_admin') return 'admin';
  if (normalized === 'view_only' || normalized === 'viewer') return 'view_only';
  return 'operations';
}

function ownerAssetAccessScope(value: unknown): 'all' | 'selected' {
  return cleanText(value).toLowerCase() === 'selected' ? 'selected' : 'all';
}

function uuidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(cleanText).filter((id) => (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ))));
}

export async function getOwnerAppAssetAccessSettings(
  parentOwnerUserId: string,
  ownerAppUserId: string,
): Promise<OwnerAppAssetAccessSettings> {
  await ensureOwnerAppTables();
  const result = await getDb().query<{
    asset_scope: string | null;
    asset_ids: unknown;
    group_ids: unknown;
    access_role: OwnerAppAccessRole;
  }>(
    `select
      coalesce(settings.asset_scope, 'all') as asset_scope,
      owner_user.access_role,
      coalesce((
        select jsonb_agg(access.asset_id::text order by access.asset_id::text)
        from public.owner_app_user_asset_access access
        where access.owner_app_user_id = owner_user.id
      ), '[]'::jsonb) as asset_ids,
      coalesce((
        select jsonb_agg(access.group_id::text order by access.group_id::text)
        from public.owner_app_user_group_access access
        where access.owner_app_user_id = owner_user.id
      ), '[]'::jsonb) as group_ids
    from public.owner_app_users owner_user
    left join public.owner_app_user_access_settings settings on settings.owner_app_user_id = owner_user.id
    where owner_user.parent_owner_user_id = $1 and owner_user.id = $2::uuid
    limit 1`,
    [parentOwnerUserId, ownerAppUserId],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Owner App user not found.');
  if (normalizeOwnerAppAccessRole(row.access_role) === 'admin') {
    return { assetScope: 'all', assetIds: [], groupIds: [] };
  }
  return {
    assetScope: ownerAssetAccessScope(row.asset_scope),
    assetIds: uuidList(row.asset_ids),
    groupIds: uuidList(row.group_ids),
  };
}

export async function resolveOwnerAppAccessibleAssetIds(
  parentOwnerUserId: string,
  ownerAppUserId: string,
): Promise<string[]> {
  const settings = await getOwnerAppAssetAccessSettings(parentOwnerUserId, ownerAppUserId);
  if (settings.assetScope === 'all') return [];

  const result = await getDb().query<{ asset_id: string }>(
    `select explicit.asset_id::text as asset_id
       from public.owner_app_user_asset_access explicit
       inner join public.owner_app_users owner_user on owner_user.id = explicit.owner_app_user_id
       where explicit.owner_app_user_id = $1::uuid and owner_user.parent_owner_user_id = $2
     union
     select member.asset_id::text as asset_id
       from public.owner_app_user_group_access group_access
       inner join public.owner_app_users owner_user on owner_user.id = group_access.owner_app_user_id
       inner join public.asset_groups asset_group on asset_group.id = group_access.group_id and asset_group.user_id = $2
       inner join public.asset_group_members member on member.group_id = asset_group.id
       where group_access.owner_app_user_id = $1::uuid and owner_user.parent_owner_user_id = $2`,
    [ownerAppUserId, parentOwnerUserId],
  );
  return Array.from(new Set(result.rows.map((row) => cleanText(row.asset_id)).filter(Boolean)));
}

export async function updateOwnerAppAssetAccessSettings(
  parentOwnerUserId: string,
  ownerAppUserId: string,
  input: Record<string, unknown>,
): Promise<OwnerAppAssetAccessSettings> {
  const current = await getOwnerAppAssetAccessSettings(parentOwnerUserId, ownerAppUserId);
  const ownerAppUser = await getOwnerAppUserById(ownerAppUserId);
  if (!ownerAppUser || ownerAppUser.parent_owner_user_id !== parentOwnerUserId) {
    throw new Error('Owner App user not found.');
  }
  if (normalizeOwnerAppAccessRole(ownerAppUser.access_role) === 'admin') return current;

  const assetScope = ownerAssetAccessScope(input.assetScope);
  const requestedAssetIds = uuidList(input.assetIds);
  const requestedGroupIds = uuidList(input.groupIds);
  const [assetData, groups] = await Promise.all([
    listAllOwnerAppAssets(parentOwnerUserId),
    listAssetGroups(parentOwnerUserId),
  ]);
  const ownedAssetIds = new Set(assetData.items.map((asset) => asset.id));
  const ownedGroupIds = new Set(groups.map((group) => group.id));
  const assetIds = requestedAssetIds.filter((assetId) => ownedAssetIds.has(assetId));
  const groupIds = requestedGroupIds.filter((groupId) => ownedGroupIds.has(groupId));
  const db = getDb();

  await db.query(
    `insert into public.owner_app_user_access_settings (owner_app_user_id, asset_scope, updated_at)
     values ($1::uuid, $2, now())
     on conflict (owner_app_user_id) do update set asset_scope = excluded.asset_scope, updated_at = now()`,
    [ownerAppUserId, assetScope],
  );
  await db.query('delete from public.owner_app_user_asset_access where owner_app_user_id = $1::uuid', [ownerAppUserId]);
  await db.query('delete from public.owner_app_user_group_access where owner_app_user_id = $1::uuid', [ownerAppUserId]);
  if (assetScope === 'selected' && assetIds.length) {
    await db.query(
      `insert into public.owner_app_user_asset_access (owner_app_user_id, asset_id)
       select $1::uuid, value::uuid from unnest($2::text[]) value on conflict do nothing`,
      [ownerAppUserId, assetIds],
    );
  }
  if (assetScope === 'selected' && groupIds.length) {
    await db.query(
      `insert into public.owner_app_user_group_access (owner_app_user_id, group_id)
       select $1::uuid, value::uuid from unnest($2::text[]) value on conflict do nothing`,
      [ownerAppUserId, groupIds],
    );
  }
  return getOwnerAppAssetAccessSettings(parentOwnerUserId, ownerAppUserId);
}

async function hashOwnerAppPassword(password: string): Promise<string> {
  const salt = randomBytes(18).toString('base64url');
  const key = await scryptAsync(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${key.toString('base64url')}`;
}

export async function verifyOwnerAppPassword(password: string, encoded: string): Promise<boolean> {
  const [scheme, salt, raw] = encoded.split('$');
  if (scheme !== 'scrypt' || !salt || !raw) return false;
  const expected = Buffer.from(raw, 'base64url');
  const actual = await scryptAsync(password, salt, expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function validatePasscode(value: unknown): string {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 4 || password.length > 64 || !/\S/.test(password)) {
    throw new Error('Passcode must contain between 4 and 64 characters.');
  }
  return password;
}

export async function listOwnerAppUsers(parentOwnerUserId: string): Promise<OwnerAppUserRecord[]> {
  await ensureOwnerAppTables();
  const result = await getDb().query<OwnerAppUserRow>(
    'select * from public.owner_app_users where parent_owner_user_id = $1 order by created_at desc',
    [parentOwnerUserId],
  );
  return result.rows.map(mapOwnerAppUser);
}

export async function createOwnerAppUser(
  parentOwnerUserId: string,
  input: Record<string, unknown>,
): Promise<OwnerAppUserRecord> {
  await ensureOwnerAppTables();
  const displayName = cleanText(input.displayName).replace(/\s+/g, ' ').slice(0, 120);
  const username = normalizeOwnerAppUsername(input.username);
  const password = validatePasscode(input.password);
  const accessRole = normalizeOwnerAppAccessRole(input.accessRole);
  if (!displayName) throw new Error('Enter the user display name.');
  if (username.length < 3) throw new Error('Username must be at least 3 characters.');

  try {
    const result = await getDb().query<OwnerAppUserRow>(
      `insert into public.owner_app_users (
        parent_owner_user_id, display_name, username, username_normalized, password_hash, is_active, access_role
      ) values ($1, $2, $3, $3, $4, true, $5) returning *`,
      [parentOwnerUserId, displayName, username, await hashOwnerAppPassword(password), accessRole],
    );
    return mapOwnerAppUser(result.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') throw new Error('That username is already in use.');
    throw error;
  }
}

export async function updateOwnerAppUser(
  parentOwnerUserId: string,
  id: string,
  input: Record<string, unknown>,
): Promise<OwnerAppUserRecord> {
  await ensureOwnerAppTables();
  const current = await getDb().query<OwnerAppUserRow>(
    'select * from public.owner_app_users where id = $1::uuid and parent_owner_user_id = $2 limit 1',
    [id, parentOwnerUserId],
  );
  const row = current.rows[0];
  if (!row) throw new Error('Owner App user not found.');

  const displayName = Object.hasOwn(input, 'displayName')
    ? cleanText(input.displayName).replace(/\s+/g, ' ').slice(0, 120)
    : row.display_name;
  const username = Object.hasOwn(input, 'username')
    ? normalizeOwnerAppUsername(input.username)
    : row.username_normalized;
  const passwordChanged = Object.hasOwn(input, 'password') && cleanText(input.password).length > 0;
  const isActive = Object.hasOwn(input, 'isActive') ? Boolean(input.isActive) : row.is_active;
  const accessRole = Object.hasOwn(input, 'accessRole') ? normalizeOwnerAppAccessRole(input.accessRole) : normalizeOwnerAppAccessRole(row.access_role);
  if (!displayName) throw new Error('Enter the user display name.');
  if (username.length < 3) throw new Error('Username must be at least 3 characters.');
  const passwordHash = passwordChanged
    ? await hashOwnerAppPassword(validatePasscode(input.password))
    : row.password_hash;
  const mustRevoke = passwordChanged || isActive !== row.is_active || accessRole !== normalizeOwnerAppAccessRole(row.access_role);

  try {
    const result = await getDb().query<OwnerAppUserRow>(
      `update public.owner_app_users set
        display_name = $3,
        username = $4,
        username_normalized = $4,
        password_hash = $5,
        is_active = $6,
        access_role = $7,
        session_version = session_version + $8,
        updated_at = now()
      where id = $1::uuid and parent_owner_user_id = $2
      returning *`,
      [id, parentOwnerUserId, displayName, username, passwordHash, isActive, accessRole, mustRevoke ? 1 : 0],
    );
    if (accessRole === 'admin') {
      await Promise.all([
        getDb().query(
          `insert into public.owner_app_user_access_settings (owner_app_user_id, asset_scope, updated_at)
           values ($1::uuid, 'all', now())
           on conflict (owner_app_user_id) do update set asset_scope = 'all', updated_at = now()`,
          [id],
        ),
        getDb().query('delete from public.owner_app_user_asset_access where owner_app_user_id = $1::uuid', [id]),
        getDb().query('delete from public.owner_app_user_group_access where owner_app_user_id = $1::uuid', [id]),
      ]);
    }
    return mapOwnerAppUser(result.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') throw new Error('That username is already in use.');
    throw error;
  }
}

export async function deleteOwnerAppUser(parentOwnerUserId: string, id: string): Promise<void> {
  await ensureOwnerAppTables();
  const result = await getDb().query(
    'delete from public.owner_app_users where id = $1::uuid and parent_owner_user_id = $2',
    [id, parentOwnerUserId],
  );
  if (!result.rowCount) throw new Error('Owner App user not found.');
}

export async function findOwnerAppUserForLogin(username: string): Promise<OwnerAppUserRow | null> {
  await ensureOwnerAppTables();
  const result = await getDb().query<OwnerAppUserRow>(
    'select * from public.owner_app_users where username_normalized = $1 limit 1',
    [normalizeOwnerAppUsername(username)],
  );
  return result.rows[0] ?? null;
}

export function isOwnerAppLoginLocked(row: OwnerAppUserRow): boolean {
  if (!row.login_locked_until) return false;
  const lockedUntil = row.login_locked_until instanceof Date ? row.login_locked_until : new Date(row.login_locked_until);
  return !Number.isNaN(lockedUntil.getTime()) && lockedUntil.getTime() > Date.now();
}

export async function recordOwnerAppLoginFailure(id: string): Promise<boolean> {
  await ensureOwnerAppTables();
  const result = await getDb().query<{ locked: boolean }>(
    `with current_state as (
      select id,
        case
          when login_locked_until is not null and login_locked_until <= now() then 1
          else failed_login_attempts + 1
        end as next_attempt
      from public.owner_app_users
      where id = $1::uuid
      for update
    )
    update public.owner_app_users as owner_user set
      failed_login_attempts = current_state.next_attempt,
      login_locked_until = case
        when current_state.next_attempt >= $2 then now() + ($3 * interval '1 minute')
        else null
      end,
      updated_at = now()
    from current_state
    where owner_user.id = current_state.id
    returning owner_user.login_locked_until is not null and owner_user.login_locked_until > now() as locked`,
    [id, OWNER_APP_MAX_FAILED_ATTEMPTS, OWNER_APP_LOCK_MINUTES],
  );
  return Boolean(result.rows[0]?.locked);
}

export async function getOwnerAppUserById(id: string): Promise<OwnerAppUserRow | null> {
  await ensureOwnerAppTables();
  const result = await getDb().query<OwnerAppUserRow>(
    'select * from public.owner_app_users where id = $1::uuid limit 1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function markOwnerAppUserLogin(id: string): Promise<void> {
  await ensureOwnerAppTables();
  await getDb().query(
    `update public.owner_app_users set
      failed_login_attempts = 0,
      login_locked_until = null,
      last_login_at = now(),
      updated_at = now()
    where id = $1::uuid`,
    [id],
  );
}
