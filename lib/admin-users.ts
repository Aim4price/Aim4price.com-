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
import { getDb } from "./db";

export type AdminUserRow = {
  userId: string;
  name: string;
  email: string;
  accountType: string;
  accountSubtype: string;
  introducedBy: string;
  introducedByOption: string;
  introducedByName: string;
  accountStatus: AccountStatus;
  accountStatusLabel: string;
  passwordStatus: "Set" | "Not set";
  createdAtIso: string | null;
};

type DbAdminUserRow = {
  user_id: string;
  auth_name: string | null;
  email: string | null;
  display_name: string | null;
  account_type: string | null;
  account_subtype: string | null;
  account_status: string | null;
  introduced_by_option: string | null;
  introduced_by_name: string | null;
  password_set: boolean | null;
  auth_created_at: string | Date | null;
  profile_created_at: string | Date | null;
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

function mapAdminUserRow(row: DbAdminUserRow): AdminUserRow {
  const accountStatus = isAim4priceAdminEmail(row.email)
    ? "active"
    : normalizeAccountStatus(row.account_status);
  const introducedByOption = normalizeIntroducedByOption(
    row.introduced_by_option,
  );
  const introducedByName = cleanIntroducedByName(row.introduced_by_name);

  return {
    userId: row.user_id,
    name: asText(row.display_name) || asText(row.auth_name) || "Unnamed user",
    email: asText(row.email),
    accountType: asText(row.account_type) || "owner",
    accountSubtype: asText(row.account_subtype) || "farmer",
    introducedBy: resolveIntroducedByDisplay(
      introducedByOption,
      introducedByName,
    ),
    introducedByOption,
    introducedByName,
    accountStatus,
    accountStatusLabel: accountStatusLabel(accountStatus),
    passwordStatus: row.password_set ? "Set" : "Not set",
    createdAtIso: toIso(row.auth_created_at) || toIso(row.profile_created_at),
  };
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  await ensureAccountProfileColumns();

  const db = getDb();
  const result = await db.query<DbAdminUserRow>(
    `
      select
        u.id as user_id,
        u.name as auth_name,
        u.email as email,
        ap.display_name,
        ap.account_type,
        ap.account_subtype,
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
        u."createdAt" as auth_created_at,
        ap.created_at as profile_created_at
      from "user" u
      left join account_profiles ap on ap.user_id = u.id
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
  const db = getDb();
  const userResult = await db.query<{
    id: string;
    name: string | null;
    email: string | null;
  }>(
    `
      select id, name, email
      from "user"
      where id = $1
      limit 1
    `,
    [userId],
  );

  const user = userResult.rows[0];

  if (!user) {
    throw new Error("User not found.");
  }

  if (isAim4priceAdminEmail(user.email) && normalizedStatus !== "active") {
    throw new Error("The Aim4price admin account must remain active.");
  }

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
  const db = getDb();
  const result = await db.query<{ email: string | null }>(
    `
      select email
      from "user"
      where id = $1
      limit 1
    `,
    [userId],
  );

  const email = asText(result.rows[0]?.email);

  if (!email) {
    throw new Error("User email not found.");
  }

  return email;
}
