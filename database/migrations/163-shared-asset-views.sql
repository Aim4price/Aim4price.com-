CREATE TABLE IF NOT EXISTS shared_asset_views (
 account_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 token text NOT NULL REFERENCES asset_share_links(token) ON DELETE CASCADE,
 asset_id uuid NOT NULL,
 PRIMARY KEY(account_id, token, asset_id)
);
