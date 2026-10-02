ALTER TABLE public.dealer_maintenance_access
  ADD COLUMN IF NOT EXISTS can_add_photos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_add_costs boolean NOT NULL DEFAULT false;
