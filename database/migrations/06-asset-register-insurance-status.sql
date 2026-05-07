-- Add insurance tracking to saved Asset Register items.
-- Safe to run more than once.

ALTER TABLE IF EXISTS public.asset_register_items
  ADD COLUMN IF NOT EXISTS is_insured boolean;

UPDATE public.asset_register_items
SET is_insured = false
WHERE is_insured IS NULL;

ALTER TABLE IF EXISTS public.asset_register_items
  ALTER COLUMN is_insured SET DEFAULT false;

ALTER TABLE IF EXISTS public.asset_register_items
  ALTER COLUMN is_insured SET NOT NULL;
