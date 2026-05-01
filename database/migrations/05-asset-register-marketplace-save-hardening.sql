-- Aim4price asset register + marketplace save hardening
-- Fixes generic equipment valuations failing against old tractor-only check constraints.
-- Also aligns the Asset Register and Marketplace tables for the generic valuation flow.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1) valuation_runs: allow generic / non-tractor equipment rows
-- =========================================================

ALTER TABLE IF EXISTS public.valuation_runs
  ADD COLUMN IF NOT EXISTS catalog_mode_used text,
  ADD COLUMN IF NOT EXISTS typed_model_name text,
  ADD COLUMN IF NOT EXISTS normalized_typed_model_name text,
  ADD COLUMN IF NOT EXISTS specs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS replacement_price_band_id bigint,
  ADD COLUMN IF NOT EXISTS replacement_price_min_ex_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS replacement_price_max_ex_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS replacement_price_used_ex_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS user_replacement_price_ex_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS user_replacement_price_year integer,
  ADD COLUMN IF NOT EXISTS market_match_strategy text,
  ADD COLUMN IF NOT EXISTS market_average_ex_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS market_average_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valuation_low_ex_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS valuation_mid_ex_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS valuation_high_ex_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS confidence_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS confidence_label text,
  ADD COLUMN IF NOT EXISTS depreciation_method_used text,
  ADD COLUMN IF NOT EXISTS replacement_price_basis text,
  ADD COLUMN IF NOT EXISTS life_worked_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS life_remaining_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS estimated_hours numeric(14,2),
  ADD COLUMN IF NOT EXISTS max_lifetime_hours numeric(14,2);

UPDATE public.valuation_runs
SET selected_method = 'manual'
WHERE selected_method IS NOT NULL
  AND selected_method NOT IN ('aim4price', 'market', 'manual');

UPDATE public.valuation_runs
SET
  tractor_type = NULLIF(trim(coalesce(tractor_type, '')), ''),
  drive_type = NULLIF(trim(coalesce(drive_type, '')), ''),
  cab_type = NULLIF(trim(coalesce(cab_type, '')), '')
WHERE tractor_type = '' OR drive_type = '' OR cab_type = '';

ALTER TABLE IF EXISTS public.valuation_runs
  ALTER COLUMN model_id DROP NOT NULL,
  ALTER COLUMN tractor_type DROP NOT NULL,
  ALTER COLUMN drive_type DROP NOT NULL,
  ALTER COLUMN cab_type DROP NOT NULL,
  ALTER COLUMN power_kw DROP NOT NULL,
  ALTER COLUMN hours DROP NOT NULL;

ALTER TABLE IF EXISTS public.valuation_runs DROP CONSTRAINT IF EXISTS valuation_runs_cab_type_check;
ALTER TABLE IF EXISTS public.valuation_runs DROP CONSTRAINT IF EXISTS valuation_runs_drive_type_check;
ALTER TABLE IF EXISTS public.valuation_runs DROP CONSTRAINT IF EXISTS valuation_runs_tractor_type_check;
ALTER TABLE IF EXISTS public.valuation_runs DROP CONSTRAINT IF EXISTS valuation_runs_condition_check;
ALTER TABLE IF EXISTS public.valuation_runs DROP CONSTRAINT IF EXISTS valuation_runs_selected_method_check;

ALTER TABLE public.valuation_runs
  ADD CONSTRAINT valuation_runs_cab_type_check
    CHECK (cab_type IS NULL OR cab_type IN ('cab', 'open-station')),
  ADD CONSTRAINT valuation_runs_drive_type_check
    CHECK (drive_type IS NULL OR drive_type IN ('2wd', '4wd', 'tracks')),
  ADD CONSTRAINT valuation_runs_tractor_type_check
    CHECK (tractor_type IS NULL OR tractor_type IN ('field', 'orchard')),
  ADD CONSTRAINT valuation_runs_condition_check
    CHECK (condition IS NULL OR condition IN ('excellent', 'good', 'fair', 'used', 'serious')),
  ADD CONSTRAINT valuation_runs_selected_method_check
    CHECK (selected_method IS NULL OR selected_method IN ('aim4price', 'market', 'manual'));

CREATE INDEX IF NOT EXISTS idx_valuation_runs_user_created
  ON public.valuation_runs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_valuation_runs_generic_family_brand
  ON public.valuation_runs(equipment_family_id, brand_id, normalized_typed_model_name);

