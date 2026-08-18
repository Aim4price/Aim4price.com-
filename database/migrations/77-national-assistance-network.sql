-- Aim4price-managed national assistance network with five login-capable master accounts.
-- DBeaver/PostgreSQL: safe to run repeatedly after migrations 1-76.
-- Preserves existing partner data, administrator visibility choices, and changed passwords.
BEGIN;

SELECT pg_advisory_xact_lock(hashtext('aim4price:national-assistance-network:v1'));
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $preflight$
DECLARE
  conflicting_email text;
  conflicting_user_id text;
BEGIN
  IF to_regclass('public."user"') IS NULL
     OR to_regclass('public."account"') IS NULL
     OR to_regclass('public.account_profiles') IS NULL THEN
    RAISE EXCEPTION
      'Better Auth tables and account_profiles must exist. Apply migrations 1-76 first.';
  END IF;

  SELECT auth_user.email, auth_user.id
  INTO conflicting_email, conflicting_user_id
  FROM public."user" auth_user
  JOIN (
    VALUES
      ('aim4price-assistance-finance', 'finance@aim4price.com'),
      ('aim4price-assistance-accounting', 'accounting@aim4price.com'),
      ('aim4price-assistance-insurance', 'insurance@aim4price.com'),
      ('aim4price-assistance-dealer', 'dealers@aim4price.com'),
      ('aim4price-assistance-licensing', 'licensing@aim4price.com')
  ) seed(user_id, email)
    ON lower(auth_user.email) = seed.email
   AND auth_user.id <> seed.user_id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Email % already belongs to user %. No records were changed.',
      conflicting_email,
      conflicting_user_id;
  END IF;

  SELECT auth_user.email, auth_user.id
  INTO conflicting_email, conflicting_user_id
  FROM public."user" auth_user
  JOIN (
    VALUES
      ('aim4price-assistance-finance', 'finance@aim4price.com'),
      ('aim4price-assistance-accounting', 'accounting@aim4price.com'),
      ('aim4price-assistance-insurance', 'insurance@aim4price.com'),
      ('aim4price-assistance-dealer', 'dealers@aim4price.com'),
      ('aim4price-assistance-licensing', 'licensing@aim4price.com')
  ) seed(user_id, email)
    ON auth_user.id = seed.user_id
   AND lower(auth_user.email) <> seed.email
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Assistance user ID % already uses email %. No records were changed.',
      conflicting_user_id,
      conflicting_email;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."account" credential
    JOIN (
      VALUES
        ('aim4price-assistance-finance-credential', 'aim4price-assistance-finance'),
        ('aim4price-assistance-accounting-credential', 'aim4price-assistance-accounting'),
        ('aim4price-assistance-insurance-credential', 'aim4price-assistance-insurance'),
        ('aim4price-assistance-dealer-credential', 'aim4price-assistance-dealer'),
        ('aim4price-assistance-licensing-credential', 'aim4price-assistance-licensing')
    ) seed(credential_id, user_id)
      ON credential.id = seed.credential_id
    WHERE credential."userId" <> seed.user_id
       OR credential."providerId" <> 'credential'
  ) THEN
    RAISE EXCEPTION
      'A reserved assistance credential ID is already in use. No records were changed.';
  END IF;
END
$preflight$;


CREATE TABLE IF NOT EXISTS public.aim4price_assistance_accounts (
  service_key text PRIMARY KEY,
  partner_user_id text NOT NULL UNIQUE,
  partner_type text NOT NULL,
  account_subtype text NOT NULL,
  display_name text NOT NULL,
  listing_prefix text NOT NULL,
  notification_email text NOT NULL,
  routing_email text NOT NULL DEFAULT 'aim4price@gmail.com',
  managed_by_user_id text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aim4price_assistance_accounts_service_check
    CHECK (service_key IN ('finance', 'accounting', 'insurance', 'dealer', 'licensing')),
  CONSTRAINT aim4price_assistance_accounts_partner_check
    CHECK (partner_type IN ('finance', 'insurance', 'dealer', 'licensing'))
);

CREATE TABLE IF NOT EXISTS public.aim4price_assistance_locations (
  id text PRIMARY KEY,
  service_key text NOT NULL REFERENCES public.aim4price_assistance_accounts(service_key) ON DELETE RESTRICT,
  province text NOT NULL,
  town text NOT NULL,
  town_slug text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  service_radius_km integer NOT NULL,
  geonames_id text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aim4price_assistance_locations_unique UNIQUE (service_key, town_slug),
  CONSTRAINT aim4price_assistance_locations_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT aim4price_assistance_locations_longitude_check CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT aim4price_assistance_locations_radius_check CHECK (service_radius_km BETWEEN 25 AND 500)
);

