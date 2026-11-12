import { getDb } from './db';
export const TEAM_ACCESS_SCHEMA = `
CREATE TABLE IF NOT EXISTS team_access (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 email text NOT NULL CHECK(email=lower(trim(email))), display_name text NOT NULL,
 member_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','revoked')),
 scope text NOT NULL DEFAULT 'selected' CHECK(scope IN ('selected','all')),
 register_ids jsonb NOT NULL DEFAULT '[]', asset_ids jsonb NOT NULL DEFAULT '[]', document_ids jsonb NOT NULL DEFAULT '[]',
 permissions jsonb NOT NULL DEFAULT '{}', expires_at timestamptz, version integer NOT NULL DEFAULT 1,
 accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,email)
);
CREATE INDEX IF NOT EXISTS team_access_member ON team_access(member_user_id,status);
CREATE INDEX IF NOT EXISTS team_access_email ON team_access(email,status);
CREATE TABLE IF NOT EXISTS team_access_activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 membership_id uuid NOT NULL REFERENCES team_access(id) ON DELETE CASCADE,
 actor_id text NOT NULL, actor_email text NOT NULL, asset_id uuid, action text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_access_activity_owner ON team_access_activity(owner_id,created_at DESC);
ALTER TABLE team_access ADD COLUMN IF NOT EXISTS managed_login boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS team_access_logins (
 grant_id uuid PRIMARY KEY REFERENCES team_access(id) ON DELETE CASCADE,
 password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS team_access_sessions (
 token_hash text PRIMARY KEY,
 grant_id uuid NOT NULL REFERENCES team_access_logins(grant_id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS team_access_sessions_grant ON team_access_sessions(grant_id);
-- Preserve business activity when a desktop membership is removed.
ALTER TABLE team_access_activity ALTER COLUMN membership_id DROP NOT NULL;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='team_access_activity'::regclass AND conname='team_access_activity_membership_id_fkey' AND confdeltype='c') THEN
  ALTER TABLE team_access_activity DROP CONSTRAINT team_access_activity_membership_id_fkey;
  ALTER TABLE team_access_activity ADD CONSTRAINT team_access_activity_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES team_access(id) ON DELETE SET NULL;
 END IF;
END $$;
-- Activate ready desktop logins without a separate invitation acceptance step.
-- Preserve inactive/expired access and never rebind a membership to another identity.
UPDATE team_access t SET status='active',member_user_id=u.id,version=t.version+1,updated_at=now()
FROM "user" u
WHERE t.status='pending' AND NOT t.managed_login AND lower(u.email)=t.email
 AND (t.member_user_id=u.id OR (t.member_user_id IS NULL AND u.id=(SELECT min(u2.id) FROM "user" u2 WHERE lower(u2.email)=t.email)))
 AND (t.expires_at IS NULL OR t.expires_at>now());
UPDATE team_access t SET status='active',version=t.version+1,updated_at=now()
WHERE t.status='pending' AND t.managed_login
 AND EXISTS (SELECT 1 FROM team_access_logins l WHERE l.grant_id=t.id)
 AND (t.expires_at IS NULL OR t.expires_at>now());
-- New business logins have a username, not a personal email identity.
-- Existing email-based logins remain valid without rewriting their credentials.
ALTER TABLE team_access ALTER COLUMN email DROP NOT NULL;
ALTER TABLE team_access ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS team_access_username ON team_access(owner_id,lower(username)) WHERE username IS NOT NULL;
-- Support username sign-in from the main login page without a business hint.
-- Non-unique to preserve historical business-scoped duplicates; ambiguous logins fail closed.
CREATE INDEX IF NOT EXISTS team_access_username_lookup ON team_access(username) WHERE username IS NOT NULL;
ALTER TABLE team_access ADD COLUMN IF NOT EXISTS document_access text NOT NULL DEFAULT 'selected' CHECK(document_access IN ('none','selected','all'));
ALTER TABLE team_access ADD COLUMN IF NOT EXISTS excluded_document_ids jsonb NOT NULL DEFAULT '[]';
-- Existing desktop users gain no client access.
ALTER TABLE team_access ADD COLUMN IF NOT EXISTS client_work_ids jsonb NOT NULL DEFAULT '[]';
ALTER TABLE team_access ADD COLUMN IF NOT EXISTS fuel_storage_ids jsonb;
ALTER TABLE team_access ADD COLUMN IF NOT EXISTS parts_list_ids jsonb NOT NULL DEFAULT '[]';
`;
let ready: Promise<void> | undefined;
export function ensureTeamAccessSchema() {
    return ready ??= getDb().query(TEAM_ACCESS_SCHEMA).then(() => { }).catch(error => { ready = undefined; throw error; });
}
