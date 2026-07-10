-- Stores a Field Manager's personal Overview dismissals without changing the
-- owner's maintenance, problem-note, or licence-renewal source records.

CREATE TABLE IF NOT EXISTS public.field_manager_overview_dismissals (
  field_manager_id uuid NOT NULL
    REFERENCES public.field_managers(id) ON DELETE CASCADE,
  source_kind text NOT NULL
    CHECK (source_kind IN ('maintenance', 'problem', 'license')),
  source_id text NOT NULL,
  overview_item_id text NOT NULL,
  asset_register_item_id uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (field_manager_id, source_kind, source_id)
);

CREATE INDEX IF NOT EXISTS idx_field_manager_overview_dismissals_asset
  ON public.field_manager_overview_dismissals(asset_register_item_id);

COMMENT ON TABLE public.field_manager_overview_dismissals IS
  'Per-Field-Manager Overview items hidden with Clear; source records remain unchanged.';
