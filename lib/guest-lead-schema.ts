import { getDb } from './db';
import { ensureAssetShareSchema } from './asset-share-links';
import { ensureBusinessNetwork } from './business-network';
export const GUEST_LEAD_SCHEMA = `
CREATE TABLE IF NOT EXISTS business_acceptances (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, business_name text NOT NULL,
 contact_name text NOT NULL, phone text NOT NULL DEFAULT '', accepted_at timestamptz NOT NULL DEFAULT now(),
 consent_version text NOT NULL DEFAULT 'directory-v1', handled_at timestamptz
);
CREATE TABLE IF NOT EXISTS guest_businesses (
 email text PRIMARY KEY, business_name text NOT NULL, contact_name text NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now(), access_until timestamptz, suspended boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS guest_login_codes (
 email text PRIMARY KEY, code_hash text NOT NULL, profile jsonb NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS guest_business_sessions (
 token_hash text PRIMARY KEY, email text NOT NULL REFERENCES guest_businesses(email) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS guest_access_actions (
 id uuid PRIMARY KEY, email text NOT NULL, admin_id text NOT NULL, action text NOT NULL,
 access_until timestamptz, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE asset_share_links ADD COLUMN IF NOT EXISTS lead_details jsonb;
CREATE TABLE IF NOT EXISTS asset_share_reports (
 id uuid PRIMARY KEY, token text NOT NULL REFERENCES asset_share_links(token) ON DELETE CASCADE,
 label text NOT NULL, file_name text NOT NULL, pdf bytea NOT NULL
);
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
CREATE INDEX IF NOT EXISTS asset_share_reports_token ON asset_share_reports(token);
`;
let ready: Promise<void> | undefined;
export function ensureGuestLeadSchema() {
 if (!ready) ready = (async () => { await ensureAssetShareSchema(); await ensureBusinessNetwork(); await getDb().query(GUEST_LEAD_SCHEMA); })().catch(error => { ready = undefined; throw error; });
 return ready;
}
