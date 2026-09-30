-- Phase 1: additive identity foundation; existing asset ownership is unchanged.
BEGIN;

CREATE TABLE IF NOT EXISTS business_workspaces (
 id uuid PRIMARY KEY,
 owner_user_id text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS business_workspace_members (
 business_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('owner','member')),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (business_id,user_id),
 UNIQUE (user_id)
);
CREATE TABLE IF NOT EXISTS business_verified_identities (
 email text PRIMARY KEY,
 business_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 claimed_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
