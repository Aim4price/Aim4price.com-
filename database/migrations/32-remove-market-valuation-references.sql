-- Aim4price migration 32 - v2 safe version
-- Retires external market-evidence valuation selections while preserving the Aim4price Marketplace selling/listing feature.
-- This migration does not alter public.marketplace_listings or any user-owned marketplace data.
--
-- Use this v2 file if the first version failed because older databases may not have every valuation column yet.

BEGIN;

-- 1) Convert old valuation-run market selections to Aim4price selections.
--    Uses dynamic SQL so the migration does not fail if older databases are missing optional value columns.
DO $$
DECLARE
  value_expression text;
  set_clause text;
BEGIN
  IF to_regclass('public.valuation_runs') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'valuation_runs'
         AND column_name = 'selected_method'
     ) THEN

    value_expression := NULL;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'valuation_runs' AND column_name = 'valuation_mid_ex_vat'
    ) THEN
      value_expression := 'valuation_mid_ex_vat';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'valuation_runs' AND column_name = 'aim4price_value_ex_vat'
    ) THEN
      value_expression := CASE
        WHEN value_expression IS NULL THEN 'aim4price_value_ex_vat'
        ELSE value_expression || ', aim4price_value_ex_vat'
      END;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'valuation_runs' AND column_name = 'aim4price_value'
    ) THEN
      value_expression := CASE
        WHEN value_expression IS NULL THEN 'aim4price_value'
        ELSE value_expression || ', aim4price_value'
      END;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'valuation_runs' AND column_name = 'selected_value_ex_vat'
    ) THEN
      value_expression := CASE
        WHEN value_expression IS NULL THEN 'selected_value_ex_vat'
        ELSE value_expression || ', selected_value_ex_vat'
      END;
      set_clause := format('selected_method = %L, selected_value_ex_vat = COALESCE(%s)', 'aim4price', value_expression);
    ELSE
      set_clause := format('selected_method = %L', 'aim4price');
    END IF;

    EXECUTE format('UPDATE public.valuation_runs SET %s WHERE selected_method = %L', set_clause, 'market');

    -- Make the new check constraint safe by normalising any other legacy selected methods too.
    EXECUTE 'UPDATE public.valuation_runs SET selected_method = ''aim4price'' WHERE selected_method IS NOT NULL AND selected_method NOT IN (''aim4price'', ''manual'')';
  END IF;
END $$;

-- 2) Convert old Asset Register market selections to Aim4price selections and preserve the best Aim4price amount available.
DO $$
DECLARE
  value_expression text;
  set_parts text[] := ARRAY[]::text[];
  set_clause text;
BEGIN
  IF to_regclass('public.asset_register_items') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'asset_register_items'
         AND column_name = 'selected_method'
     ) THEN

    value_expression := NULL;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'asset_register_items' AND column_name = 'aim4price_value_ex_vat'
    ) THEN
      value_expression := 'aim4price_value_ex_vat';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'asset_register_items' AND column_name = 'aim4price_value'
    ) THEN
      value_expression := 'aim4price_value';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'asset_register_items' AND column_name = 'selected_value_ex_vat'
    ) THEN
      value_expression := CASE
        WHEN value_expression IS NULL THEN 'selected_value_ex_vat'
        ELSE value_expression || ', selected_value_ex_vat'
      END;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'asset_register_items' AND column_name = 'value'
    ) THEN
      value_expression := CASE
        WHEN value_expression IS NULL THEN 'value'
        ELSE value_expression || ', value'
      END;
    END IF;

    set_parts := array_append(set_parts, format('selected_method = %L', 'aim4price'));

    IF value_expression IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'asset_register_items' AND column_name = 'value'
      ) THEN
        set_parts := array_append(set_parts, format('value = COALESCE(%s)', value_expression));
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'asset_register_items' AND column_name = 'selected_value_ex_vat'
      ) THEN
        set_parts := array_append(set_parts, format('selected_value_ex_vat = COALESCE(%s)', value_expression));
      END IF;
    END IF;

    set_clause := array_to_string(set_parts, ', ');
    EXECUTE format('UPDATE public.asset_register_items SET %s WHERE selected_method = %L', set_clause, 'market');

    -- Make the new check constraint safe by normalising any other legacy selected methods too.
    EXECUTE 'UPDATE public.asset_register_items SET selected_method = ''aim4price'' WHERE selected_method IS NOT NULL AND selected_method NOT IN (''aim4price'', ''manual'')';
  END IF;
END $$;

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

      BEGIN
        EXECUTE format('UPDATE public.%I SET %I = %s', target_table, target_column, reset_expression);
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not reset %.%: %', target_table, target_column, SQLERRM;
      END;
    END LOOP;
  END LOOP;
END $$;

-- 4) Remove retired market-adjustment metadata from saved Asset Register specs.
DO $$
DECLARE
  specs_data_type text;
BEGIN
  SELECT data_type
  INTO specs_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'asset_register_items'
    AND column_name = 'specs_json';

  IF specs_data_type = 'jsonb' THEN
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
  ELSIF specs_data_type = 'json' THEN
    UPDATE public.asset_register_items
    SET specs_json = (
      COALESCE(specs_json::jsonb, '{}'::jsonb)
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
      - 'market_adjustment_raw_market_ex_vat'
    )::json;
  END IF;
END $$;

-- 5) Replace selected_method check constraints so only Aim4price and Manual remain valid.
DO $$
DECLARE
  target_table text;
  constraint_record record;
  constraint_name text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['valuation_runs', 'asset_register_items'] LOOP
    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target_table
        AND column_name = 'selected_method'
    ) THEN
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

    constraint_name := CASE
      WHEN target_table = 'valuation_runs' THEN 'valuation_runs_selected_method_check'
      ELSE 'asset_register_items_selected_method_check'
    END;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (selected_method IS NULL OR selected_method IN (%L, %L))',
      target_table,
      constraint_name,
      'aim4price',
      'manual'
    );
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
