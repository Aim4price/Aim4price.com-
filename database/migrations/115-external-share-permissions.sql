-- Per-link permissions are stored with the existing lead_details JSON.
-- Historical documents remain readable by their owner; all new uploads require a verified recipient.
ALTER TABLE public.asset_share_submissions ADD COLUMN IF NOT EXISTS actor_user_id text;
ALTER TABLE public.dealer_asset_correction_requests DROP CONSTRAINT IF EXISTS dealer_asset_correction_requests_source_type_check;
ALTER TABLE public.dealer_asset_correction_requests ADD CONSTRAINT dealer_asset_correction_requests_source_type_check CHECK (source_type IN ('lead','maintenance','external'));
