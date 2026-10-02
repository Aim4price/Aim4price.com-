ALTER TABLE dealer_maintenance_access
  ADD COLUMN IF NOT EXISTS can_update_year boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_update_usage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_update_condition boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_add_maintenance boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS shared_asset_activity (
 id uuid PRIMARY KEY, owner_id text NOT NULL, asset_id uuid NOT NULL,
 actor_id text NOT NULL, actor_name text NOT NULL, action text NOT NULL,
 before_data jsonb NOT NULL DEFAULT '{}', after_data jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shared_asset_activity_asset ON shared_asset_activity(owner_id,asset_id,created_at DESC);
