-- Aim4price valuation usability hardening
-- Fixes model candidate upserts on deployed databases where the ON CONFLICT target
-- was missing the matching unique/exclusion constraint.

DO $$
BEGIN
  IF to_regclass('public.model_candidates') IS NOT NULL THEN
    WITH ranked AS (
      SELECT
        ctid,
        row_number() OVER (
          PARTITION BY equipment_family_id, brand_id, normalized_model_name
          ORDER BY
            coalesce(occurrence_count, 0) DESC,
            coalesce(updated_at, created_at, last_seen_at, first_seen_at, now()) DESC,
            ctid
        ) AS duplicate_rank
      FROM public.model_candidates
      WHERE normalized_model_name IS NOT NULL
        AND normalized_model_name <> ''
    )
    DELETE FROM public.model_candidates mc
    USING ranked
    WHERE mc.ctid = ranked.ctid
      AND ranked.duplicate_rank > 1;

    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS model_candidates_family_brand_model_uidx
      ON public.model_candidates (equipment_family_id, brand_id, normalized_model_name)
    ';
  END IF;
END $$;
