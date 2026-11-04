-- NULL means an ongoing owner approval; access tokens still expire after one hour.
-- Preserve existing expiry dates: owners must approve again to grant ongoing access.
ALTER TABLE public.ai_connections ALTER COLUMN expires_at DROP NOT NULL;

-- A manual run may precede the tracked deployment migration. Keep it safe to repeat.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ai_connections'::regclass
      AND conname = 'ai_connections_admin_expiry'
  ) THEN
    ALTER TABLE public.ai_connections
      ADD CONSTRAINT ai_connections_admin_expiry
      CHECK (scope = 'aim4price:read' OR expires_at IS NOT NULL);
  END IF;
END
$$;
