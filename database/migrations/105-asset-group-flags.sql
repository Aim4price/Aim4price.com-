-- Independent umbrella flag; existing member asset flags are unchanged.
ALTER TABLE IF EXISTS public.asset_groups
  ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false;
