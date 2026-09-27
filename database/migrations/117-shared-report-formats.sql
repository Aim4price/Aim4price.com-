ALTER TABLE asset_share_reports ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'application/pdf';
