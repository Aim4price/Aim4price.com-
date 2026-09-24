CREATE TABLE IF NOT EXISTS asset_share_submissions (
 id uuid PRIMARY KEY, token text NOT NULL REFERENCES asset_share_links(token) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('invoice','quote')), sender_name text NOT NULL,
 sender_contact text NOT NULL, note text NOT NULL DEFAULT '', file_name text NOT NULL,
 content_type text NOT NULL, file_data bytea NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS asset_share_submissions_token ON asset_share_submissions(token);
CREATE INDEX IF NOT EXISTS asset_share_recipient_email ON asset_share_links (lower(lead_details->>'recipientEmail')) WHERE revoked_at IS NULL;
