ALTER TABLE dealer_maintenance_access ADD COLUMN IF NOT EXISTS can_suggest_current_value boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS asset_value_requests (
 id uuid PRIMARY KEY, owner_id text NOT NULL, asset_id uuid NOT NULL, actor_id text NOT NULL,
 actor_name text NOT NULL, amount numeric NOT NULL CHECK(amount >= 0), reason text NOT NULL,
 submitted_value numeric NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
 decided_by text, decision_reason text, created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 email_attempted_at timestamptz, email_sent_at timestamptz, email_error text
);
CREATE INDEX IF NOT EXISTS asset_value_requests_owner_pending ON asset_value_requests(owner_id,status,created_at DESC);
