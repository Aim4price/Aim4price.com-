-- Pin consent to the account type. Existing customer grants were Owner-only.
ALTER TABLE public.ai_connection_codes ADD COLUMN IF NOT EXISTS account_type text;
ALTER TABLE public.ai_connections ADD COLUMN IF NOT EXISTS account_type text;
UPDATE public.ai_connection_codes SET account_type=CASE WHEN scope='aim4price:admin:read' THEN 'admin' ELSE 'owner' END WHERE account_type IS NULL;
UPDATE public.ai_connections SET account_type=CASE WHEN scope='aim4price:admin:read' THEN 'admin' ELSE 'owner' END WHERE account_type IS NULL;
ALTER TABLE public.ai_connection_codes ALTER COLUMN account_type SET NOT NULL;
ALTER TABLE public.ai_connections ALTER COLUMN account_type SET NOT NULL;

-- Preserve writes from the previous deployment while instances are replaced.
-- Old customer code could only issue Owner grants. Admin grants issued by an old
-- instance during deployment may need fresh consent after the upgrade.
ALTER TABLE public.ai_connection_codes ALTER COLUMN account_type SET DEFAULT 'owner';
ALTER TABLE public.ai_connections ALTER COLUMN account_type SET DEFAULT 'owner';
