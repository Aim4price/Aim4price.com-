-- Aim4price year-model unknown hardening
-- Allows unknown manufacturing years to be stored as NULL and clears rows where
-- the valuation explicitly marked the year model as unknown but the app had saved
-- the current year (for example 2026) as a placeholder.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.aim4price_truthy(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(coalesce(nullif(btrim(value), ''), 'false')) IN ('true', '1', 'yes', 'y', 'on');
$$;

-- valuation_runs: the save table must allow a NULL year_model when the user chose
-- "I do not know the year". Older deployments may still have a static year check.
ALTER TABLE IF EXISTS public.valuation_runs
  DROP CONSTRAINT IF EXISTS valuation_runs_year_model_check;

ALTER TABLE IF EXISTS public.valuation_runs
  ALTER COLUMN year_model DROP NOT NULL;

UPDATE public.valuation_runs
SET year_model = NULL,
    updated_at = COALESCE(updated_at, now())
WHERE year_model IS NOT NULL
  AND (
    pg_temp.aim4price_truthy(valuation_payload::jsonb #>> '{input,yearModelUnknown}')
    OR pg_temp.aim4price_truthy(valuation_payload::jsonb #>> '{input,year_model_unknown}')
    OR pg_temp.aim4price_truthy(valuation_payload::jsonb #>> '{input,specsJson,year_model_unknown}')
    OR pg_temp.aim4price_truthy(valuation_payload::jsonb #>> '{input,specsJson,yearModelUnknown}')
    OR pg_temp.aim4price_truthy(specs_json::jsonb ->> 'year_model_unknown')
    OR pg_temp.aim4price_truthy(specs_json::jsonb ->> 'yearModelUnknown')
  );

UPDATE public.valuation_runs
SET year_model = NULL,
    updated_at = COALESCE(updated_at, now())
WHERE year_model IS NOT NULL
  AND (year_model < 1800 OR year_model > 2100);

ALTER TABLE public.valuation_runs
  ADD CONSTRAINT valuation_runs_year_model_check
  CHECK (year_model IS NULL OR (year_model BETWEEN 1800 AND 2100));

-- asset_register_items: mirror the same rule for saved Asset Register rows.
ALTER TABLE IF EXISTS public.asset_register_items
  DROP CONSTRAINT IF EXISTS asset_register_items_year_model_check;

ALTER TABLE IF EXISTS public.asset_register_items
  ALTER COLUMN year_model DROP NOT NULL;

UPDATE public.asset_register_items ari
SET year_model = NULL,
    updated_at = COALESCE(updated_at, now())
WHERE ari.year_model IS NOT NULL
  AND (
    pg_temp.aim4price_truthy(ari.specs_json::jsonb ->> 'year_model_unknown')
    OR pg_temp.aim4price_truthy(ari.specs_json::jsonb ->> 'yearModelUnknown')
    OR EXISTS (
      SELECT 1
      FROM public.valuation_runs vr
      WHERE vr.id = ari.valuation_run_id
        AND (
          pg_temp.aim4price_truthy(vr.valuation_payload::jsonb #>> '{input,yearModelUnknown}')
          OR pg_temp.aim4price_truthy(vr.valuation_payload::jsonb #>> '{input,year_model_unknown}')
          OR pg_temp.aim4price_truthy(vr.valuation_payload::jsonb #>> '{input,specsJson,year_model_unknown}')
          OR pg_temp.aim4price_truthy(vr.valuation_payload::jsonb #>> '{input,specsJson,yearModelUnknown}')
          OR pg_temp.aim4price_truthy(vr.specs_json::jsonb ->> 'year_model_unknown')
          OR pg_temp.aim4price_truthy(vr.specs_json::jsonb ->> 'yearModelUnknown')
        )
    )
  );

UPDATE public.asset_register_items
SET year_model = NULL,
    updated_at = COALESCE(updated_at, now())
WHERE year_model IS NOT NULL
  AND (year_model < 1800 OR year_model > 2100);

ALTER TABLE public.asset_register_items
  ADD CONSTRAINT asset_register_items_year_model_check
  CHECK (year_model IS NULL OR (year_model BETWEEN 1800 AND 2100));

COMMIT;
