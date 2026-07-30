-- Cost of Ownership remains owner-controlled for each active dealer share.
-- Existing shares stay disabled until the owner explicitly grants access.

ALTER TABLE public.dealer_maintenance_access
  ADD COLUMN IF NOT EXISTS can_view_cost_of_ownership boolean NOT NULL DEFAULT false;
