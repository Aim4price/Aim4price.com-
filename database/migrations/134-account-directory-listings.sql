-- Optional account-owned directory entries; publication uses the existing admin queue.
CREATE TABLE IF NOT EXISTS account_directory_listings (
 user_id text PRIMARY KEY,
 business_id uuid NOT NULL UNIQUE REFERENCES business_network(id),
 logo_data text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);
