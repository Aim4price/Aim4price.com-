ALTER TABLE public.dealer_maintenance_access
  ADD COLUMN IF NOT EXISTS can_add_documents boolean NOT NULL DEFAULT false;