-- =========================================================
-- 2) asset_register_items: support valued generic equipment + marketplace details
-- =========================================================

ALTER TABLE IF EXISTS public.asset_register_items
  ADD COLUMN IF NOT EXISTS sector_id bigint,
  ADD COLUMN IF NOT EXISTS equipment_family_id bigint,
  ADD COLUMN IF NOT EXISTS equipment_model_id bigint,
  ADD COLUMN IF NOT EXISTS catalog_mode_used text,
  ADD COLUMN IF NOT EXISTS typed_model_name text,
  ADD COLUMN IF NOT EXISTS normalized_typed_model_name text,
  ADD COLUMN IF NOT EXISTS specs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS replacement_price_band_id bigint,
  ADD COLUMN IF NOT EXISTS replacement_price_used_ex_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS user_replacement_price_ex_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS user_replacement_price_year integer,
  ADD COLUMN IF NOT EXISTS confidence_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS confidence_label text,
  ADD COLUMN IF NOT EXISTS depreciation_method_used text,
  ADD COLUMN IF NOT EXISTS replacement_price_basis text,
  ADD COLUMN IF NOT EXISTS life_worked_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS life_remaining_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS estimated_hours numeric(14,2),
  ADD COLUMN IF NOT EXISTS max_lifetime_hours numeric(14,2),
  ADD COLUMN IF NOT EXISTS seller_phone text,
  ADD COLUMN IF NOT EXISTS marketplace_notes text,
  ADD COLUMN IF NOT EXISTS marketplace_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS marketplace_price_ex_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS marketplace_seller_name text,
  ADD COLUMN IF NOT EXISTS marketplace_seller_company text,
  ADD COLUMN IF NOT EXISTS marketplace_seller_email text,
  ADD COLUMN IF NOT EXISTS marketplace_province text,
  ADD COLUMN IF NOT EXISTS marketplace_area text;

UPDATE public.asset_register_items
SET selected_method = 'manual'
WHERE selected_method IS NOT NULL
  AND selected_method NOT IN ('aim4price', 'market', 'manual');

UPDATE public.asset_register_items
SET
  kind = CASE WHEN kind = 'valued_equipment' THEN 'equipment' ELSE kind END,
  tractor_type = NULLIF(trim(coalesce(tractor_type, '')), ''),
  drive_type = NULLIF(trim(coalesce(drive_type, '')), ''),
  cab_type = NULLIF(trim(coalesce(cab_type, '')), ''),
  marketplace_status = CASE
    WHEN lower(coalesce(marketplace_status, '')) IN ('draft', 'live', 'withdrawn') THEN lower(marketplace_status)
    ELSE 'draft'
  END
WHERE kind = 'valued_equipment'
   OR tractor_type = ''
   OR drive_type = ''
   OR cab_type = ''
   OR marketplace_status IS NULL
   OR trim(marketplace_status) = '';

ALTER TABLE IF EXISTS public.asset_register_items
  ALTER COLUMN tractor_type DROP NOT NULL,
  ALTER COLUMN drive_type DROP NOT NULL,
  ALTER COLUMN cab_type DROP NOT NULL,
  ALTER COLUMN power_kw DROP NOT NULL,
  ALTER COLUMN hours DROP NOT NULL,
  ALTER COLUMN marketplace_status SET DEFAULT 'draft',
  ALTER COLUMN marketplace_status SET NOT NULL;

ALTER TABLE IF EXISTS public.asset_register_items DROP CONSTRAINT IF EXISTS asset_register_items_kind_check;
ALTER TABLE IF EXISTS public.asset_register_items DROP CONSTRAINT IF EXISTS asset_register_items_cab_type_check;
ALTER TABLE IF EXISTS public.asset_register_items DROP CONSTRAINT IF EXISTS asset_register_items_drive_type_check;
ALTER TABLE IF EXISTS public.asset_register_items DROP CONSTRAINT IF EXISTS asset_register_items_tractor_type_check;
ALTER TABLE IF EXISTS public.asset_register_items DROP CONSTRAINT IF EXISTS asset_register_items_condition_check;
ALTER TABLE IF EXISTS public.asset_register_items DROP CONSTRAINT IF EXISTS asset_register_items_selected_method_check;
ALTER TABLE IF EXISTS public.asset_register_items DROP CONSTRAINT IF EXISTS asset_register_items_marketplace_status_check;

