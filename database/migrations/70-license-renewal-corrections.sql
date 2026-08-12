-- Licence experts can propose a new renewal date. The owner must accept it
-- before the Asset Register is updated.

ALTER TABLE public.dealer_asset_correction_requests
  ADD COLUMN IF NOT EXISTS current_license_renewal_date date,
  ADD COLUMN IF NOT EXISTS proposed_license_renewal_date date,
  ADD COLUMN IF NOT EXISTS license_renewal_date_changed boolean NOT NULL DEFAULT false;

ALTER TABLE public.dealer_asset_correction_requests
  DROP CONSTRAINT IF EXISTS dealer_asset_correction_requests_check,
  DROP CONSTRAINT IF EXISTS dealer_asset_correction_single_field_check;

ALTER TABLE public.dealer_asset_correction_requests
  ADD CONSTRAINT dealer_asset_correction_single_field_check
  CHECK (
    serial_number_changed::int
    + replacement_price_changed::int
    + license_renewal_date_changed::int = 1
  ) NOT VALID;

COMMENT ON COLUMN public.dealer_asset_correction_requests.proposed_license_renewal_date IS
  'Renewal date proposed by the licence expert and applied only after owner approval.';
