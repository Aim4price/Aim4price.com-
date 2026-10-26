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
