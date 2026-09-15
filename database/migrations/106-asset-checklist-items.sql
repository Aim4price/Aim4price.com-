CREATE TABLE IF NOT EXISTS public.asset_checklist_items (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  asset_id uuid NOT NULL REFERENCES public.asset_register_items(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('checked', 'serviced', 'repaired')),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asset_checklist_items_owner_asset_idx
  ON public.asset_checklist_items (user_id, asset_id);
