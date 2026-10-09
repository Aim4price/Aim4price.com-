-- Separate view/add grants; existing recipients gain no new access automatically.
ALTER TABLE public.dealer_maintenance_access
  ADD COLUMN IF NOT EXISTS can_view_parts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_add_parts boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.asset_parts (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  asset_id uuid NOT NULL REFERENCES public.asset_register_items(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_label text NOT NULL,
  name text NOT NULL,
  part_number text NOT NULL,
  brand text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  maintenance_id uuid REFERENCES public.asset_maintenance_records(id) ON DELETE SET NULL,
  actor_id text NOT NULL,
  added_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asset_parts_asset_idx ON public.asset_parts(owner_id, asset_id, created_at);
