ALTER TABLE public.asset_share_links
  ADD COLUMN IF NOT EXISTS password_hash text;

CREATE TABLE IF NOT EXISTS public.asset_share_sessions (
  token_hash text PRIMARY KEY,
  share_token text NOT NULL REFERENCES public.asset_share_links(token) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
