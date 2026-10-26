export const PARTS_NETWORK_SCHEMA = `
CREATE TABLE IF NOT EXISTS parts_networks (
 id uuid PRIMARY KEY, name text NOT NULL, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE parts_networks ADD COLUMN IF NOT EXISTS list_mode boolean NOT NULL DEFAULT false;
ALTER TABLE parts_networks ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS parts_network_members (
 network_id uuid NOT NULL REFERENCES parts_networks(id), dealer_id text NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','contributor','viewer')),
 status text NOT NULL CHECK(status IN ('pending','active','suspended')),
 business_name text NOT NULL DEFAULT '', town text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
 visible boolean NOT NULL DEFAULT true, revision integer NOT NULL DEFAULT 0,
 vat_included boolean NOT NULL DEFAULT false, uploaded_at timestamptz, approved_by text,
 PRIMARY KEY(network_id,dealer_id)
);
CREATE TABLE IF NOT EXISTS parts_network_rows (
 network_id uuid NOT NULL, dealer_id text NOT NULL, part_number text NOT NULL, part_key text NOT NULL,
 quantity integer NOT NULL CHECK(quantity>=0), price numeric(14,2) NOT NULL CHECK(price>=0),
 PRIMARY KEY(network_id,dealer_id,part_key),
 FOREIGN KEY(network_id,dealer_id) REFERENCES parts_network_members(network_id,dealer_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS parts_network_search ON parts_network_rows(network_id,part_key);
CREATE TABLE IF NOT EXISTS parts_network_invites (
 id uuid PRIMARY KEY, network_id uuid NOT NULL REFERENCES parts_networks(id), email text NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','contributor','viewer')), token_hash text UNIQUE NOT NULL,
 created_by text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz, revoked_at timestamptz,
 pin_hash text, pin_expires_at timestamptz, pin_sent_at timestamptz, pin_sends integer NOT NULL DEFAULT 0,
 attempts integer NOT NULL DEFAULT 0
);
ALTER TABLE parts_network_invites ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'link';
CREATE TABLE IF NOT EXISTS parts_enquiries (
 id uuid PRIMARY KEY, network_id uuid NOT NULL REFERENCES parts_networks(id),
 sender_id text NOT NULL, recipient_id text NOT NULL, part_number text NOT NULL,
 message text NOT NULL, reply_email text NOT NULL, status text NOT NULL DEFAULT 'new',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parts_enquiries_recipient ON parts_enquiries(recipient_id,created_at);
CREATE TABLE IF NOT EXISTS parts_network_audit (
 id uuid PRIMARY KEY, network_id uuid NOT NULL REFERENCES parts_networks(id), actor_id text NOT NULL,
 action text NOT NULL, target text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);`;
