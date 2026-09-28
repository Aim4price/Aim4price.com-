-- Retire specialist access without deleting users, assets, invoices or historical shares.
BEGIN;
CREATE TABLE IF NOT EXISTS retired_specialist_accounts (
 user_id text PRIMARY KEY, previous_account_type text NOT NULL,
 previous_account_subtype text, retired_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO retired_specialist_accounts(user_id, previous_account_type, previous_account_subtype)
SELECT user_id, account_type, account_subtype FROM account_profiles
WHERE account_type IN ('insurance','finance','licensing','accounting','accountant')
   OR user_id LIKE 'aim4price-assistance-%'
   OR user_id IN (SELECT id FROM "user" WHERE lower(email) IN
     ('insurance@aim4price.com','finance@aim4price.com','licensing@aim4price.com','accounting@aim4price.com','dealers@aim4price.com'))
ON CONFLICT (user_id) DO NOTHING;
UPDATE account_profiles SET
 account_subtype = CASE
  WHEN account_type IN ('accounting','accountant') OR (account_type='finance' AND account_subtype='accountant') THEN 'accounting-services'
  WHEN account_type='finance' THEN 'finance-services'
  WHEN account_type='insurance' THEN 'insurance-services'
  WHEN account_type='licensing' THEN 'licensing-services'
  ELSE 'contributor' END,
 account_type = 'business', updated_at = now()
WHERE account_type IN ('insurance','finance','licensing','accounting','accountant');
UPDATE account_profiles SET account_status='suspended', partner_directory_enabled=false,
 discovery_participation_enabled=false, updated_at=now()
WHERE user_id LIKE 'aim4price-assistance-%'
   OR user_id IN (SELECT id FROM "user" WHERE lower(email) IN
     ('insurance@aim4price.com','finance@aim4price.com','licensing@aim4price.com','accounting@aim4price.com','dealers@aim4price.com'));
DELETE FROM "session" WHERE "userId" IN (
 SELECT user_id FROM account_profiles WHERE user_id LIKE 'aim4price-assistance-%'
 UNION SELECT id FROM "user" WHERE lower(email) IN
 ('insurance@aim4price.com','finance@aim4price.com','licensing@aim4price.com','accounting@aim4price.com','dealers@aim4price.com')
);
DO $$ BEGIN
 IF to_regclass('public.aim4price_assistance_accounts') IS NOT NULL THEN
  UPDATE aim4price_assistance_accounts SET enabled=false, updated_at=now();
 END IF;
 IF to_regclass('public.aim4price_assistance_locations') IS NOT NULL THEN
  UPDATE aim4price_assistance_locations SET enabled=false, updated_at=now();
 END IF;
 IF to_regclass('public.aim4price_billing_plans') IS NOT NULL THEN
  UPDATE aim4price_billing_plans SET enabled=false, version=version+1, updated_at=now()
  WHERE account_type IN ('insurance','finance','licensing') AND enabled=true;
 END IF;
 IF to_regclass('public.aim4price_billing_agreements') IS NOT NULL THEN
  UPDATE aim4price_billing_agreements SET enabled=false, version=version+1, updated_at=now()
  WHERE user_id IN (SELECT user_id FROM retired_specialist_accounts) AND enabled=true;
 END IF;
END $$;
COMMIT;
