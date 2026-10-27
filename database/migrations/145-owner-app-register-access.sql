ALTER TABLE public.owner_app_user_access_settings
  ADD COLUMN IF NOT EXISTS register_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
