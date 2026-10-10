-- Security metadata only. Does not alter business/asset records.
BEGIN;
ALTER TABLE public.ai_connection_codes DROP CONSTRAINT IF EXISTS ai_connection_codes_scope_check;
ALTER TABLE public.ai_connection_codes ADD CONSTRAINT ai_connection_codes_scope_check CHECK (scope IN ('aim4price:read','aim4price:admin:read'));
ALTER TABLE public.ai_connections DROP CONSTRAINT IF EXISTS ai_connections_scope_check;
ALTER TABLE public.ai_connections ADD CONSTRAINT ai_connections_scope_check CHECK (scope IN ('aim4price:read','aim4price:admin:read'));
CREATE TABLE IF NOT EXISTS public.ai_connection_rate_limits (
 bucket text PRIMARY KEY, window_start timestamptz NOT NULL, requests integer NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ai_connection_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_user_id text NOT NULL,
 connection_id uuid NOT NULL,
 client_id text NOT NULL,
 tool text NOT NULL,
 outcome text NOT NULL CHECK (outcome IN ('started','completed','denied','failed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_connection_audit_actor_time ON public.ai_connection_audit(actor_user_id,created_at DESC);
COMMIT;
