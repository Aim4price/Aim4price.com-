import { deleteUserWorkspaceData } from "./account-deletion";
import {
  accountStatusLabel,
  cleanIntroducedByName,
  isAim4priceAdminEmail,
  normalizeAccountStatus,
  normalizeIntroducedByOption,
  resolveIntroducedByDisplay,
  type AccountStatus,
} from "./account-constants";
import { ensureAccountProfileColumns } from "./account-profile";
import {
  buildLogicalClientStorageSelect,
  formatAdminStorageBytes,
  formatAdminStorageGigabytes,
} from "./admin-storage-usage";
import { getDb } from "./db";

export type AdminUserRow = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  accountType: string;
  accountSubtype: string;
  province: string;
  introducedBy: string;
  introducedByOption: string;
  introducedByName: string;
  accountStatus: AccountStatus;
  accountStatusLabel: string;
  passwordStatus: "Set" | "Not set";
  lastActiveAtIso: string | null;
  createdAtIso: string | null;
  storageBytes: number;
  storageLabel: string;
  storageGigabytesLabel: string;
  storageFileCount: number;
  postgresStorageBytes: number;
  postgresStorageLabel: string;
  bucketStorageBytes: number;
  bucketStorageLabel: string;
};

type DbAdminUserRow = {
  user_id: string;
  auth_name: string | null;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  account_type: string | null;
  account_subtype: string | null;
  province: string | null;
  account_status: string | null;
  introduced_by_option: string | null;
  introduced_by_name: string | null;
  password_set: boolean | null;
  last_active_at: string | Date | null;
  auth_created_at: string | Date | null;
  profile_created_at: string | Date | null;
  storage_bytes: string | number | null;
  storage_file_count: string | number | null;
  postgres_storage_bytes: string | number | null;
  bucket_storage_bytes: string | number | null;
};

