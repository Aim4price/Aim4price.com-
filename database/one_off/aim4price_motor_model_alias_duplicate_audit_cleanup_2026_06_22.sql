/*
Aim4price Motor model/alias duplicate audit + safe alias cleanup
Generated: 2026-06-22

Purpose:
1) Remove only impossible/accidental duplicate alias rows where the same model has the same normalized alias more than once.
2) Audit visible duplicate model labels in Motor without deleting any model rows.

This script is intentionally conservative:
- It does NOT delete equipment_models rows.
- It does NOT delete replacement_price_bands rows.
- It does NOT change prices or exact model keys.
- Duplicate-looking model names are often real variants/body types and should be resolved in the UI with subtext.
*/

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('aim4price_motor_alias_duplicate_audit_cleanup_2026_06_22'));

-- Keep the normalizer aligned with earlier import scripts.
CREATE OR REPLACE FUNCTION public.aim4price_normalize_key(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '', 'g')
$$;

-- 1) Before: exact duplicate alias rows. Normally this should already be zero because of your unique constraint.
SELECT
  '01_alias_duplicates_before' AS check_name,
  count(*) AS duplicate_alias_groups
FROM (
  SELECT equipment_model_id, normalized_alias
  FROM public.equipment_model_aliases
  GROUP BY equipment_model_id, normalized_alias
  HAVING count(*) > 1
) d;

-- 2) Delete only exact duplicate alias rows for the same model and same normalized alias.
WITH ranked_aliases AS (
  SELECT
    ctid,
    equipment_model_id,
    normalized_alias,
    row_number() OVER (
      PARTITION BY equipment_model_id, normalized_alias
      ORDER BY created_at ASC NULLS LAST, ctid ASC
    ) AS rn
  FROM public.equipment_model_aliases
  WHERE trim(coalesce(normalized_alias, '')) <> ''
)
DELETE FROM public.equipment_model_aliases a
USING ranked_aliases r
WHERE a.ctid = r.ctid
  AND r.rn > 1;

-- 3) Remove blank aliases. These cannot help search.
DELETE FROM public.equipment_model_aliases
WHERE trim(coalesce(alias_text, '')) = ''
   OR trim(coalesce(normalized_alias, '')) = '';

-- 4) After: exact duplicate alias rows.
SELECT
  '02_alias_duplicates_after' AS check_name,
  count(*) AS duplicate_alias_groups
FROM (
  SELECT equipment_model_id, normalized_alias
  FROM public.equipment_model_aliases
  GROUP BY equipment_model_id, normalized_alias
  HAVING count(*) > 1
) d;

-- 5) Audit visible duplicate model labels in Motor.
-- These are not necessarily bad data. In Motor, many duplicates are real variants/body types with the same headline model name.
SELECT
  '03_visible_duplicate_model_labels' AS check_name,
  ef.family_key,
  ef.family_label,
  b.name AS brand_name,
  em.display_name,
  count(*) AS duplicate_rows,
  string_agg(DISTINCT coalesce(nullif(em.variant_name, ''), '-'), ', ' ORDER BY coalesce(nullif(em.variant_name, ''), '-')) AS variants,
  string_agg(DISTINCT coalesce(nullif(em.specs_json ->> 'aim4_source_body_type', ''), nullif(em.specs_json ->> 'body_type', ''), '-'), ', ' ORDER BY coalesce(nullif(em.specs_json ->> 'aim4_source_body_type', ''), nullif(em.specs_json ->> 'body_type', ''), '-')) AS body_or_source_types,
  min(em.aim4price_replacement_price_ex_vat) AS min_price_ex_vat,
  max(em.aim4price_replacement_price_ex_vat) AS max_price_ex_vat
FROM public.equipment_models em
JOIN public.equipment_families ef ON ef.id = em.equipment_family_id
JOIN public.sectors s ON s.id = ef.sector_id
LEFT JOIN public.brands b ON b.id = em.brand_id
WHERE s.sector_key = 'motor'
  AND coalesce(em.is_generic_fallback, false) = false
  AND coalesce(em.is_active, true) = true
GROUP BY ef.family_key, ef.family_label, b.name, em.display_name
HAVING count(*) > 1
ORDER BY duplicate_rows DESC, ef.family_key, b.name, em.display_name
LIMIT 250;

-- 6) Audit exact key duplicates. This should be zero. If not zero, stop and investigate before deleting anything.
SELECT
  '04_exact_model_key_duplicates' AS check_name,
  em.specs_json ->> 'aim4_model_key' AS aim4_model_key,
  count(*) AS rows_with_same_key
FROM public.equipment_models em
JOIN public.equipment_families ef ON ef.id = em.equipment_family_id
JOIN public.sectors s ON s.id = ef.sector_id
WHERE s.sector_key = 'motor'
  AND coalesce(em.specs_json ->> 'aim4_model_key', '') <> ''
GROUP BY em.specs_json ->> 'aim4_model_key'
HAVING count(*) > 1
ORDER BY rows_with_same_key DESC, aim4_model_key;

COMMIT;
