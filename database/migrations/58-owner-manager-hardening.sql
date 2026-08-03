-- Owner and Field Manager app permissions, access assignments and session security.

ALTER TABLE public.owner_app_users
  ADD COLUMN IF NOT EXISTS access_role text NOT NULL DEFAULT 'operations';

UPDATE public.owner_app_users
SET access_role = 'operations'
WHERE access_role NOT IN ('admin', 'operations', 'view_only');

ALTER TABLE public.owner_app_overview_dismissals
  ADD COLUMN IF NOT EXISTS viewer_key text NOT NULL DEFAULT 'legacy-owner';

ALTER TABLE public.owner_app_overview_dismissals
  DROP CONSTRAINT IF EXISTS owner_app_overview_dismissals_pkey;

CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_app_overview_viewer_source
  ON public.owner_app_overview_dismissals(parent_owner_user_id, viewer_key, source_kind, source_id);

ALTER TABLE public.field_managers
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS login_locked_until timestamptz;

-- Plaintext passwords must never be retained or returned.
ALTER TABLE public.field_managers
  DROP COLUMN IF EXISTS password_display;

CREATE TABLE IF NOT EXISTS public.field_manager_access_settings (
  field_manager_id uuid PRIMARY KEY REFERENCES public.field_managers(id) ON DELETE CASCADE,
  asset_scope text NOT NULL DEFAULT 'all' CHECK (asset_scope IN ('all', 'selected')),
  fuel_scope text NOT NULL DEFAULT 'all' CHECK (fuel_scope IN ('all', 'selected')),
  can_record_work boolean NOT NULL DEFAULT true,
  can_schedule_maintenance boolean NOT NULL DEFAULT true,
  can_record_fuel boolean NOT NULL DEFAULT true,
  can_refill_fuel boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.field_manager_fuel_storage_access (
  field_manager_id uuid NOT NULL REFERENCES public.field_managers(id) ON DELETE CASCADE,
  fuel_storage_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (field_manager_id, fuel_storage_id)
);

CREATE INDEX IF NOT EXISTS idx_field_manager_fuel_storage_access_storage
  ON public.field_manager_fuel_storage_access(fuel_storage_id);
