ALTER TABLE public.asset_checklist_items ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE public.asset_checklist_items ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.asset_checklist_items ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS asset_checklist_source_idx ON public.asset_checklist_items(user_id,asset_id,mode,source_id);
