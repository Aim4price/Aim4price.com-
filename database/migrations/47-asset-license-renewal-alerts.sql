-- Adds durable acknowledgement fields for per-asset license renewal alerts.

ALTER TABLE public.asset_register_items
  ADD COLUMN IF NOT EXISTS license_renewal_alert_noted_for_date date,
  ADD COLUMN IF NOT EXISTS license_renewal_alert_noted_at timestamptz;

COMMENT ON COLUMN public.asset_register_items.license_renewal_alert_noted_for_date IS
  'The exact saved license renewal date whose reminder the owner has marked as noted.';

COMMENT ON COLUMN public.asset_register_items.license_renewal_alert_noted_at IS
  'When the owner most recently marked a license renewal reminder as noted.';
