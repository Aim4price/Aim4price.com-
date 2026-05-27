-- Adds explicit replacement-price storage for manual Asset Register add/update flows.
-- Safe to run more than once.

ALTER TABLE IF EXISTS public.asset_register_items
  ADD COLUMN IF NOT EXISTS replacement_price_used_ex_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS user_replacement_price_ex_vat numeric(14,2),
  ADD COLUMN IF NOT EXISTS replacement_price_basis text;

COMMENT ON COLUMN public.asset_register_items.replacement_price_used_ex_vat IS 'VAT-exclusive replacement price used as the official new/replacement value for the asset.';
COMMENT ON COLUMN public.asset_register_items.user_replacement_price_ex_vat IS 'VAT-exclusive replacement price entered by the user in the Asset Register modal.';
COMMENT ON COLUMN public.asset_register_items.replacement_price_basis IS 'Basis for the replacement price. Manual Asset Register entries use user.';

UPDATE public.asset_register_items
SET
  replacement_price_used_ex_vat = COALESCE(
    replacement_price_used_ex_vat,
    user_replacement_price_ex_vat,
    NULLIF(regexp_replace(COALESCE(specs_json ->> 'replacement_price_used_ex_vat', ''), '[^0-9.-]', '', 'g'), '')::numeric,
    NULLIF(regexp_replace(COALESCE(specs_json ->> 'replacementPriceUsedExVat', ''), '[^0-9.-]', '', 'g'), '')::numeric,
    NULLIF(regexp_replace(COALESCE(specs_json ->> 'replacement_price_ex_vat', ''), '[^0-9.-]', '', 'g'), '')::numeric,
    NULLIF(regexp_replace(COALESCE(specs_json ->> 'replacementPriceExVat', ''), '[^0-9.-]', '', 'g'), '')::numeric,
    NULLIF(regexp_replace(COALESCE(specs_json ->> 'replacement_price', ''), '[^0-9.-]', '', 'g'), '')::numeric,
    NULLIF(regexp_replace(COALESCE(specs_json ->> 'replacementPrice', ''), '[^0-9.-]', '', 'g'), '')::numeric
  ),
  user_replacement_price_ex_vat = COALESCE(
    user_replacement_price_ex_vat,
    NULLIF(regexp_replace(COALESCE(specs_json ->> 'user_replacement_price_ex_vat', ''), '[^0-9.-]', '', 'g'), '')::numeric,
    NULLIF(regexp_replace(COALESCE(specs_json ->> 'userReplacementPriceExVat', ''), '[^0-9.-]', '', 'g'), '')::numeric
  ),
  replacement_price_basis = COALESCE(
    NULLIF(replacement_price_basis, ''),
    NULLIF(specs_json ->> 'replacement_price_basis', ''),
    NULLIF(specs_json ->> 'replacementPriceBasis', ''),
    CASE
      WHEN user_replacement_price_ex_vat IS NOT NULL
        OR NULLIF(specs_json ->> 'user_replacement_price_ex_vat', '') IS NOT NULL
        OR NULLIF(specs_json ->> 'userReplacementPriceExVat', '') IS NOT NULL
      THEN 'user'
      ELSE NULL
    END
  )
WHERE specs_json IS NOT NULL;
