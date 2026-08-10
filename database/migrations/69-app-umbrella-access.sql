BEGIN;

CREATE TABLE IF NOT EXISTS public.field_manager_group_access (
  field_manager_id uuid NOT NULL REFERENCES public.field_managers(id) ON DELETE CASCADE,
  group_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (field_manager_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_field_manager_group_access_group
  ON public.field_manager_group_access(group_id);

CREATE TABLE IF NOT EXISTS public.owner_app_user_access_settings (
  owner_app_user_id uuid PRIMARY KEY REFERENCES public.owner_app_users(id) ON DELETE CASCADE,
  asset_scope text NOT NULL DEFAULT 'all' CHECK (asset_scope IN ('all', 'selected')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.owner_app_user_asset_access (
  owner_app_user_id uuid NOT NULL REFERENCES public.owner_app_users(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_app_user_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_owner_app_user_asset_access_asset
  ON public.owner_app_user_asset_access(asset_id);

CREATE TABLE IF NOT EXISTS public.owner_app_user_group_access (
  owner_app_user_id uuid NOT NULL REFERENCES public.owner_app_users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_app_user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_owner_app_user_group_access_group
  ON public.owner_app_user_group_access(group_id);

COMMIT;