type AdminUserIdentity = {
  id: string;
  name: string | null;
  email: string | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value.toISOString();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function asSafeNumber(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function mapAdminUserRow(row: DbAdminUserRow): AdminUserRow {
  const accountStatus = isAim4priceAdminEmail(row.email)
    ? "active"
    : normalizeAccountStatus(row.account_status);
  const introducedByOption = normalizeIntroducedByOption(
    row.introduced_by_option,
  );
  const introducedByName = cleanIntroducedByName(row.introduced_by_name);
  const storageBytes = asSafeNumber(row.storage_bytes);
  const storageFileCount = Math.round(asSafeNumber(row.storage_file_count));
  const postgresStorageBytes = asSafeNumber(row.postgres_storage_bytes);
  const bucketStorageBytes = asSafeNumber(row.bucket_storage_bytes);

  return {
    userId: row.user_id,
    name: asText(row.display_name) || asText(row.auth_name) || "Unnamed user",
    email: asText(row.email),
    phone: asText(row.phone),
    accountType: asText(row.account_type) || "owner",
    accountSubtype: asText(row.account_subtype) || "farmer",
    province: asText(row.province),
    introducedBy: resolveIntroducedByDisplay(
      introducedByOption,
      introducedByName,
    ),
    introducedByOption,
    introducedByName,
    accountStatus,
    accountStatusLabel: accountStatusLabel(accountStatus),
    passwordStatus: row.password_set ? "Set" : "Not set",
    lastActiveAtIso: toIso(row.last_active_at),
    createdAtIso: toIso(row.auth_created_at) || toIso(row.profile_created_at),
    storageBytes,
    storageLabel: formatAdminStorageBytes(storageBytes),
    storageGigabytesLabel: formatAdminStorageGigabytes(storageBytes),
    storageFileCount,
    postgresStorageBytes,
    postgresStorageLabel: formatAdminStorageBytes(postgresStorageBytes),
    bucketStorageBytes,
    bucketStorageLabel: formatAdminStorageBytes(bucketStorageBytes),
  };
}

async function getAdminUserIdentity(userId: string): Promise<AdminUserIdentity> {
  const db = getDb();
  const result = await db.query<AdminUserIdentity>(
    `
      select id, name, email
      from "user"
      where id = $1
      limit 1
    `,
    [userId],
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error("User not found.");
  }

  return user;
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  await ensureAccountProfileColumns();

  const db = getDb();
  const logicalStorageSelect = await buildLogicalClientStorageSelect();
  const result = await db.query<DbAdminUserRow>(
    `
      with upload_storage as (
        ${logicalStorageSelect}
      ),
      storage_by_user as (
        select
          user_id,
          coalesce(sum(byte_size), 0)::bigint as storage_bytes,
          count(*)::bigint as storage_file_count,
          coalesce(sum(byte_size) filter (where storage_source = 'postgres'), 0)::bigint
            as postgres_storage_bytes,
          coalesce(sum(byte_size) filter (where storage_source = 'bucket'), 0)::bigint
            as bucket_storage_bytes
        from upload_storage
        group by user_id
      )
      select
        u.id as user_id,
        u.name as auth_name,
        u.email as email,
        ap.display_name,
        ap.phone,
        ap.account_type,
        ap.account_subtype,
        ap.province,
        ap.account_status,
        ap.introduced_by_option,
        ap.introduced_by_name,
        exists (
          select 1
          from "account" a
          where a."userId" = u.id
            and a."providerId" = 'credential'
            and coalesce(a.password, '') <> ''
          limit 1
        ) as password_set,
        ap.last_active_at,
        u."createdAt" as auth_created_at,
        ap.created_at as profile_created_at,
        coalesce(storage.storage_bytes, 0)::bigint as storage_bytes,
        coalesce(storage.storage_file_count, 0)::bigint as storage_file_count,
        coalesce(storage.postgres_storage_bytes, 0)::bigint as postgres_storage_bytes,
        coalesce(storage.bucket_storage_bytes, 0)::bigint as bucket_storage_bytes
      from "user" u
      left join account_profiles ap on ap.user_id = u.id
      left join storage_by_user storage on storage.user_id = u.id
      order by u."createdAt" desc nulls last, lower(u.email) asc
    `,
  );

  return result.rows.map(mapAdminUserRow);
}

export async function setAdminUserAccountStatus(
  userId: string,
  status: AccountStatus,
): Promise<void> {
  await ensureAccountProfileColumns();

  const normalizedStatus = normalizeAccountStatus(status);
  const user = await getAdminUserIdentity(userId);

  if (isAim4priceAdminEmail(user.email) && normalizedStatus !== "active") {
    throw new Error("The Aim4price admin account must remain active.");
  }

  const db = getDb();
  await db.query(
    `
      insert into account_profiles (
        user_id,
        display_name,
        account_type,
        account_subtype,
        account_status,
        introduced_by_option,
        created_at,
        updated_at
      )
      values ($1, $2, 'owner', 'farmer', $3, 'direct', now(), now())
      on conflict (user_id)
      do update set
        account_status = excluded.account_status,
        updated_at = now()
    `,
    [user.id, asText(user.name) || null, normalizedStatus],
  );
}

export async function findAdminUserEmail(userId: string): Promise<string> {
  const user = await getAdminUserIdentity(userId);
  const email = asText(user.email);

  if (!email) {
    throw new Error("User email not found.");
  }

  return email;
}

export async function assertAdminCanOpenUser(userId: string): Promise<string> {
  const email = await findAdminUserEmail(userId);

  if (isAim4priceAdminEmail(email)) {
    throw new Error("The Aim4price admin account cannot be opened as a customer account.");
  }

  return email;
}

async function deleteFromAuthTables(userId: string): Promise<void> {
  const db = getDb();
  const tableResult = await db.query<{ table_name: string }>(
    `
      select table_name
      from information_schema.tables
      where table_schema = any (current_schemas(false))
        and table_name = any($1::text[])
    `,
    [["session", "account", "user"]],
  );
  const tables = new Set(tableResult.rows.map((row) => row.table_name));

  if (tables.has("session")) {
    await db.query('delete from "session" where "userId" = $1', [userId]);
  }

  if (tables.has("account")) {
    await db.query('delete from "account" where "userId" = $1', [userId]);
  }

  if (tables.has("user")) {
    await db.query('delete from "user" where id = $1', [userId]);
  }
}

export async function deleteAdminManagedUser(userId: string): Promise<void> {
  const user = await getAdminUserIdentity(userId);

  if (isAim4priceAdminEmail(user.email)) {
    throw new Error("The Aim4price admin account cannot be deleted from this page.");
  }

  await deleteUserWorkspaceData(user.id);
  await deleteFromAuthTables(user.id);
}
