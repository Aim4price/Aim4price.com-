-- Aim4price Field Manager access system
-- Adds owner-created mobile-only manager logins and Field Manager audit fields.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.field_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  display_name text NOT NULL,
  username text NOT NULL,
  username_normalized text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.field_managers
  ADD COLUMN IF NOT EXISTS owner_user_id text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS username_normalized text,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.field_managers
SET username_normalized = lower(regexp_replace(coalesce(username, ''), '\s+', '', 'g'))
WHERE username_normalized IS NULL
   OR trim(username_normalized) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_field_managers_username_normalized
  ON public.field_managers(username_normalized);

CREATE INDEX IF NOT EXISTS idx_field_managers_owner_user_id
  ON public.field_managers(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.field_manager_asset_access (
  field_manager_id uuid NOT NULL REFERENCES public.field_managers(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (field_manager_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_field_manager_asset_access_asset
  ON public.field_manager_asset_access(asset_id);

ALTER TABLE IF EXISTS public.asset_scan_events
  ADD COLUMN IF NOT EXISTS field_manager_id uuid,
  ADD COLUMN IF NOT EXISTS field_manager_display_name text,
  ADD COLUMN IF NOT EXISTS field_manager_session_id text;

CREATE INDEX IF NOT EXISTS idx_asset_scan_events_field_manager
  ON public.asset_scan_events(field_manager_id, created_at DESC)
  WHERE field_manager_id IS NOT NULL;
