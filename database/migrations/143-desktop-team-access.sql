-- Desktop team access: independent identities, explicit grants and audit trail.

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