CREATE TABLE IF NOT EXISTS public.aim4price_assistance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistance_location_id text NOT NULL REFERENCES public.aim4price_assistance_locations(id) ON DELETE RESTRICT,
  service_key text NOT NULL REFERENCES public.aim4price_assistance_accounts(service_key) ON DELETE RESTRICT,
  master_partner_user_id text NOT NULL,
  owner_user_id text NOT NULL,
  owner_name text,
  owner_email text,
  owner_phone text,
  province text NOT NULL,
  town text NOT NULL,
  selected_asset_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  asset_lead_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  asset_group_id text,
  asset_group_name text,
  included_sections_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_message text,
  notification_email text NOT NULL,
  notification_status text NOT NULL DEFAULT 'pending',
  notification_error text,
  provider_approval_status text NOT NULL DEFAULT 'not_requested',
  external_provider_user_id text,
  provider_approved_at timestamptz,
  provider_approved_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aim4price_assistance_requests_notification_check
    CHECK (notification_status IN ('pending', 'sent', 'failed')),
  CONSTRAINT aim4price_assistance_requests_provider_approval_check
    CHECK (provider_approval_status IN ('not_requested', 'requested', 'approved', 'declined')),
  CONSTRAINT aim4price_assistance_requests_external_share_check
    CHECK (
      external_provider_user_id IS NULL
      OR (
        provider_approval_status = 'approved'
        AND provider_approved_at IS NOT NULL
        AND provider_approved_by_user_id = owner_user_id
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_assistance_locations_viewport
  ON public.aim4price_assistance_locations(service_key, enabled, latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_assistance_requests_owner_created
  ON public.aim4price_assistance_requests(owner_user_id, created_at DESC);


-- Create five real Better Auth users using the same IDs already used by sharing.
-- Passwords are Better Auth 1.6 scrypt hashes; plaintext passwords are supplied
-- separately. Existing non-empty credential passwords are never overwritten.
WITH login_seed(
  user_id, display_name, email, password_hash
) AS (
  VALUES
    (
      'aim4price-assistance-finance',
      'Aim4price Finance Assistance',
      'finance@aim4price.com',
      '1776e1877bfbb0cb95c7e70711e8d845:c367a54bd7a557678eae9901dbde1d042a9a7e83565fec81f64b29bb37f43708430582af7dd3b59e3719a6c408af4e9dfd5165fa2b6f1a756955094d885a76b5'
    ),
    (
      'aim4price-assistance-accounting',
      'Aim4price Accounting Assistance',
      'accounting@aim4price.com',
      '98c210ea5a6dd49bc966ddb964d5bc08:c1906a9a03da02340c1ed99c31e04d4c77ccd6c04bb1eff4790ec05d5f85e571e951b123f63d172e3d98857e975ff9f7765e725af7b1a6c7ca0faae1d3277159'
    ),
    (
      'aim4price-assistance-insurance',
      'Aim4price Insurance Assistance',
      'insurance@aim4price.com',
      'a52367afa76ab4ea5820fd4a6a561635:4f958dde3d77837fa3f9d8c4caa7656e72bc6f7338dc0f1217ecd38fb06dc2cf8152ec3f3bd78b19d3f78eca650a13c8e86eaebb7cf68d1ae527867e611d5a55'
    ),
    (
      'aim4price-assistance-dealer',
      'Aim4price Dealer Assistance',
      'dealers@aim4price.com',
      'e0665d6eb875ea66e9c22a2fafbbbc50:cddcc50f90929f44b818b66236f14d97454eadc27dbba4b07ec5aff7150104e9685dd658392f5d2d135f1e17d4197937929d1f96f94e4a19a93cfa063b34aa40'
    ),
    (
      'aim4price-assistance-licensing',
      'Aim4price Licence Renewal Assistance',
      'licensing@aim4price.com',
      '01710643d73798ca813c05be8103e274:76547c833ada25494621d713e3254313f50afc62cc06dffe8306bc355f8744e020d033c2f4eac64fa456e31e3daa24dca9a20ece51e53e4997e72bd6f7540b42'
    )
)
INSERT INTO public."user" AS auth_user (
  id, name, email, "emailVerified", image, "createdAt", "updatedAt"
)
SELECT
  seed.user_id,
  seed.display_name,
  seed.email,
  true,
  NULL,
  now(),
  now()
FROM login_seed seed
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  "emailVerified" = true,
  "updatedAt" = now()
WHERE lower(auth_user.email) = lower(excluded.email);

WITH login_seed(user_id, password_hash) AS (
  VALUES
    (
      'aim4price-assistance-finance',
      '1776e1877bfbb0cb95c7e70711e8d845:c367a54bd7a557678eae9901dbde1d042a9a7e83565fec81f64b29bb37f43708430582af7dd3b59e3719a6c408af4e9dfd5165fa2b6f1a756955094d885a76b5'
    ),
    (
      'aim4price-assistance-accounting',
      '98c210ea5a6dd49bc966ddb964d5bc08:c1906a9a03da02340c1ed99c31e04d4c77ccd6c04bb1eff4790ec05d5f85e571e951b123f63d172e3d98857e975ff9f7765e725af7b1a6c7ca0faae1d3277159'
    ),
    (
      'aim4price-assistance-insurance',
      'a52367afa76ab4ea5820fd4a6a561635:4f958dde3d77837fa3f9d8c4caa7656e72bc6f7338dc0f1217ecd38fb06dc2cf8152ec3f3bd78b19d3f78eca650a13c8e86eaebb7cf68d1ae527867e611d5a55'
    ),
    (
      'aim4price-assistance-dealer',
      'e0665d6eb875ea66e9c22a2fafbbbc50:cddcc50f90929f44b818b66236f14d97454eadc27dbba4b07ec5aff7150104e9685dd658392f5d2d135f1e17d4197937929d1f96f94e4a19a93cfa063b34aa40'
    ),
    (
      'aim4price-assistance-licensing',
      '01710643d73798ca813c05be8103e274:76547c833ada25494621d713e3254313f50afc62cc06dffe8306bc355f8744e020d033c2f4eac64fa456e31e3daa24dca9a20ece51e53e4997e72bd6f7540b42'
    )
)
UPDATE public."account" credential
SET
  password = seed.password_hash,
  "updatedAt" = now()
FROM login_seed seed
WHERE credential."userId" = seed.user_id
  AND credential."providerId" = 'credential'
  AND coalesce(credential.password, '') = '';

WITH login_seed(
  credential_id, user_id, password_hash
) AS (
  VALUES
    (
      'aim4price-assistance-finance-credential',
      'aim4price-assistance-finance',
      '1776e1877bfbb0cb95c7e70711e8d845:c367a54bd7a557678eae9901dbde1d042a9a7e83565fec81f64b29bb37f43708430582af7dd3b59e3719a6c408af4e9dfd5165fa2b6f1a756955094d885a76b5'
    ),
    (
      'aim4price-assistance-accounting-credential',
      'aim4price-assistance-accounting',
      '98c210ea5a6dd49bc966ddb964d5bc08:c1906a9a03da02340c1ed99c31e04d4c77ccd6c04bb1eff4790ec05d5f85e571e951b123f63d172e3d98857e975ff9f7765e725af7b1a6c7ca0faae1d3277159'
    ),
    (
      'aim4price-assistance-insurance-credential',
      'aim4price-assistance-insurance',
      'a52367afa76ab4ea5820fd4a6a561635:4f958dde3d77837fa3f9d8c4caa7656e72bc6f7338dc0f1217ecd38fb06dc2cf8152ec3f3bd78b19d3f78eca650a13c8e86eaebb7cf68d1ae527867e611d5a55'
    ),
    (
      'aim4price-assistance-dealer-credential',
      'aim4price-assistance-dealer',
      'e0665d6eb875ea66e9c22a2fafbbbc50:cddcc50f90929f44b818b66236f14d97454eadc27dbba4b07ec5aff7150104e9685dd658392f5d2d135f1e17d4197937929d1f96f94e4a19a93cfa063b34aa40'
    ),
    (
      'aim4price-assistance-licensing-credential',
      'aim4price-assistance-licensing',
      '01710643d73798ca813c05be8103e274:76547c833ada25494621d713e3254313f50afc62cc06dffe8306bc355f8744e020d033c2f4eac64fa456e31e3daa24dca9a20ece51e53e4997e72bd6f7540b42'
    )
)
INSERT INTO public."account" (
  id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
)
SELECT
  seed.credential_id,
  seed.user_id,
  'credential',
  seed.user_id,
  seed.password_hash,
  now(),
  now()
FROM login_seed seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public."account" existing_credential
  WHERE existing_credential."userId" = seed.user_id
    AND existing_credential."providerId" = 'credential'
)
ON CONFLICT (id) DO NOTHING;

WITH master_seed(
  service_key, partner_user_id, partner_type, account_subtype, display_name,
  listing_prefix, notification_email, routing_email
) AS (
  VALUES
    ('finance', 'aim4price-assistance-finance', 'finance', 'finance-house',
      'Aim4price Finance Assistance', 'Aim4price Finance Assistance',
      'finance@aim4price.com', 'aim4price@gmail.com'),
    ('accounting', 'aim4price-assistance-accounting', 'finance', 'accountant',
      'Aim4price Accounting Assistance', 'Aim4price Accounting Assistance',
      'accounting@aim4price.com', 'aim4price@gmail.com'),
    ('insurance', 'aim4price-assistance-insurance', 'insurance', 'short-term-insurer',
      'Aim4price Insurance Assistance', 'Aim4price Insurance Assistance',
      'insurance@aim4price.com', 'aim4price@gmail.com'),
    ('dealer', 'aim4price-assistance-dealer', 'dealer', 'machinery-dealer',
      'Aim4price Dealer Assistance', 'Aim4price Dealer Assistance',
      'dealers@aim4price.com', 'aim4price@gmail.com'),
    ('licensing', 'aim4price-assistance-licensing', 'licensing', 'licence-renewal-expert',
      'Aim4price Licence Renewal Assistance', 'Aim4price Licence Renewal Assistance',
      'licensing@aim4price.com', 'aim4price@gmail.com')
)
INSERT INTO public.aim4price_assistance_accounts (
  service_key, partner_user_id, partner_type, account_subtype, display_name,
  listing_prefix, notification_email, routing_email, managed_by_user_id, enabled,
  created_at, updated_at
)
SELECT
  seed.service_key,
  seed.partner_user_id,
  seed.partner_type,
  seed.account_subtype,
  seed.display_name,
  seed.listing_prefix,
  seed.notification_email,
  seed.routing_email,
  NULL,
  true,
  now(),
  now()
FROM master_seed seed
ON CONFLICT (service_key) DO UPDATE SET
  partner_user_id = excluded.partner_user_id,
  partner_type = excluded.partner_type,
  account_subtype = excluded.account_subtype,
  display_name = excluded.display_name,
  listing_prefix = excluded.listing_prefix,
  notification_email = excluded.notification_email,
  routing_email = excluded.routing_email,
  managed_by_user_id = excluded.managed_by_user_id,
  updated_at = now();

DO $migration$
BEGIN
  IF to_regclass('public."user"') IS NOT NULL THEN
    UPDATE public.aim4price_assistance_accounts
    SET managed_by_user_id = (
      SELECT id
      FROM public."user"
      WHERE lower(trim(email)) = 'aim4price@gmail.com'
      LIMIT 1
    ),
    updated_at = now()
    WHERE service_key IN ('finance', 'accounting', 'insurance', 'dealer', 'licensing');
  END IF;
END
$migration$;

WITH master_seed(partner_user_id, account_type, account_subtype, display_name, notification_email) AS (
  VALUES
    ('aim4price-assistance-finance', 'finance', 'finance-house',
      'Aim4price Finance Assistance', 'finance@aim4price.com'),
    ('aim4price-assistance-accounting', 'finance', 'accountant',
      'Aim4price Accounting Assistance', 'accounting@aim4price.com'),
    ('aim4price-assistance-insurance', 'insurance', 'short-term-insurer',
      'Aim4price Insurance Assistance', 'insurance@aim4price.com'),
    ('aim4price-assistance-dealer', 'dealer', 'machinery-dealer',
      'Aim4price Dealer Assistance', 'dealers@aim4price.com'),
    ('aim4price-assistance-licensing', 'licensing', 'licence-renewal-expert',
      'Aim4price Licence Renewal Assistance', 'licensing@aim4price.com')
)
INSERT INTO public.account_profiles (
  user_id, display_name, business_name, account_type, account_subtype, account_status,
  introduced_by_option, marketplace_email, marketplace_location,
  discovery_participation_enabled, partner_directory_enabled, partner_directory_status,
  partner_description, partner_brand_focus, partner_services, notes, created_at, updated_at
)
SELECT
  seed.partner_user_id,
  seed.display_name,
  seed.display_name,
  seed.account_type,
  seed.account_subtype,
  'active',
  'direct',
  seed.notification_email,
  'South Africa',
  false,
  false,
  'approved',
  'This location represents an Aim4price service area, not a physical branch.',
  'Aim4price national assistance network',
  seed.display_name,
  'Login-capable Aim4price-managed assistance account; operationally managed by aim4price@gmail.com.',
  now(),
  now()
FROM master_seed seed
ON CONFLICT (user_id) DO UPDATE SET
  display_name = excluded.display_name,
  business_name = excluded.business_name,
  account_type = excluded.account_type,
  account_subtype = excluded.account_subtype,
  account_status = 'active',
  marketplace_email = excluded.marketplace_email,
  marketplace_location = excluded.marketplace_location,
  discovery_participation_enabled = false,
  partner_directory_enabled = false,
  partner_description = excluded.partner_description,
  partner_brand_focus = excluded.partner_brand_focus,
  partner_services = excluded.partner_services,
  notes = excluded.notes,
  updated_at = now();

WITH location_seed AS (
  SELECT *
  FROM jsonb_to_recordset($seed$[{"province":"Gauteng","town":"Johannesburg","slug":"johannesburg","latitude":-26.20227,"longitude":28.04363,"serviceRadiusKm":80,"geonamesId":"993800"},{"province":"Gauteng","town":"Pretoria","slug":"pretoria","latitude":-25.74486,"longitude":28.18783,"serviceRadiusKm":80,"geonamesId":"964137"},{"province":"Gauteng","town":"Centurion","slug":"centurion","latitude":-25.85891,"longitude":28.18577,"serviceRadiusKm":75,"geonamesId":"1105777"},{"province":"Gauteng","town":"Midrand","slug":"midrand","latitude":-25.976,"longitude":28.118,"serviceRadiusKm":75,"geonamesId":"1105776"},{"province":"Gauteng","town":"Benoni","slug":"benoni","latitude":-26.18848,"longitude":28.32078,"serviceRadiusKm":75,"geonamesId":"1020098"},{"province":"Gauteng","town":"Boksburg","slug":"boksburg","latitude":-26.21197,"longitude":28.25958,"serviceRadiusKm":75,"geonamesId":"1017780"},{"province":"Gauteng","town":"Vereeniging","slug":"vereeniging","latitude":-26.67313,"longitude":27.92615,"serviceRadiusKm":90,"geonamesId":"944385"},{"province":"Western Cape","town":"Cape Town","slug":"cape-town","latitude":-33.92584,"longitude":18.42322,"serviceRadiusKm":85,"geonamesId":"3369157"},{"province":"Western Cape","town":"Stellenbosch","slug":"stellenbosch","latitude":-33.93462,"longitude":18.86676,"serviceRadiusKm":75,"geonamesId":"3361025"},{"province":"Western Cape","town":"Paarl","slug":"paarl","latitude":-33.73378,"longitude":18.97523,"serviceRadiusKm":75,"geonamesId":"3363094"},{"province":"Western Cape","town":"Worcester","slug":"worcester","latitude":-33.64651,"longitude":19.44852,"serviceRadiusKm":100,"geonamesId":"3359041"},{"province":"Western Cape","town":"Ceres","slug":"ceres","latitude":-33.36889,"longitude":19.31095,"serviceRadiusKm":100,"geonamesId":"3369129"},{"province":"Western Cape","town":"Malmesbury","slug":"malmesbury","latitude":-33.4608,"longitude":18.72714,"serviceRadiusKm":100,"geonamesId":"3364346"},{"province":"Western Cape","town":"Moorreesburg","slug":"moorreesburg","latitude":-33.15388,"longitude":18.66031,"serviceRadiusKm":100,"geonamesId":"3363957"},{"province":"Western Cape","town":"Vredendal","slug":"vredendal","latitude":-31.66833,"longitude":18.50119,"serviceRadiusKm":130,"geonamesId":"3359736"},{"province":"Western Cape","town":"Caledon","slug":"caledon","latitude":-34.22997,"longitude":19.4265,"serviceRadiusKm":100,"geonamesId":"3369179"},{"province":"Western Cape","town":"Robertson","slug":"robertson","latitude":-33.80342,"longitude":19.88537,"serviceRadiusKm":100,"geonamesId":"3362349"},{"province":"Western Cape","town":"Swellendam","slug":"swellendam","latitude":-34.02262,"longitude":20.44171,"serviceRadiusKm":100,"geonamesId":"950709"},{"province":"Western Cape","town":"Riversdale","slug":"riversdale","latitude":-34.09345,"longitude":21.25725,"serviceRadiusKm":100,"geonamesId":"961152"},{"province":"Western Cape","town":"George","slug":"george","latitude":-33.963,"longitude":22.46173,"serviceRadiusKm":100,"geonamesId":"1002145"},{"province":"Western Cape","town":"Oudtshoorn","slug":"oudtshoorn","latitude":-33.60047,"longitude":22.19955,"serviceRadiusKm":100,"geonamesId":"967106"},{"province":"Western Cape","town":"Beaufort West","slug":"beaufort-west","latitude":-32.35671,"longitude":22.58295,"serviceRadiusKm":180,"geonamesId":"1020641"},{"province":"Eastern Cape","town":"Gqeberha","slug":"gqeberha","latitude":-33.96109,"longitude":25.61494,"serviceRadiusKm":100,"geonamesId":"964420"},{"province":"Eastern Cape","town":"East London","slug":"east-london","latitude":-33.01529,"longitude":27.91162,"serviceRadiusKm":100,"geonamesId":"1006984"},{"province":"Eastern Cape","town":"Mthatha","slug":"mthatha","latitude":-31.58893,"longitude":28.78443,"serviceRadiusKm":120,"geonamesId":"946058"},{"province":"Eastern Cape","town":"Komani","slug":"komani","latitude":-31.89756,"longitude":26.87533,"serviceRadiusKm":100,"geonamesId":"963516"},{"province":"Eastern Cape","town":"Cradock","slug":"cradock","latitude":-32.16422,"longitude":25.61918,"serviceRadiusKm":120,"geonamesId":"1012600"},{"province":"Eastern Cape","town":"Graaff-Reinet","slug":"graaff-reinet","latitude":-32.25215,"longitude":24.53075,"serviceRadiusKm":130,"geonamesId":"1000543"},{"province":"Eastern Cape","town":"Somerset East","slug":"somerset-east","latitude":-32.72173,"longitude":25.58804,"serviceRadiusKm":100,"geonamesId":"954161"},{"province":"Eastern Cape","town":"Humansdorp","slug":"humansdorp","latitude":-34.02903,"longitude":24.76912,"serviceRadiusKm":100,"geonamesId":"995094"},{"province":"Eastern Cape","town":"Kirkwood","slug":"kirkwood","latitude":-33.39829,"longitude":25.44279,"serviceRadiusKm":100,"geonamesId":"990802"},{"province":"Eastern Cape","town":"Aliwal North","slug":"aliwal-north","latitude":-30.69366,"longitude":26.71141,"serviceRadiusKm":130,"geonamesId":"1023309"},{"province":"Eastern Cape","town":"Butterworth","slug":"butterworth","latitude":-32.33083,"longitude":28.14981,"serviceRadiusKm":100,"geonamesId":"1014489"},{"province":"Eastern Cape","town":"Stutterheim","slug":"stutterheim","latitude":-32.57076,"longitude":27.42396,"serviceRadiusKm":100,"geonamesId":"951650"},{"province":"Northern Cape","town":"Kimberley","slug":"kimberley","latitude":-28.73226,"longitude":24.76232,"serviceRadiusKm":120,"geonamesId":"990930"},{"province":"Northern Cape","town":"Upington","slug":"upington","latitude":-28.44776,"longitude":21.25612,"serviceRadiusKm":180,"geonamesId":"945945"},{"province":"Northern Cape","town":"Kuruman","slug":"kuruman","latitude":-27.46353,"longitude":23.43552,"serviceRadiusKm":150,"geonamesId":"986134"},{"province":"Northern Cape","town":"Kathu","slug":"kathu","latitude":-27.69569,"longitude":23.04929,"serviceRadiusKm":150,"geonamesId":"991664"},{"province":"Northern Cape","town":"De Aar","slug":"de-aar","latitude":-30.64966,"longitude":24.0123,"serviceRadiusKm":170,"geonamesId":"1011632"},{"province":"Northern Cape","town":"Prieska","slug":"prieska","latitude":-29.66803,"longitude":22.74251,"serviceRadiusKm":170,"geonamesId":"964090"},{"province":"Northern Cape","town":"Douglas","slug":"douglas","latitude":-29.05531,"longitude":23.7743,"serviceRadiusKm":150,"geonamesId":"1008612"},{"province":"Northern Cape","town":"Kakamas","slug":"kakamas","latitude":-28.77341,"longitude":20.6147,"serviceRadiusKm":170,"geonamesId":"993014"},{"province":"Northern Cape","town":"Springbok","slug":"springbok","latitude":-29.66434,"longitude":17.8865,"serviceRadiusKm":200,"geonamesId":"3361142"},{"province":"Northern Cape","town":"Calvinia","slug":"calvinia","latitude":-31.47069,"longitude":19.77601,"serviceRadiusKm":200,"geonamesId":"3369174"},{"province":"Free State","town":"Bloemfontein","slug":"bloemfontein","latitude":-29.12107,"longitude":26.214,"serviceRadiusKm":100,"geonamesId":"1018725"},{"province":"Free State","town":"Bethlehem","slug":"bethlehem","latitude":-28.23078,"longitude":28.30707,"serviceRadiusKm":100,"geonamesId":"1019704"},{"province":"Free State","town":"Harrismith","slug":"harrismith","latitude":-28.27276,"longitude":29.12946,"serviceRadiusKm":100,"geonamesId":"997751"},{"province":"Free State","town":"Kroonstad","slug":"kroonstad","latitude":-27.65036,"longitude":27.23488,"serviceRadiusKm":100,"geonamesId":"986846"},{"province":"Free State","town":"Welkom","slug":"welkom","latitude":-27.97742,"longitude":26.73506,"serviceRadiusKm":100,"geonamesId":"940909"},{"province":"Free State","town":"Bothaville","slug":"bothaville","latitude":-27.3887,"longitude":26.61701,"serviceRadiusKm":100,"geonamesId":"1016698"},{"province":"Free State","town":"Reitz","slug":"reitz","latitude":-27.80138,"longitude":28.42726,"serviceRadiusKm":100,"geonamesId":"962847"},{"province":"Free State","town":"Frankfort","slug":"frankfort","latitude":-27.27888,"longitude":28.49696,"serviceRadiusKm":100,"geonamesId":"1003763"},{"province":"Free State","town":"Parys","slug":"parys","latitude":-26.9033,"longitude":27.45727,"serviceRadiusKm":100,"geonamesId":"966166"},{"province":"Free State","town":"Sasolburg","slug":"sasolburg","latitude":-26.81358,"longitude":27.81695,"serviceRadiusKm":100,"geonamesId":"957487"},{"province":"Free State","town":"Ficksburg","slug":"ficksburg","latitude":-28.872,"longitude":27.87506,"serviceRadiusKm":100,"geonamesId":"1004303"},{"province":"Free State","town":"Ladybrand","slug":"ladybrand","latitude":-29.19448,"longitude":27.45739,"serviceRadiusKm":100,"geonamesId":"985015"},{"province":"Free State","town":"Bultfontein","slug":"bultfontein","latitude":-28.28756,"longitude":26.14996,"serviceRadiusKm":100,"geonamesId":"1014747"},{"province":"Free State","town":"Heilbron","slug":"heilbron","latitude":-27.28115,"longitude":27.9709,"serviceRadiusKm":100,"geonamesId":"997140"},{"province":"KwaZulu-Natal","town":"Durban","slug":"durban","latitude":-29.8579,"longitude":31.0292,"serviceRadiusKm":90,"geonamesId":"1007311"},{"province":"KwaZulu-Natal","town":"Pietermaritzburg","slug":"pietermaritzburg","latitude":-29.61679,"longitude":30.39278,"serviceRadiusKm":90,"geonamesId":"965301"},{"province":"KwaZulu-Natal","town":"Richards Bay","slug":"richards-bay","latitude":-28.78301,"longitude":32.03768,"serviceRadiusKm":100,"geonamesId":"962367"},{"province":"KwaZulu-Natal","town":"Newcastle","slug":"newcastle","latitude":-27.75796,"longitude":29.9318,"serviceRadiusKm":100,"geonamesId":"971421"},{"province":"KwaZulu-Natal","town":"Ladysmith","slug":"ladysmith","latitude":-28.55874,"longitude":29.77896,"serviceRadiusKm":100,"geonamesId":"984998"},{"province":"KwaZulu-Natal","town":"Kokstad","slug":"kokstad","latitude":-30.54723,"longitude":29.42412,"serviceRadiusKm":120,"geonamesId":"988356"},{"province":"KwaZulu-Natal","town":"Vryheid","slug":"vryheid","latitude":-27.76952,"longitude":30.79165,"serviceRadiusKm":120,"geonamesId":"942470"},{"province":"KwaZulu-Natal","town":"Dundee","slug":"dundee","latitude":-28.16678,"longitude":30.23371,"serviceRadiusKm":100,"geonamesId":"1007400"},{"province":"KwaZulu-Natal","town":"Estcourt","slug":"estcourt","latitude":-29.01269,"longitude":29.86619,"serviceRadiusKm":100,"geonamesId":"1004962"},{"province":"KwaZulu-Natal","town":"Port Shepstone","slug":"port-shepstone","latitude":-30.74137,"longitude":30.45499,"serviceRadiusKm":100,"geonamesId":"964406"},{"province":"KwaZulu-Natal","town":"Pongola","slug":"pongola","latitude":-27.37808,"longitude":31.61904,"serviceRadiusKm":120,"geonamesId":"964574"},{"province":"KwaZulu-Natal","town":"Eshowe","slug":"eshowe","latitude":-28.88649,"longitude":31.4699,"serviceRadiusKm":100,"geonamesId":"1005040"},{"province":"Mpumalanga","town":"Mbombela","slug":"mbombela","latitude":-25.47512,"longitude":30.96935,"serviceRadiusKm":100,"geonamesId":"971534"},{"province":"Mpumalanga","town":"eMalahleni","slug":"emalahleni","latitude":-25.87133,"longitude":29.23323,"serviceRadiusKm":100,"geonamesId":"939270"},{"province":"Mpumalanga","town":"Middelburg","slug":"middelburg","latitude":-25.77507,"longitude":29.46482,"serviceRadiusKm":100,"geonamesId":"976361"},{"province":"Mpumalanga","town":"Secunda","slug":"secunda","latitude":-26.55,"longitude":29.16667,"serviceRadiusKm":100,"geonamesId":"956767"},{"province":"Mpumalanga","town":"Ermelo","slug":"ermelo","latitude":-26.53333,"longitude":29.98333,"serviceRadiusKm":100,"geonamesId":"1005125"},{"province":"Mpumalanga","town":"Standerton","slug":"standerton","latitude":-26.93366,"longitude":29.24152,"serviceRadiusKm":100,"geonamesId":"952747"},{"province":"Mpumalanga","town":"eMkhondo","slug":"emkhondo","latitude":-27.00706,"longitude":30.81323,"serviceRadiusKm":120,"geonamesId":"965241"},{"province":"Mpumalanga","town":"Komatipoort","slug":"komatipoort","latitude":-25.43321,"longitude":31.95478,"serviceRadiusKm":120,"geonamesId":"988290"},{"province":"Mpumalanga","town":"Malalane","slug":"malalane","latitude":-25.49489,"longitude":31.50891,"serviceRadiusKm":120,"geonamesId":"979837"},{"province":"Mpumalanga","town":"Delmas","slug":"delmas","latitude":-26.1466,"longitude":28.68322,"serviceRadiusKm":100,"geonamesId":"1011031"},{"province":"Limpopo","town":"Polokwane","slug":"polokwane","latitude":-23.90449,"longitude":29.46885,"serviceRadiusKm":100,"geonamesId":"965289"},{"province":"Limpopo","town":"Tzaneen","slug":"tzaneen","latitude":-23.83322,"longitude":30.16351,"serviceRadiusKm":100,"geonamesId":"946973"},{"province":"Limpopo","town":"Makhado","slug":"makhado","latitude":-23.04385,"longitude":29.90319,"serviceRadiusKm":120,"geonamesId":"981827"},{"province":"Limpopo","town":"Mokopane","slug":"mokopane","latitude":-24.19436,"longitude":29.00974,"serviceRadiusKm":100,"geonamesId":"964315"},{"province":"Limpopo","town":"Bela-Bela","slug":"bela-bela","latitude":-24.88333,"longitude":28.28333,"serviceRadiusKm":100,"geonamesId":"941966"},{"province":"Limpopo","town":"Lephalale","slug":"lephalale","latitude":-23.66607,"longitude":27.74477,"serviceRadiusKm":150,"geonamesId":"7730334"},{"province":"Limpopo","town":"Groblersdal","slug":"groblersdal","latitude":-25.16843,"longitude":29.39412,"serviceRadiusKm":110,"geonamesId":"999964"},{"province":"Limpopo","town":"Hoedspruit","slug":"hoedspruit","latitude":-24.35122,"longitude":30.95332,"serviceRadiusKm":120,"geonamesId":"996195"},{"province":"Limpopo","town":"Phalaborwa","slug":"phalaborwa","latitude":-23.94299,"longitude":31.14107,"serviceRadiusKm":120,"geonamesId":"965528"},{"province":"Limpopo","town":"Musina","slug":"musina","latitude":-22.34881,"longitude":30.04074,"serviceRadiusKm":160,"geonamesId":"8030223"},{"province":"North West","town":"Rustenburg","slug":"rustenburg","latitude":-25.66756,"longitude":27.24208,"serviceRadiusKm":100,"geonamesId":"958724"},{"province":"North West","town":"Mahikeng","slug":"mahikeng","latitude":-25.86522,"longitude":25.64421,"serviceRadiusKm":110,"geonamesId":"980595"},{"province":"North West","town":"Klerksdorp","slug":"klerksdorp","latitude":-26.85213,"longitude":26.66672,"serviceRadiusKm":100,"geonamesId":"989921"},{"province":"North West","town":"Potchefstroom","slug":"potchefstroom","latitude":-26.71667,"longitude":27.1,"serviceRadiusKm":100,"geonamesId":"964349"},{"province":"North West","town":"Brits","slug":"brits","latitude":-25.63473,"longitude":27.78022,"serviceRadiusKm":100,"geonamesId":"1015621"},{"province":"North West","town":"Lichtenburg","slug":"lichtenburg","latitude":-26.152,"longitude":26.15968,"serviceRadiusKm":100,"geonamesId":"982899"},{"province":"North West","town":"Vryburg","slug":"vryburg","latitude":-26.95659,"longitude":24.7284,"serviceRadiusKm":140,"geonamesId":"942511"},{"province":"North West","town":"Schweizer-Reneke","slug":"schweizer-reneke","latitude":-27.18871,"longitude":25.32931,"serviceRadiusKm":120,"geonamesId":"956907"},{"province":"North West","town":"Wolmaransstad","slug":"wolmaransstad","latitude":-27.1974,"longitude":25.98311,"serviceRadiusKm":120,"geonamesId":"938457"},{"province":"North West","town":"Zeerust","slug":"zeerust","latitude":-25.53695,"longitude":26.07512,"serviceRadiusKm":120,"geonamesId":"937136"}]$seed$::jsonb) AS seed(
    province text,
    town text,
    slug text,
    latitude double precision,
    longitude double precision,
    "serviceRadiusKm" integer,
    "geonamesId" text
  )
)
INSERT INTO public.aim4price_assistance_locations (
  id, service_key, province, town, town_slug, latitude, longitude,
  service_radius_km, geonames_id, enabled, created_at, updated_at
)
SELECT
  'aim4price-assistance-' || account.service_key || '-' || location.slug,
  account.service_key,
  location.province,
  location.town,
  location.slug,
  location.latitude,
  location.longitude,
  location."serviceRadiusKm",
  location."geonamesId",
  true,
  now(),
  now()
FROM public.aim4price_assistance_accounts account
CROSS JOIN location_seed location
WHERE account.service_key IN ('finance', 'accounting', 'insurance', 'dealer', 'licensing')
ON CONFLICT (service_key, town_slug) DO UPDATE SET
  id = excluded.id,
  province = excluded.province,
  town = excluded.town,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  service_radius_km = excluded.service_radius_km,
  geonames_id = excluded.geonames_id,
  updated_at = now();

COMMIT;

-- Read-only verification: expect five login accounts and 100 locations per service.
SELECT
  auth_user.id AS user_id,
  auth_user.email,
  auth_user."emailVerified" AS email_verified,
  profile.account_type,
  profile.account_subtype,
  profile.account_status,
  EXISTS (
    SELECT 1
    FROM public."account" credential
    WHERE credential."userId" = auth_user.id
      AND credential."providerId" = 'credential'
      AND coalesce(credential.password, '') <> ''
  ) AS password_set
FROM public."user" auth_user
JOIN public.account_profiles profile
  ON profile.user_id = auth_user.id
WHERE auth_user.id IN (
  'aim4price-assistance-finance',
  'aim4price-assistance-accounting',
  'aim4price-assistance-insurance',
  'aim4price-assistance-dealer',
  'aim4price-assistance-licensing'
)
ORDER BY auth_user.email;

SELECT
  account.service_key,
  account.notification_email,
  account.routing_email,
  account.enabled,
  count(location.id) AS service_locations,
  count(location.id) FILTER (WHERE location.enabled) AS enabled_locations
FROM public.aim4price_assistance_accounts account
LEFT JOIN public.aim4price_assistance_locations location
  ON location.service_key = account.service_key
GROUP BY
  account.service_key,
  account.notification_email,
  account.routing_email,
  account.enabled
ORDER BY account.service_key;
