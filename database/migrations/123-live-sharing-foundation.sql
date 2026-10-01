-- Observe usage only. Existing accounts and data retain their identities.
ALTER TABLE asset_share_links ADD COLUMN IF NOT EXISTS umbrella_id uuid;
ALTER TABLE asset_share_links ADD COLUMN IF NOT EXISTS include_photos boolean;
ALTER TABLE public.asset_share_links ADD COLUMN IF NOT EXISTS display_options jsonb;
ALTER TABLE business_network_requests ADD COLUMN IF NOT EXISTS live_share_token text;

CREATE TABLE IF NOT EXISTS sharing_account_access (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 plan text NOT NULL CHECK (plan IN ('free','desktop')),
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by text
);
CREATE TABLE IF NOT EXISTS sharing_usage_events (
 id bigserial PRIMARY KEY, account_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 actor_id text NOT NULL, session_id text, token text, asset_id uuid,
 metric text NOT NULL CHECK(metric IN ('asset_received','enquiry_opened','upload','contribution','email_attempt','email_accepted','email_failed')),
 event_key text NOT NULL, quantity bigint NOT NULL DEFAULT 1 CHECK(quantity >= 0),
 bytes bigint NOT NULL DEFAULT 0 CHECK(bytes >= 0), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,metric,event_key)
);
CREATE INDEX IF NOT EXISTS sharing_usage_account_time ON sharing_usage_events(account_id,created_at);
CREATE TABLE IF NOT EXISTS sharing_allowances (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 assets integer CHECK(assets >= 0), uploads integer CHECK(uploads >= 0),
 interactions integer CHECK(interactions >= 0), emails integer CHECK(emails >= 0),
 updated_by text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO sharing_allowances(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS sharing_session_activity(
 session_id text PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 last_seen_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS sharing_admin_events (
 id bigserial PRIMARY KEY, actor_id text NOT NULL, account_id text, action text NOT NULL,
 detail jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);