BEGIN;

ALTER TABLE IF EXISTS public.asset_register_items
  DROP CONSTRAINT IF EXISTS asset_register_items_kind_check;

ALTER TABLE IF EXISTS public.asset_register_items
  ADD CONSTRAINT asset_register_items_kind_check
    CHECK (kind IN ('tractor', 'equipment', 'manual', 'property', 'vehicle', 'tools', 'stock'));

COMMIT;
