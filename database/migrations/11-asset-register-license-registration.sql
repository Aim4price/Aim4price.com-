-- Adds optional numberplate / registration detail for licensed assets.
-- Safe to run more than once.

ALTER TABLE IF EXISTS public.asset_register_items
  ADD COLUMN IF NOT EXISTS license_registration_number text;

COMMENT ON COLUMN public.asset_register_items.license_registration_number IS
  'Optional numberplate or road registration number shown when an asset is marked as licensed.';

UPDATE public.asset_register_items
SET license_registration_number = NULLIF(
  trim(
    coalesce(
      specs_json->>'licenseRegistrationNumber',
      specs_json->>'license_registration_number',
      specs_json->>'licenceRegistrationNumber',
      specs_json->>'licence_registration_number',
      specs_json->>'licenseRegistration',
      specs_json->>'license_registration',
      specs_json->>'licenceRegistration',
      specs_json->>'licence_registration',
      specs_json->>'registrationNumber',
      specs_json->>'registration_number',
      specs_json->>'numberPlate',
      specs_json->>'number_plate',
      specs_json->>'numberplate',
      ''
    )
  ),
  ''
)
WHERE license_registration_number IS NULL
  AND specs_json IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asset_register_items_license_registration_number
  ON public.asset_register_items(user_id, license_registration_number);
