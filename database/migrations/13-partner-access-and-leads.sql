-- Aim4price Partner Access System V1
-- Adds account roles, partner-directory fields, shared-register access grants,
-- asset quote leads, and an audit trail for sharing/lead actions.
-- Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.account_profiles (
  user_id text PRIMARY KEY,
  display_name text,
  logo_url text,
  business_name text,
  phone text,
  account_type text NOT NULL DEFAULT 'owner',
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
  scan_pin_hash text,
  scan_pin_enabled boolean NOT NULL DEFAULT false,
  scan_pin_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.account_profiles
  ADD COLUMN IF NOT EXISTS partner_directory_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_directory_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS partner_description text,
  ADD COLUMN IF NOT EXISTS partner_latitude double precision,
  ADD COLUMN IF NOT EXISTS partner_longitude double precision,
  ADD COLUMN IF NOT EXISTS partner_service_radius_km integer,
  ADD COLUMN IF NOT EXISTS partner_brand_focus text,
  ADD COLUMN IF NOT EXISTS partner_services text;

UPDATE public.account_profiles
SET account_type = CASE lower(trim(account_type))
  WHEN 'bank' THEN 'finance'
  WHEN 'broker' THEN 'insurance'
  WHEN 'insurer' THEN 'insurance'
  WHEN 'insurance' THEN 'insurance'
  WHEN 'finance' THEN 'finance'
  WHEN 'dealer' THEN 'dealer'
  ELSE 'owner'
END;

ALTER TABLE IF EXISTS public.account_profiles
  DROP CONSTRAINT IF EXISTS account_profiles_account_type_check,
  ADD CONSTRAINT account_profiles_account_type_check
    CHECK (account_type IN ('owner', 'dealer', 'finance', 'insurance'));

ALTER TABLE IF EXISTS public.account_profiles
  DROP CONSTRAINT IF EXISTS account_profiles_partner_directory_status_check,
  ADD CONSTRAINT account_profiles_partner_directory_status_check
    CHECK (partner_directory_status IN ('approved', 'pending', 'hidden', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_account_profiles_partner_directory
  ON public.account_profiles(account_type, partner_directory_enabled, partner_directory_status, province, town_city);

CREATE TABLE IF NOT EXISTS public.asset_register_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  partner_user_id text NOT NULL,
  partner_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  permission_level text NOT NULL DEFAULT 'view',
  include_documents boolean NOT NULL DEFAULT true,
  include_scan_history boolean NOT NULL DEFAULT true,
  owner_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  declined_at timestamptz,
  last_viewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.asset_register_access_grants
  ADD COLUMN IF NOT EXISTS owner_user_id text,
  ADD COLUMN IF NOT EXISTS partner_user_id text,
  ADD COLUMN IF NOT EXISTS partner_type text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS permission_level text NOT NULL DEFAULT 'view',
  ADD COLUMN IF NOT EXISTS include_documents boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_scan_history boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS owner_message text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.asset_register_access_grants
  DROP CONSTRAINT IF EXISTS asset_register_access_grants_partner_type_check,
  ADD CONSTRAINT asset_register_access_grants_partner_type_check
    CHECK (partner_type IN ('dealer', 'finance', 'insurance'));

ALTER TABLE IF EXISTS public.asset_register_access_grants
  DROP CONSTRAINT IF EXISTS asset_register_access_grants_status_check,
  ADD CONSTRAINT asset_register_access_grants_status_check
    CHECK (status IN ('pending', 'active', 'revoked', 'declined'));

ALTER TABLE IF EXISTS public.asset_register_access_grants
  DROP CONSTRAINT IF EXISTS asset_register_access_grants_permission_check,
  ADD CONSTRAINT asset_register_access_grants_permission_check
    CHECK (permission_level IN ('view', 'suggest_updates', 'limited_update'));

CREATE INDEX IF NOT EXISTS idx_access_grants_owner_status
  ON public.asset_register_access_grants(owner_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_grants_partner_status
  ON public.asset_register_access_grants(partner_user_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_grants_open_unique
  ON public.asset_register_access_grants(owner_user_id, partner_user_id)
  WHERE status IN ('pending', 'active');

CREATE TABLE IF NOT EXISTS public.asset_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  partner_user_id text NOT NULL,
  asset_register_item_id uuid NOT NULL,
  lead_type text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  asset_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  included_sections_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_message text,
  owner_contact_name text,
  owner_contact_phone text,
  owner_contact_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  accepted_at timestamptz,
  quoted_at timestamptz,
  declined_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.asset_leads
  ADD COLUMN IF NOT EXISTS owner_user_id text,
  ADD COLUMN IF NOT EXISTS partner_user_id text,
  ADD COLUMN IF NOT EXISTS asset_register_item_id uuid,
  ADD COLUMN IF NOT EXISTS lead_type text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS asset_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS included_sections_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS owner_message text,
  ADD COLUMN IF NOT EXISTS owner_contact_name text,
  ADD COLUMN IF NOT EXISTS owner_contact_phone text,
  ADD COLUMN IF NOT EXISTS owner_contact_email text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS quoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.asset_leads
  DROP CONSTRAINT IF EXISTS asset_leads_lead_type_check,
  ADD CONSTRAINT asset_leads_lead_type_check
    CHECK (lead_type IN ('finance', 'insurance', 'replacement_quote'));

ALTER TABLE IF EXISTS public.asset_leads
  DROP CONSTRAINT IF EXISTS asset_leads_status_check,
  ADD CONSTRAINT asset_leads_status_check
    CHECK (status IN ('sent', 'viewed', 'accepted', 'quoted', 'declined', 'closed'));

CREATE INDEX IF NOT EXISTS idx_asset_leads_owner_status
  ON public.asset_leads(owner_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_leads_partner_status
  ON public.asset_leads(partner_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_leads_asset
  ON public.asset_leads(asset_register_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.access_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text,
  actor_user_id text NOT NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.access_audit_events
  ADD COLUMN IF NOT EXISTS owner_user_id text,
  ADD COLUMN IF NOT EXISTS actor_user_id text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_access_audit_owner_created
  ON public.access_audit_events(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_audit_actor_created
  ON public.access_audit_events(actor_user_id, created_at DESC);
