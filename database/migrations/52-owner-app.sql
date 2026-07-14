-- Aim4price Owner App access and owner-level Overview dismissals.
-- Passwords are stored only as salted scrypt hashes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.owner_app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_owner_user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  username text NOT NULL,
  username_normalized text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  session_version integer NOT NULL DEFAULT 1 CHECK (session_version > 0),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_app_users_username_normalized
  ON public.owner_app_users(username_normalized);
CREATE INDEX IF NOT EXISTS idx_owner_app_users_parent
  ON public.owner_app_users(parent_owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_app_users_active
  ON public.owner_app_users(parent_owner_user_id, is_active);

CREATE TABLE IF NOT EXISTS public.owner_app_overview_dismissals (
  parent_owner_user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('maintenance', 'problem', 'license')),
  source_id text NOT NULL,
  overview_item_id text NOT NULL,
  asset_register_item_id uuid NOT NULL REFERENCES public.asset_register_items(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_owner_user_id, source_kind, source_id)
);

CREATE INDEX IF NOT EXISTS idx_owner_app_overview_dismissals_asset
  ON public.owner_app_overview_dismissals(asset_register_item_id);
