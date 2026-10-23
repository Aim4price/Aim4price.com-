-- Reversible owner-managed corrections; private snapshots never leave the server.
CREATE TABLE IF NOT EXISTS public.asset_history_corrections (
 id uuid PRIMARY KEY, owner_id text NOT NULL, asset_id uuid NOT NULL,
 record_table text NOT NULL, record_id text NOT NULL, title text NOT NULL,
 state text NOT NULL CHECK (state IN ('retracted','restored')), changes jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS asset_history_correction_record ON public.asset_history_corrections(owner_id,asset_id,record_table,record_id,created_at DESC);
CREATE INDEX IF NOT EXISTS asset_history_record_recent ON public.asset_history_events(owner_id,asset_id,record_table,record_id,created_at DESC,id DESC);
