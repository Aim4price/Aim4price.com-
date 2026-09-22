CREATE TABLE IF NOT EXISTS public.asset_share_links (
  token text PRIMARY KEY,
  user_id text NOT NULL,
  selection_key text NOT NULL,
  asset_ids uuid[] NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS asset_share_links_active_selection
  ON public.asset_share_links (user_id, selection_key) WHERE revoked_at IS NULL;
