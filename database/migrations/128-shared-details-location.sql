ALTER TABLE public.dealer_maintenance_access
  ADD COLUMN IF NOT EXISTS can_update_details boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_access_location boolean NOT NULL DEFAULT false;
