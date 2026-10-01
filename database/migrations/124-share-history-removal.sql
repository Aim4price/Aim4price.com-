-- Owners can remove revoked links from History without deleting access/audit records.
ALTER TABLE public.asset_share_links ADD COLUMN IF NOT EXISTS history_deleted_at timestamptz;
