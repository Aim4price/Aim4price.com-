-- Authentication metadata only. AI tools never write business records.
CREATE TABLE IF NOT EXISTS public.ai_connection_codes (
 code_hash text PRIMARY KEY,
 user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
 client_id text NOT NULL, redirect_uri text NOT NULL, challenge text NOT NULL,
 resource text NOT NULL, scope text NOT NULL CHECK (scope = 'aim4price:read'),
 expires_at timestamptz NOT NULL,
 consent_hash text NOT NULL UNIQUE, used_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.ai_connections (
 id uuid PRIMARY KEY,
 user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
 client_id text NOT NULL, resource text NOT NULL,
 scope text NOT NULL CHECK (scope = 'aim4price:read'),
 access_hash text NOT NULL UNIQUE, refresh_hash text NOT NULL UNIQUE,
 access_expires_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS ai_connections_owner ON public.ai_connections(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_connection_refresh_tokens (
 token_hash text PRIMARY KEY,
 connection_id uuid NOT NULL REFERENCES public.ai_connections(id) ON DELETE CASCADE,
 used_at timestamptz
);
CREATE INDEX IF NOT EXISTS ai_connection_refresh_owner ON public.ai_connection_refresh_tokens(connection_id);
