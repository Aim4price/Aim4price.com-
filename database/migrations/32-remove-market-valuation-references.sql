-- Aim4price migration 32
-- Retires external market-evidence valuation selections while preserving the Aim4price Marketplace selling/listing feature.
-- This migration does not alter public.marketplace_listings or any user-owned marketplace data.

BEGIN;

-- 1) Convert old valuation-run market selections to Aim4price selections.
UPDATE public.valuation_runs
SET
  selected_method = 'aim4price',
  selected_value_ex_vat = COALESCE(valuation_mid_ex_vat, aim4price_value_ex_vat, selected_value_ex_vat)
WHERE selected_method = 'market';

-- 2) Convert old Asset Register market selections to Aim4price selections and preserve the best Aim4price amount available.
UPDATE public.asset_register_items
SET
  selected_method = 'aim4price',
  value = COALESCE(aim4price_value_ex_vat, selected_value_ex_vat, value),
  selected_value_ex_vat = COALESCE(aim4price_value_ex_vat, selected_value_ex_vat, value)
WHERE selected_method = 'market';

-- 3) Reset retired market-only columns where they exist.
DO $$
DECLARE
  target_table text;
  target_column text;
  column_data_type text;
  reset_expression text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['valuation_runs', 'asset_register_items'] LOOP
    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      CONTINUE;
    END IF;

    FOREACH target_column IN ARRAY ARRAY[
      'market_low_ex_vat',
      'market_mid_ex_vat',
      'market_high_ex_vat',
      'market_count',
      'market_listing_ids',
      'market_match_strategy',
      'market_average_ex_vat',
      'market_average_count'
    ] LOOP
      SELECT data_type
      INTO column_data_type
      FROM information_schema.columns AS columns
      WHERE table_schema = 'public'
        AND table_name = target_table
        AND columns.column_name = target_column;

      IF column_data_type IS NULL THEN
        CONTINUE;
      END IF;

      reset_expression := 'NULL';

      IF target_column IN ('market_count', 'market_average_count') THEN
        reset_expression := '0';
      ELSIF target_column = 'market_match_strategy' THEN
        reset_expression := '''none''';
      ELSIF target_column = 'market_listing_ids' THEN
        IF column_data_type = 'jsonb' THEN
          reset_expression := '''[]''::jsonb';
        ELSIF column_data_type = 'json' THEN
          reset_expression := '''[]''::json';
        ELSIF column_data_type = 'ARRAY' THEN
          reset_expression := '''{}''';
        ELSE
          reset_expression := 'NULL';
        END IF;
      END IF;

      EXECUTE format('UPDATE public.%I SET %I = %s', target_table, target_column, reset_expression);
    END LOOP;
  END LOOP;
END $$;

-- 4) Remove retired market-adjustment metadata from saved Asset Register specs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'asset_register_items'
      AND column_name = 'specs_json'
  ) THEN
    UPDATE public.asset_register_items
    SET specs_json = COALESCE(specs_json, '{}'::jsonb)
      - 'marketValueMode'
      - 'market_value_mode'
      - 'marketValueIsAim4priceDelta'
      - 'market_value_is_aim4price_delta'
      - 'marketAim4priceDeltaExVat'
      - 'market_aim4price_delta_ex_vat'
      - 'marketAdjustmentExVat'
      - 'market_adjustment_ex_vat'
      - 'marketAdjustmentBaseAim4priceExVat'
      - 'market_adjustment_base_aim4price_ex_vat'
      - 'marketAdjustmentBaseMarketExVat'
      - 'market_adjustment_base_market_ex_vat'
      - 'marketAdjustmentRawMarketExVat'
      - 'market_adjustment_raw_market_ex_vat';
  END IF;
END $$;

-- 5) Replace selected_method check constraints so only Aim4price and Manual remain valid.
DO $$
DECLARE
  target_table text;
  constraint_record record;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['valuation_runs', 'asset_register_items'] LOOP
    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      CONTINUE;
    END IF;

    FOR constraint_record IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = target_table
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%selected_method%'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', target_table, constraint_record.conname);
    END LOOP;

    IF target_table = 'valuation_runs' THEN
      ALTER TABLE public.valuation_runs
        ADD CONSTRAINT valuation_runs_selected_method_check
        CHECK (selected_method IS NULL OR selected_method IN ('aim4price', 'manual'));
    ELSE
      ALTER TABLE public.asset_register_items
        ADD CONSTRAINT asset_register_items_selected_method_check
        CHECK (selected_method IS NULL OR selected_method IN ('aim4price', 'manual'));
    END IF;
  END LOOP;
END $$;

-- 6) Verification checks. Both results should be 0.
SELECT
  'valuation_runs_selected_method_market_count' AS check_name,
  COUNT(*)::bigint AS result
FROM public.valuation_runs
WHERE selected_method = 'market';

SELECT
  'asset_register_items_selected_method_market_count' AS check_name,
  COUNT(*)::bigint AS result
FROM public.asset_register_items
WHERE selected_method = 'market';

COMMIT;
