-- Per-dealer Maintenance Tracker permissions.
--
-- Existing tracker access already allowed serial-number and replacement-price
-- correction requests, so those permissions are retained for existing rows.
-- Logged problems and maintenance reports are opt-in and remain disabled until
-- the owner or an authorised Field Manager enables them.

ALTER TABLE public.dealer_maintenance_access
  ADD COLUMN IF NOT EXISTS can_view_logged_problems boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_maintenance_reports boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_update_serial boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_update_replacement_price boolean NOT NULL DEFAULT true;

