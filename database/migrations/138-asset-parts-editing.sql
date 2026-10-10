ALTER TABLE public.asset_parts ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.asset_part_choices (
  owner_id text NOT NULL,
  asset_id uuid NOT NULL REFERENCES public.asset_register_items(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  label text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  PRIMARY KEY (owner_id, asset_id, item_key)
);
