-- 15-account-role-split-and-partner-notes.sql
-- Splits insurer accounts out of Finance and adds shared-register partner notes.

create extension if not exists pgcrypto;

alter table account_profiles
  add column if not exists account_subtype text,
  add column if not exists partner_directory_enabled boolean not null default false,
  add column if not exists partner_directory_status text not null default 'approved',
  add column if not exists partner_description text,
  add column if not exists partner_latitude double precision,
  add column if not exists partner_longitude double precision,
  add column if not exists partner_service_radius_km integer,
  add column if not exists partner_brand_focus text,
  add column if not exists partner_services text;

update account_profiles
set account_type = 'insurance'
where lower(trim(coalesce(account_type, ''))) in ('insurer', 'insurance', 'broker')
   or lower(trim(coalesce(account_subtype, ''))) in ('insurer', 'short-term-insurer', 'insurance-broker', 'broker');

update account_profiles
set account_type = 'finance'
where lower(trim(coalesce(account_type, ''))) in ('bank', 'finance-house', 'accountant', 'accounting', 'finance');

update account_profiles
set account_type = 'dealer'
where lower(trim(coalesce(account_type, ''))) in ('dealer', 'auction-house', 'auctioneer');

update account_profiles
set account_type = 'owner'
where account_type is null
   or lower(trim(account_type)) not in ('owner', 'dealer', 'finance', 'insurance');

update account_profiles
set account_subtype = 'short-term-insurer'
where account_type = 'insurance'
  and (
    account_subtype is null
    or lower(trim(account_subtype)) in ('', 'insurer', 'insurance', 'broker', 'insurance-broker')
  );

update account_profiles
set account_subtype = 'auctioneer'
where account_type = 'dealer'
  and lower(trim(coalesce(account_subtype, ''))) in ('auction-house', 'auctioneer');

update account_profiles
set account_subtype = 'bank'
where account_type = 'finance'
  and lower(trim(coalesce(account_subtype, ''))) in ('', 'insurer', 'insurance', 'broker', 'insurance-broker');

create table if not exists asset_partner_notes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  partner_user_id text not null,
  asset_register_item_id uuid not null,
  note_text text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  noted_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table asset_partner_notes
  add column if not exists owner_user_id text,
  add column if not exists partner_user_id text,
  add column if not exists asset_register_item_id uuid,
  add column if not exists note_text text,
  add column if not exists status text not null default 'open',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists noted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_asset_partner_notes_owner_status
  on asset_partner_notes(owner_user_id, status, created_at desc);

create index if not exists idx_asset_partner_notes_partner_status
  on asset_partner_notes(partner_user_id, status, created_at desc);

create index if not exists idx_asset_partner_notes_asset_open
  on asset_partner_notes(asset_register_item_id, status, created_at desc);

create index if not exists idx_account_profiles_partner_directory
  on account_profiles(account_type, partner_directory_enabled, partner_directory_status, province, town_city);
