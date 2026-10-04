CREATE TABLE IF NOT EXISTS asset_replacement_notifications(correction_id uuid PRIMARY KEY,attempted_at timestamptz,sent_at timestamptz,error text);
DO $$ BEGIN IF to_regclass('public.shared_asset_activity') IS NOT NULL THEN
 ALTER TABLE shared_asset_activity ADD COLUMN IF NOT EXISTS transaction_id bigint;
 ALTER TABLE shared_asset_activity ALTER COLUMN transaction_id SET DEFAULT txid_current();
END IF; END $$;
