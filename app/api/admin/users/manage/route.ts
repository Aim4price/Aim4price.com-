import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminApiAccess, adminApiError } from "../../../../../lib/admin-api-access";
import { ACCOUNT_STATUS_VALUES, isAim4priceAdminEmail, normalizeEmail } from "../../../../../lib/account-constants";
import { ensureAccountProfileColumns } from "../../../../../lib/account-profile";
import { SIGNUP_ACCOUNT_TYPE_OPTIONS, SIGNUP_ACCOUNT_SUBTYPE_OPTIONS } from "../../../../../lib/account-type-options";
import { listAdminUsers } from "../../../../../lib/admin-users";
import { ensureBusinessMembership, ensureBusinessWorkspaceSchema } from "../../../../../lib/business-workspaces";
import { getDb, withDatabaseClient } from "../../../../../lib/db";
import { ensureSharingFoundation } from "../../../../../lib/sharing-foundation";
import { isEmailLogin } from "../../../../../lib/team-access-policy";

import { isTrustedRequestOrigin } from "../../../../../lib/trusted-request-origin";

export const runtime = "nodejs";
class InvalidChange extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function POST(request: Request) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  if (!isTrustedRequestOrigin(request.headers.get("origin"), new URL(request.url).origin)) return adminApiError("Use the Aim4price Admin page.", 403);
  const input = await request.json().catch(() => null);
  const create = input?.action === "create";
  if (!create && input?.action !== "change_type") return adminApiError("Choose an account action.");
  const type = SIGNUP_ACCOUNT_TYPE_OPTIONS.find(option => option.value === input.type)?.value;
  if (!type || !SIGNUP_ACCOUNT_SUBTYPE_OPTIONS[type].some(option => option.value === input.subtype)) {
    return adminApiError("Choose a valid account type and subtype.");
  }
  const storedType = type === "middleman" ? "dealer" : type;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = normalizeEmail(input.email);
  if (create && (!name || name.length > 200 || !isEmailLogin(email) || email.length > 254 || !ACCOUNT_STATUS_VALUES.includes(input.status))) {
    return adminApiError("Enter a name, a valid email and an account status.");
  }
  if (create && isAim4priceAdminEmail(email)) return adminApiError("This email belongs to the administrator.", 409);
  const userId = create ? randomUUID() : input.userId;
  if (typeof userId !== "string" || !userId) return adminApiError("Select an account.");

  try {
    await ensureAccountProfileColumns();
    await ensureSharingFoundation();
    if (type === "business") await ensureBusinessWorkspaceSchema();
    const db = await getDb().connect();
    try {
      await db.query("BEGIN");
      let previousType: string | null = null;
      if (create) {
        const added = await db.query(`INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt")
          SELECT $1,$2,$3,false,now(),now() WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE lower(email)=$3)
          ON CONFLICT DO NOTHING RETURNING id`, [userId,name,email]);
        if (!added.rowCount) {
          const duplicate = (await db.query('SELECT id FROM "user" WHERE lower(email)=$1', [email])).rows[0];
          const [existing] = duplicate ? await withDatabaseClient(db, () => listAdminUsers(duplicate.id)) : [];
          await db.query("ROLLBACK");
          return NextResponse.json({error:"An account already uses this email.",existing}, {status:409});
        }
        await db.query(`INSERT INTO account_profiles(user_id,display_name,account_type,account_subtype,account_status,introduced_by_option)
          VALUES($1,$2,$3,$4,$5,'direct')`, [userId,name,storedType,input.subtype,input.status]);
      } else {
        const user = (await db.query('SELECT email,name FROM "user" WHERE id=$1 FOR UPDATE',[userId])).rows[0];
        if (!user) throw new InvalidChange("Account no longer exists.",404);
        if (isAim4priceAdminEmail(user.email)) throw new InvalidChange("The administrator account type is protected.",403);
        await db.query(`INSERT INTO account_profiles(user_id,display_name,account_type,account_subtype,account_status)
          VALUES($1,$2,'owner','farmer','pending_payment') ON CONFLICT(user_id) DO NOTHING`,[userId,user.name]);
        const profile = (await db.query("SELECT account_type,account_subtype FROM account_profiles WHERE user_id=$1 FOR UPDATE",[userId])).rows[0];
        if (profile.account_type !== input.previousType || profile.account_subtype !== input.previousSubtype) {
          throw new InvalidChange("This account changed. Refresh Accounts before editing it again.",409);
        }
        previousType = profile.account_type;
        await db.query(`UPDATE account_profiles SET account_type=$2,account_subtype=$3,
          partner_directory_enabled=CASE WHEN $2='owner' OR $3='equipment-middleman' THEN false ELSE partner_directory_enabled END,
          discovery_participation_enabled=CASE WHEN $2='owner' THEN discovery_participation_enabled ELSE false END,
          updated_at=now() WHERE user_id=$1`,[userId,storedType,input.subtype]);
      }
      if (type === "business" || previousType === "business") {
        const plan = type === "business" ? "free" : "desktop";
        await db.query(`INSERT INTO sharing_account_access(user_id,plan,updated_by) VALUES($1,$2,$3)
          ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,updated_by=excluded.updated_by,updated_at=now()`,[userId,plan,access.actor.userId]);
      }
      if (type === "business" && !(await ensureBusinessMembership(db,userId))) {
        throw new InvalidChange("Review the existing Business membership before switching this account.",409);
      }
      await db.query("INSERT INTO sharing_admin_events(actor_id,account_id,action,detail) VALUES($1,$2,$3,$4::jsonb)",
        [access.actor.userId,userId,create ? "account_created" : "account_type_changed",JSON.stringify({previousType,previousSubtype:create ? null : input.previousSubtype,type,subtype:input.subtype})]);
      const [user] = await withDatabaseClient(db, () => listAdminUsers(userId));
      await db.query("COMMIT");
      return NextResponse.json({user},{status:create ? 201 : 200});
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally { db.release(); }
  } catch (error) {
    if (error instanceof InvalidChange) return adminApiError(error.message,error.status);
    console.error("Admin account change failed",error);
    return adminApiError("The account could not be saved.",500);
  }
}
