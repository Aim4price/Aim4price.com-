-- Ensure Licence renewal experts are stored as a dedicated account role.
-- Safe to run repeatedly in DBeaver against PostgreSQL.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('aim4price:account-profiles:licensing-role'));

CREATE TABLE IF NOT EXISTS public.account_profiles (
  user_id text PRIMARY KEY,
  display_name text,
  logo_url text,
  website_url text,
  extra_photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_name text,
  phone text,
  account_type text NOT NULL DEFAULT 'owner',
  account_subtype text NOT NULL DEFAULT 'farmer',
  account_status text NOT NULL DEFAULT 'pending_payment',
  introduced_by_option text NOT NULL DEFAULT 'direct',
  introduced_by_name text,
  vat_number text,
  province text,
  town_city text,
  address_line_1 text,
  address_line_2 text,
  notes text,
  marketplace_seller_name text,
  marketplace_phone text,
  marketplace_email text,
  marketplace_location text,
  discovery_participation_enabled boolean NOT NULL DEFAULT false,
  partner_directory_enabled boolean NOT NULL DEFAULT false,
  partner_directory_status text NOT NULL DEFAULT 'approved',
  partner_description text,
  partner_latitude double precision,
  partner_longitude double precision,
  partner_service_radius_km integer,
  partner_brand_focus text,
  partner_services text,
  scan_pin_hash text,
  scan_pin_enabled boolean NOT NULL DEFAULT false,
  scan_pin_updated_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS account_subtype text NOT NULL DEFAULT 'farmer',
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending_payment',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $migration$
DECLARE
  role_constraint record;
BEGIN
  FOR role_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.account_profiles'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%account_type%'
        OR pg_get_constraintdef(oid) ILIKE '%account_subtype%'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.account_profiles DROP CONSTRAINT %I',
      role_constraint.conname
    );
  END LOOP;
END
$migration$;

ALTER TABLE public.account_profiles
  ALTER COLUMN account_type DROP DEFAULT,
  ALTER COLUMN account_subtype DROP DEFAULT;

ALTER TABLE public.account_profiles
  ALTER COLUMN account_type TYPE text USING account_type::text,
  ALTER COLUMN account_subtype TYPE text USING account_subtype::text;

UPDATE public.account_profiles
SET account_type = CASE lower(regexp_replace(trim(coalesce(account_type, '')), '[ _]+', '-', 'g'))
  WHEN 'bank' THEN 'finance'
  WHEN 'finance-house' THEN 'finance'
  WHEN 'accountant' THEN 'finance'
  WHEN 'accounting' THEN 'finance'
  WHEN 'finance' THEN 'finance'
  WHEN 'broker' THEN 'insurance'
  WHEN 'insurer' THEN 'insurance'
  WHEN 'short-term-insurer' THEN 'insurance'
  WHEN 'insurance' THEN 'insurance'
  WHEN 'auction-house' THEN 'dealer'
  WHEN 'auctioneer' THEN 'dealer'
  WHEN 'machinery-dealer' THEN 'dealer'
  WHEN 'motor-dealer' THEN 'dealer'
  WHEN 'dealer' THEN 'dealer'
  WHEN 'license-renewal' THEN 'licensing'
  WHEN 'licence-renewal' THEN 'licensing'
  WHEN 'licensing-expert' THEN 'licensing'
  WHEN 'license-renewal-expert' THEN 'licensing'
  WHEN 'licence-renewal-expert' THEN 'licensing'
  WHEN 'licensing' THEN 'licensing'
  WHEN 'owner' THEN 'owner'
  ELSE 'owner'
END;

UPDATE public.account_profiles
SET account_subtype = CASE account_type
  WHEN 'owner' THEN CASE
    WHEN lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) IN
      ('farmer', 'contractor', 'construction-company', 'asset-owner')
      THEN lower(regexp_replace(trim(account_subtype), '[ _]+', '-', 'g'))
    ELSE 'farmer'
  END
  WHEN 'finance' THEN CASE
    WHEN lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) IN
      ('bank', 'finance-house', 'accountant')
      THEN lower(regexp_replace(trim(account_subtype), '[ _]+', '-', 'g'))
    ELSE 'bank'
  END
  WHEN 'insurance' THEN 'short-term-insurer'
  WHEN 'dealer' THEN CASE
    WHEN lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) IN
      ('machinery-dealer', 'motor-dealer')
      THEN lower(regexp_replace(trim(account_subtype), '[ _]+', '-', 'g'))
    WHEN lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) IN
      ('auction-house', 'auctioneer')
      THEN 'auctioneer'
    ELSE 'machinery-dealer'
  END
  WHEN 'licensing' THEN CASE
    WHEN lower(regexp_replace(trim(coalesce(account_subtype, '')), '[ _]+', '-', 'g')) =
      'fleet-licensing-service'
      THEN 'fleet-licensing-service'
    ELSE 'licence-renewal-expert'
  END
