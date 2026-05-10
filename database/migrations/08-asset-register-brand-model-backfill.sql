-- Adds persistent brand/model storage to Asset Register items and backfills it
-- from the linked valuation run where available.
-- Safe to run more than once.

ALTER TABLE IF EXISTS public.asset_register_items
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS model_name text;

UPDATE public.asset_register_items ari
SET
  brand_name = COALESCE(NULLIF(trim(ari.brand_name), ''), NULLIF(trim(vr.brand_name), '')),
  model_name = COALESCE(
    NULLIF(trim(ari.model_name), ''),
    NULLIF(trim(vr.model_name), ''),
    NULLIF(trim(vr.typed_model_name), '')
  )
FROM public.valuation_runs vr
WHERE ari.valuation_run_id = vr.id
  AND (
    COALESCE(NULLIF(trim(ari.brand_name), ''), '') = ''
    OR COALESCE(NULLIF(trim(ari.model_name), ''), '') = ''
  );

CREATE INDEX IF NOT EXISTS idx_asset_register_items_brand_model
  ON public.asset_register_items(user_id, brand_name, model_name);
