-- Add a first-class license flag for asset register filters, exports and reports.
-- The detailed status choice (yes/no/not sure/not applicable) is stored in specs_json.

ALTER TABLE IF EXISTS public.asset_register_items
  ADD COLUMN IF NOT EXISTS is_licensed boolean;

UPDATE public.asset_register_items
SET is_licensed = false
WHERE is_licensed IS NULL;

ALTER TABLE IF EXISTS public.asset_register_items
  ALTER COLUMN is_licensed SET DEFAULT false;

ALTER TABLE IF EXISTS public.asset_register_items
  ALTER COLUMN is_licensed SET NOT NULL;

COMMENT ON COLUMN public.asset_register_items.is_licensed IS
  'True when an asset is marked as licensed in the asset register. Detailed yes/no/not sure/not applicable state is stored in specs_json.';