ALTER TABLE public.asset_register_items
  ADD CONSTRAINT asset_register_items_kind_check
    CHECK (kind IN ('tractor', 'equipment', 'manual', 'property')),
  ADD CONSTRAINT asset_register_items_cab_type_check
    CHECK (cab_type IS NULL OR cab_type IN ('cab', 'open-station')),
  ADD CONSTRAINT asset_register_items_drive_type_check
    CHECK (drive_type IS NULL OR drive_type IN ('2wd', '4wd', 'tracks')),
  ADD CONSTRAINT asset_register_items_tractor_type_check
    CHECK (tractor_type IS NULL OR tractor_type IN ('field', 'orchard')),
  ADD CONSTRAINT asset_register_items_condition_check
    CHECK (condition IS NULL OR condition IN ('excellent', 'good', 'fair', 'used', 'serious')),
  ADD CONSTRAINT asset_register_items_selected_method_check
    CHECK (selected_method IS NULL OR selected_method IN ('aim4price', 'market', 'manual')),
  ADD CONSTRAINT asset_register_items_marketplace_status_check
    CHECK (marketplace_status IN ('draft', 'live', 'withdrawn'));

CREATE INDEX IF NOT EXISTS idx_asset_register_items_user_created
  ON public.asset_register_items(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_register_items_user_marketplace_status
  ON public.asset_register_items(user_id, marketplace_status);

CREATE INDEX IF NOT EXISTS idx_asset_register_items_public_asset_code
  ON public.asset_register_items(public_asset_code);

-- =========================================================
-- 3) marketplace_listings: explicit listing table for DBeaver + future marketplace v2
--    Current app still reads live listings from asset_register_items, but publishing also
--    writes a snapshot row here so the marketplace table stays useful.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  asset_register_item_id uuid,
  status text NOT NULL DEFAULT 'live',
  title text NOT NULL,
  description text,
  asking_price_ex_vat numeric(14,2) NOT NULL DEFAULT 0,
  province text,
  area text,
  seller_name text,
  seller_company text,
  seller_phone text,
  seller_email text,
  primary_image_url text,
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sector_id bigint,
  equipment_family_id bigint,
  brand_id bigint,
  equipment_model_id bigint,
  brand_name_snapshot text,
  model_name_raw text,
  normalized_model_name text,
  specs_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE IF EXISTS public.marketplace_listings
  ADD COLUMN IF NOT EXISTS asset_register_item_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS asking_price_ex_vat numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS seller_company text,
  ADD COLUMN IF NOT EXISTS seller_phone text,
  ADD COLUMN IF NOT EXISTS seller_email text,
  ADD COLUMN IF NOT EXISTS primary_image_url text,
  ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS sector_id bigint,
  ADD COLUMN IF NOT EXISTS equipment_family_id bigint,
  ADD COLUMN IF NOT EXISTS brand_id bigint,
  ADD COLUMN IF NOT EXISTS equipment_model_id bigint,
  ADD COLUMN IF NOT EXISTS brand_name_snapshot text,
  ADD COLUMN IF NOT EXISTS model_name_raw text,
  ADD COLUMN IF NOT EXISTS normalized_model_name text,
  ADD COLUMN IF NOT EXISTS specs_json jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.marketplace_listings
SET
  status = CASE
    WHEN lower(coalesce(status, '')) IN ('draft', 'live', 'withdrawn') THEN lower(status)
    ELSE 'live'
  END,
  title = coalesce(nullif(trim(title), ''), 'Aim4price listing'),
  asking_price_ex_vat = coalesce(asking_price_ex_vat, 0),
  image_urls = coalesce(image_urls, '[]'::jsonb),
  specs_json = coalesce(specs_json, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

ALTER TABLE IF EXISTS public.marketplace_listings
  ALTER COLUMN status SET DEFAULT 'live',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN asking_price_ex_vat SET DEFAULT 0,
  ALTER COLUMN asking_price_ex_vat SET NOT NULL,
  ALTER COLUMN image_urls SET DEFAULT '[]'::jsonb,
  ALTER COLUMN image_urls SET NOT NULL,
  ALTER COLUMN specs_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN specs_json SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE IF EXISTS public.marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_listings_status_check;

ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_status_check
    CHECK (status IN ('draft', 'live', 'withdrawn'));

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_asset_status
  ON public.marketplace_listings(asset_register_item_id, status);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_user_status
  ON public.marketplace_listings(user_id, status);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status_updated
  ON public.marketplace_listings(status, updated_at DESC);

COMMIT;
