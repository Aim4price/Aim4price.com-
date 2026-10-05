-- Existing shares stay private until the owner explicitly enables history.
ALTER TABLE public.dealer_maintenance_access
  ADD COLUMN IF NOT EXISTS can_view_history boolean NOT NULL DEFAULT false;
