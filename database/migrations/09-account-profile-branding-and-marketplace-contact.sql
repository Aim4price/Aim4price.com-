-- Account page styling/support update
-- Adds editable full-name/profile branding fields and buyer-facing marketplace contact fields.

create table if not exists account_profiles (
  user_id text primary key,
  display_name text,
  logo_url text,
  business_name text,
  phone text,
  account_type text not null default 'owner',
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
  scan_pin_enabled boolean not null default false,
  scan_pin_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table account_profiles
  add column if not exists display_name text,
  add column if not exists logo_url text,
  add column if not exists business_name text,
  add column if not exists phone text,
  add column if not exists account_type text not null default 'owner',
  add column if not exists vat_number text,
  add column if not exists province text,
  add column if not exists town_city text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists notes text,
  add column if not exists marketplace_seller_name text,
  add column if not exists marketplace_phone text,
  add column if not exists marketplace_email text,
  add column if not exists marketplace_location text,
  add column if not exists scan_pin_hash text,
  add column if not exists scan_pin_enabled boolean not null default false,
  add column if not exists scan_pin_updated_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_account_profiles_user_id
  on account_profiles(user_id);
