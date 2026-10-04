-- Keep the professional's explanation alongside the replacement-price proposal.
ALTER TABLE public.dealer_asset_correction_requests ADD COLUMN IF NOT EXISTS reason text;
