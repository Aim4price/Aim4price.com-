-- NULL means an ongoing owner approval; access tokens still expire after one hour.
-- Preserve existing expiry dates: owners must approve again to grant ongoing access.
ALTER TABLE public.ai_connections ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE public.ai_connections ADD CONSTRAINT ai_connections_admin_expiry
 CHECK (scope = 'aim4price:read' OR expires_at IS NOT NULL);
