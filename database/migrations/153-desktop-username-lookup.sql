-- Support username sign-in from the main login page without a business hint.
-- Non-unique to preserve historical business-scoped duplicates; ambiguous logins fail closed.
CREATE INDEX IF NOT EXISTS team_access_username_lookup ON team_access(username) WHERE username IS NOT NULL;