END;

ALTER TABLE public.account_profiles
  ALTER COLUMN account_type SET DEFAULT 'owner',
  ALTER COLUMN account_type SET NOT NULL,
  ALTER COLUMN account_subtype SET DEFAULT 'farmer',
  ALTER COLUMN account_subtype SET NOT NULL;

ALTER TABLE public.account_profiles
  ADD CONSTRAINT account_profiles_account_role_check
  CHECK (
    (account_type = 'owner' AND account_subtype IN
      ('farmer', 'contractor', 'construction-company', 'asset-owner'))
    OR (account_type = 'finance' AND account_subtype IN
      ('bank', 'finance-house', 'accountant'))
    OR (account_type = 'insurance' AND account_subtype = 'short-term-insurer')
    OR (account_type = 'dealer' AND account_subtype IN
      ('machinery-dealer', 'motor-dealer', 'auctioneer'))
    OR (account_type = 'licensing' AND account_subtype IN
      ('licence-renewal-expert', 'fleet-licensing-service'))
  ) NOT VALID;

ALTER TABLE public.account_profiles
  VALIDATE CONSTRAINT account_profiles_account_role_check;

DO $migration$
BEGIN
  IF to_regclass('public.asset_register_access_grants') IS NOT NULL THEN
    ALTER TABLE public.asset_register_access_grants
      DROP CONSTRAINT IF EXISTS asset_register_access_grants_partner_type_check;

    ALTER TABLE public.asset_register_access_grants
      ADD CONSTRAINT asset_register_access_grants_partner_type_check
      CHECK (partner_type IN ('dealer', 'finance', 'insurance', 'licensing'))
      NOT VALID;

    ALTER TABLE public.asset_register_access_grants
      VALIDATE CONSTRAINT asset_register_access_grants_partner_type_check;
  END IF;

  IF to_regclass('public.asset_leads') IS NOT NULL THEN
    ALTER TABLE public.asset_leads
      DROP CONSTRAINT IF EXISTS asset_leads_lead_type_check;

    ALTER TABLE public.asset_leads
      ADD CONSTRAINT asset_leads_lead_type_check
      CHECK (lead_type IN
        ('finance', 'insurance', 'replacement_quote', 'license_renewal'))
      NOT VALID;

    ALTER TABLE public.asset_leads
      VALIDATE CONSTRAINT asset_leads_lead_type_check;
  END IF;
END
$migration$;

COMMENT ON COLUMN public.account_profiles.account_type IS
  'Aim4price workspace role: owner, finance, insurance, dealer or licensing.';

COMMENT ON COLUMN public.account_profiles.account_subtype IS
  'Role-specific subtype. Licensing uses licence-renewal-expert or fleet-licensing-service.';

CREATE INDEX IF NOT EXISTS idx_account_profiles_account_role
  ON public.account_profiles(account_type, account_subtype, account_status);

COMMIT;

-- Verification. Both queries are read-only.
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'account_profiles'
  AND column_name IN ('account_type', 'account_subtype')
ORDER BY column_name;

SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition,
  convalidated AS validated
FROM pg_constraint
WHERE conname IN (
  'account_profiles_account_role_check',
  'asset_register_access_grants_partner_type_check',
  'asset_leads_lead_type_check'
)
ORDER BY conname;

SELECT
  account_type,
  account_subtype,
  count(*) AS accounts
FROM public.account_profiles
GROUP BY account_type, account_subtype
ORDER BY account_type, account_subtype;

-- Optional repair for one incorrectly created pending account.
-- Replace the email, then run this statement separately.
-- UPDATE public.account_profiles profile
-- SET account_type = 'licensing',
--     account_subtype = 'licence-renewal-expert',
--     updated_at = now()
-- FROM public."user" auth_user
-- WHERE profile.user_id = auth_user.id
--   AND lower(trim(auth_user.email)) = lower(trim('REPLACE_WITH_EMAIL'))
--   AND profile.account_status = 'pending_payment'
-- RETURNING profile.user_id, profile.account_type, profile.account_subtype;
