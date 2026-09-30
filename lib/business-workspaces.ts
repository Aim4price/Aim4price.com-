import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { ensureGuestLeadSchema } from './guest-lead-schema';

/** Business identity is independent of asset ownership and personal login IDs. */
export const BUSINESS_WORKSPACE_SCHEMA = `
CREATE TABLE IF NOT EXISTS business_workspaces (
 id uuid PRIMARY KEY,
 owner_user_id text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS business_workspace_members (
 business_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('owner','member')),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (business_id,user_id),
 UNIQUE (user_id)
);
CREATE TABLE IF NOT EXISTS business_verified_identities (
 email text PRIMARY KEY,
 business_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 claimed_at timestamptz NOT NULL DEFAULT now()
);`;
let ready: Promise<void> | undefined;
export function ensureBusinessWorkspaceSchema() {
 return ready ??= getDb().query(BUSINESS_WORKSPACE_SCHEMA).then(() => {}).catch(error => { ready = undefined; throw error; });
}

/** Only trusted profile data creates an initial owner membership; never reactivates one. */
export async function ensureBusinessWorkspace(userId: string) {
 await ensureBusinessWorkspaceSchema();
 const db = await getDb().connect();
 try {
  await db.query('BEGIN');
  const profile = (await db.query("SELECT user_id FROM account_profiles WHERE user_id=$1 AND account_type='business' FOR UPDATE", [userId])).rows[0];
  if (!profile) { await db.query('COMMIT'); return null; }
  await db.query(`INSERT INTO business_workspaces(id,owner_user_id)
   SELECT $2,$1 WHERE NOT EXISTS(SELECT 1 FROM business_workspace_members WHERE user_id=$1)
   ON CONFLICT(owner_user_id) DO NOTHING`, [userId,randomUUID()]);
  await db.query(`INSERT INTO business_workspace_members(business_id,user_id,role)
   SELECT id,$1,'owner' FROM business_workspaces WHERE owner_user_id=$1
   ON CONFLICT DO NOTHING`, [userId]);
  const member = (await db.query<{business_id:string;role:string}>(`SELECT business_id,role FROM business_workspace_members WHERE user_id=$1 AND status='active'`,[userId])).rows[0];
  // Database verification is authoritative. Keeping earlier claims prevents email changes resetting history.
  if (member) await db.query(`INSERT INTO business_verified_identities(email,business_id,user_id)
   SELECT lower(email),$2,id FROM "user" WHERE id=$1 AND "emailVerified"=true
   ON CONFLICT(email) DO NOTHING`,[userId,member.business_id]);
  // A recycled email cannot claim another business's history or bypass its suspension.
  const conflict = member && (await db.query(`SELECT 1 FROM "user" u JOIN business_verified_identities i ON i.email=lower(u.email) WHERE u.id=$1 AND u."emailVerified"=true AND i.business_id<>$2`, [userId,member.business_id])).rows.length > 0;
  await db.query('COMMIT');
  return conflict ? null : member ?? null;
 } catch(error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
}

export async function businessWorkspaceSummary(userId: string) {
 const membership = await ensureBusinessWorkspace(userId);
 if (!membership) return null;
 await ensureGuestLeadSchema();
 const row = (await getDb().query<{legacy_opened:number;suspended:boolean}>(`SELECT
  (SELECT count(DISTINCT usage.token)::int FROM guest_enquiry_usage usage JOIN business_verified_identities identity ON identity.email=usage.email WHERE identity.business_id=$1) AS legacy_opened,
  EXISTS(SELECT 1 FROM guest_businesses guest JOIN business_verified_identities identity ON identity.email=guest.email WHERE identity.business_id=$1 AND guest.suspended) AS suspended`,[membership.business_id])).rows[0];
 return {...membership,legacyOpened:row.legacy_opened,suspended:row.suspended};
}
