-- New business logins have a username, not a personal email identity.
-- Existing email-based logins remain valid without rewriting their credentials.
ALTER TABLE team_access ALTER COLUMN email DROP NOT NULL;
ALTER TABLE team_access ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS team_access_username ON team_access(owner_id,lower(username)) WHERE username IS NOT NULL;
