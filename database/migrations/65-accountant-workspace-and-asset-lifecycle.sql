-- 65-accountant-workspace-and-asset-lifecycle.sql
-- Live accountant access remains a subtype of Finance. This migration adds
-- revocable register permissions, asset lifecycle history and a deliberately
-- simple accountant-supplied book-value reference (not an accounting engine).
-- Safe to run more than once after migrations 13, 20 and 37.

begin;

create extension if not exists pgcrypto;

alter table if exists public.asset_leads
  add column if not exists access_status text not null default 'active',
  add column if not exists access_removed_at timestamptz,
  add column if not exists allow_direct_updates boolean not null default false,
  add column if not exists include_fuel_ledger boolean not null default false,
  add column if not exists include_cost_ledger boolean not null default false;

update public.asset_leads
set
  access_status = case when status = 'closed' then 'removed' else coalesce(nullif(access_status, ''), 'active') end,
  allow_direct_updates = case
    when lower(coalesce(included_sections_json ->> 'allowDirectUpdates', '')) in ('true', '1', 'yes', 'on', 'enabled') then true
    when included_sections_json ? 'allowDirectUpdates' then false
    else coalesce(allow_direct_updates, false)
  end,
  include_fuel_ledger = case
    when lower(coalesce(included_sections_json ->> 'includeFuelLedger', '')) in ('true', '1', 'yes', 'on', 'enabled') then true
    when included_sections_json ? 'includeFuelLedger' then false
    else coalesce(include_fuel_ledger, false)
  end,
  include_cost_ledger = case
    when lower(coalesce(included_sections_json ->> 'includeCostLedger', '')) in ('true', '1', 'yes', 'on', 'enabled') then true
    when included_sections_json ? 'includeCostLedger' then false
    else coalesce(include_cost_ledger, false)
  end
where lead_type = 'finance'
  and coalesce(included_sections_json ->> 'source', '') = 'full_asset_register';

alter table if exists public.asset_leads
  drop constraint if exists asset_leads_access_status_check;

alter table if exists public.asset_leads
  add constraint asset_leads_access_status_check
    check (access_status in ('active', 'removed', 'revoked'));

create index if not exists idx_asset_leads_accountant_register_access
  on public.asset_leads(partner_user_id, access_status, updated_at desc)
  where lead_type = 'finance';

alter table if exists public.asset_register_items
  add column if not exists lifecycle_state text not null default 'active';

update public.asset_register_items
set lifecycle_state = 'active'
where lifecycle_state is null or lifecycle_state not in ('active', 'disposed', 'archived');

alter table if exists public.asset_register_items
  drop constraint if exists asset_register_items_lifecycle_state_check;

alter table if exists public.asset_register_items
  add constraint asset_register_items_lifecycle_state_check
    check (lifecycle_state in ('active', 'disposed', 'archived'));

create index if not exists idx_asset_register_items_active_register
  on public.asset_register_items(user_id, register_id, updated_at desc)
  where lifecycle_state = 'active';

create table if not exists public.asset_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  register_id uuid,
  asset_register_item_id uuid not null,
  event_type text not null,
  reason text,
  effective_date date not null,
  amount_ex_vat numeric(14,2),
  note text,
  source_document_reference text,
  actor_user_id text not null,
  actor_name text,
  actor_organisation text,
  asset_snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.asset_lifecycle_events
  add column if not exists owner_user_id text,
  add column if not exists register_id uuid,
  add column if not exists asset_register_item_id uuid,
  add column if not exists event_type text,
  add column if not exists reason text,
  add column if not exists effective_date date,
  add column if not exists amount_ex_vat numeric(14,2),
  add column if not exists note text,
  add column if not exists source_document_reference text,
  add column if not exists actor_user_id text,
  add column if not exists actor_name text,
  add column if not exists actor_organisation text,
  add column if not exists asset_snapshot_json jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

alter table public.asset_lifecycle_events
  drop constraint if exists asset_lifecycle_events_event_type_check;

alter table public.asset_lifecycle_events
  add constraint asset_lifecycle_events_event_type_check
    check (event_type in ('acquired', 'existing_added', 'disposed', 'deleted_duplicate'));

create index if not exists idx_asset_lifecycle_owner_register_date
  on public.asset_lifecycle_events(owner_user_id, register_id, effective_date desc, created_at desc);

create index if not exists idx_asset_lifecycle_asset_date
  on public.asset_lifecycle_events(asset_register_item_id, effective_date desc, created_at desc);

create table if not exists public.asset_accounting_values (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
  carrying_value numeric(14,2) not null,
  as_at_date date not null,
  source_reference text,
  updated_by_user_id text not null,
  updated_by_name text,
  updated_by_organisation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_asset_accounting_values_current
  on public.asset_accounting_values(owner_user_id, asset_register_item_id);

create table if not exists public.asset_accountant_documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  accountant_user_id text not null,
  accountant_organisation text,
  asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
  access_lead_id uuid not null references public.asset_leads(id) on delete restrict,
  upload_id text not null,
  upload_url text not null,
  file_name text not null,
  content_type text,
  byte_size integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_asset_accountant_documents_asset
  on public.asset_accountant_documents(owner_user_id, asset_register_item_id, created_at desc);

commit;
