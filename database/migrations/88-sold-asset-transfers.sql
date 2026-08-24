-- Records Aim4price sale influence and supports secure, one-time ownership
-- transfers without sharing account credentials. Safe to run more than once.

create extension if not exists pgcrypto;

alter table public.asset_register_items
  add column if not exists lifecycle_state text not null default 'active';

alter table public.asset_lifecycle_events
  add column if not exists aim4price_sale_influence text,
  add column if not exists transfer_status text,
  add column if not exists transfer_offer_id uuid,
  add column if not exists transferred_to_user_id text;

create table if not exists public.asset_transfer_offers (
  id uuid primary key,
  asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
  seller_user_id text not null,
  buyer_user_id text,
  sale_event_id uuid,
  asset_title text not null,
  asset_identifier text not null,
  asset_identifier_label text not null,
  asset_identifier_normalized text not null,
  code_hash text not null,
  code_hint text not null,
  transferable_upload_ids jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  claimed_at timestamptz,
  cancelled_at timestamptz,
  constraint asset_transfer_offers_status_check
    check (status in ('pending', 'claimed', 'cancelled'))
);

create unique index if not exists idx_asset_transfer_one_pending_per_asset
  on public.asset_transfer_offers(asset_register_item_id)
  where status = 'pending';

create index if not exists idx_asset_transfer_seller_status
  on public.asset_transfer_offers(seller_user_id, status, created_at desc);

create index if not exists idx_asset_transfer_identifier
  on public.asset_transfer_offers(asset_identifier_normalized, status, expires_at desc);

create table if not exists public.asset_transfer_claim_attempts (
  id uuid primary key default gen_random_uuid(),
  claimant_user_id text not null,
  identifier_fingerprint text not null,
  was_successful boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_asset_transfer_claim_attempts_user_time
  on public.asset_transfer_claim_attempts(claimant_user_id, attempted_at desc);

comment on table public.asset_transfer_offers is
  'One-time owner-to-owner asset transfer offers. Only a SHA-256 digest and four-character hint of each transfer code are retained.';

comment on column public.asset_lifecycle_events.aim4price_sale_influence is
  'Owner answer: yes, no or unsure when Aim4price asks whether it influenced a recorded sale.';
