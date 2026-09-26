-- Links created without a recipient stay locked until the owner approves one account.
CREATE TABLE IF NOT EXISTS asset_share_access_requests (
 token text NOT NULL REFERENCES asset_share_links(token) ON DELETE CASCADE,
 user_id text NOT NULL, email text NOT NULL, business_name text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
 PRIMARY KEY(token,user_id)
);
