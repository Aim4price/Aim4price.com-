-- Adds Aim4price Fuel Ledger storage units, QR-protected fuel issue events, and
-- fuel-link columns for the existing asset QR scan trail.
-- Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS public.asset_register_items
  ADD COLUMN IF NOT EXISTS public_asset_code text,
  ADD COLUMN IF NOT EXISTS plate_label text,
  ADD COLUMN IF NOT EXISTS qr_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_known_lat double precision,
  ADD COLUMN IF NOT EXISTS last_known_lng double precision,
  ADD COLUMN IF NOT EXISTS last_known_location_text text,
  ADD COLUMN IF NOT EXISTS fuel_percent integer;

CREATE TABLE IF NOT EXISTS public.asset_scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  actor_type text NOT NULL DEFAULT 'scan_pin',
  operator_name text,
  hours numeric(14,2),
  fuel_percent integer,
  condition text,
  note text,
  photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  latitude double precision,
  longitude double precision,
  location_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.asset_scan_events
  ADD COLUMN IF NOT EXISTS operator_name text,
  ADD COLUMN IF NOT EXISTS hours numeric(14,2),
  ADD COLUMN IF NOT EXISTS fuel_percent integer,
  ADD COLUMN IF NOT EXISTS fuel_litres numeric(12,2),
  ADD COLUMN IF NOT EXISTS fuel_storage_id uuid,
  ADD COLUMN IF NOT EXISTS fuel_storage_event_id uuid,
  ADD COLUMN IF NOT EXISTS condition text,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_text text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.fuel_storage_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  fuel_type text NOT NULL DEFAULT 'diesel',
  capacity_litres numeric(12,2),
  current_litres numeric(12,2) NOT NULL DEFAULT 0,
  reorder_level_litres numeric(12,2),
  location_label text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  public_fuel_storage_code text NOT NULL UNIQUE,
  pin_hash text,
  pin_enabled boolean NOT NULL DEFAULT true,
  pin_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.fuel_storage_units
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS fuel_type text NOT NULL DEFAULT 'diesel',
  ADD COLUMN IF NOT EXISTS capacity_litres numeric(12,2),
  ADD COLUMN IF NOT EXISTS current_litres numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_level_litres numeric(12,2),
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS public_fuel_storage_code text,
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pin_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.fuel_storage_units
SET
  current_litres = greatest(0, coalesce(current_litres, 0)),
  status = CASE WHEN lower(coalesce(status, '')) = 'archived' THEN 'archived' ELSE 'active' END,
  fuel_type = coalesce(NULLIF(trim(fuel_type), ''), 'diesel'),
  public_fuel_storage_code = coalesce(NULLIF(trim(public_fuel_storage_code), ''), 'FUEL-' || upper(substr(md5(id::text), 1, 10))),
  updated_at = coalesce(updated_at, now()),
  created_at = coalesce(created_at, now());

CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_storage_units_public_code
  ON public.fuel_storage_units(public_fuel_storage_code);

CREATE INDEX IF NOT EXISTS idx_fuel_storage_units_user_status
  ON public.fuel_storage_units(user_id, status, updated_at DESC);

ALTER TABLE IF EXISTS public.fuel_storage_units
  DROP CONSTRAINT IF EXISTS fuel_storage_units_status_check;

ALTER TABLE IF EXISTS public.fuel_storage_units
  ADD CONSTRAINT fuel_storage_units_status_check CHECK (status IN ('active', 'archived'));

CREATE TABLE IF NOT EXISTS public.fuel_storage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_id uuid NOT NULL REFERENCES public.fuel_storage_units(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  event_type text NOT NULL,
  asset_register_item_id text,
  litres numeric(12,2) NOT NULL DEFAULT 0,
  storage_level_before_litres numeric(12,2),
  storage_level_after_litres numeric(12,2),
  asset_fuel_percent_before integer,
  asset_fuel_percent_after integer,
  asset_usage_reading numeric(14,2),
  operator_name text,
  note text,
  latitude double precision,
  longitude double precision,
  location_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.fuel_storage_events
  ADD COLUMN IF NOT EXISTS storage_id uuid,
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS asset_register_item_id text,
  ADD COLUMN IF NOT EXISTS litres numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_level_before_litres numeric(12,2),
  ADD COLUMN IF NOT EXISTS storage_level_after_litres numeric(12,2),
  ADD COLUMN IF NOT EXISTS asset_fuel_percent_before integer,
  ADD COLUMN IF NOT EXISTS asset_fuel_percent_after integer,
  ADD COLUMN IF NOT EXISTS asset_usage_reading numeric(14,2),
  ADD COLUMN IF NOT EXISTS operator_name text,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_text text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.fuel_storage_events
  DROP CONSTRAINT IF EXISTS fuel_storage_events_event_type_check;

ALTER TABLE IF EXISTS public.fuel_storage_events
  ADD CONSTRAINT fuel_storage_events_event_type_check CHECK (event_type IN ('opening_balance', 'stock_in', 'asset_issue', 'dip', 'adjustment'));

CREATE INDEX IF NOT EXISTS idx_fuel_storage_events_user_created
  ON public.fuel_storage_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fuel_storage_events_storage_created
  ON public.fuel_storage_events(storage_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fuel_storage_events_asset_created
  ON public.fuel_storage_events(asset_register_item_id, created_at DESC);

COMMENT ON TABLE public.fuel_storage_units IS
  'Fuel Ledger storage units such as main tanks, diesel bowsers, and drums. Each unit can have its own QR code and scan PIN.';

COMMENT ON TABLE public.fuel_storage_events IS
  'Fuel Ledger transactions for stock in, dips, adjustments, and asset issue events captured through storage QR codes or owner pages.';
