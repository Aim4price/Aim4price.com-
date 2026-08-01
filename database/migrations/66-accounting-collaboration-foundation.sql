-- 66-accounting-collaboration-foundation.sql
-- Adds client-level finance agreements, dated accounting book values,
-- recurring commitments and lightweight accountant review records.
-- It deliberately does not add depreciation, journals, tax or GL logic.

begin;

create extension if not exists pgcrypto;

create table if not exists public.asset_finance_agreements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  agreement_name text not null,
  agreement_reference text,
  financier_name text,
  agreement_type text,
  agreement_status text not null default 'draft',
  agreement_scope text not null default 'unknown',
  start_date date,
  maturity_date date,
  original_amount numeric(14,2),
  instalment_amount numeric(14,2),
  instalment_frequency text,
  balloon_amount numeric(14,2),
  balloon_date date,
  interest_rate numeric(8,4),
  source_reference text,
  security_description text,
  accountant_note text,
  created_by_user_id text not null,
  updated_by_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.asset_finance_agreements
  drop constraint if exists asset_finance_agreements_status_check;
alter table public.asset_finance_agreements
  add constraint asset_finance_agreements_status_check
    check (agreement_status in ('draft', 'active', 'settled', 'refinanced', 'cancelled'));

alter table public.asset_finance_agreements
  drop constraint if exists asset_finance_agreements_scope_check;
alter table public.asset_finance_agreements
  add constraint asset_finance_agreements_scope_check
    check (agreement_scope in ('complete', 'partial', 'unknown'));

alter table public.asset_finance_agreements
  drop constraint if exists asset_finance_agreements_frequency_check;
alter table public.asset_finance_agreements
  add constraint asset_finance_agreements_frequency_check
    check (instalment_frequency is null or instalment_frequency in ('monthly', 'quarterly', 'six_monthly', 'annual'));

create index if not exists idx_asset_finance_agreements_owner_status
  on public.asset_finance_agreements(owner_user_id, agreement_status, updated_at desc);

create unique index if not exists idx_asset_finance_agreements_owner_reference
  on public.asset_finance_agreements(owner_user_id, lower(agreement_reference))
  where agreement_reference is not null and btrim(agreement_reference) <> '' and agreement_status <> 'cancelled';

create table if not exists public.asset_finance_agreement_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  finance_agreement_id uuid not null references public.asset_finance_agreements(id) on delete restrict,
  outstanding_balance numeric(14,2),
  outstanding_balance_date date,
  settlement_amount numeric(14,2),
  settlement_valid_date date,
  recorded_by_user_id text not null,
  source_reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_asset_finance_snapshots_latest
  on public.asset_finance_agreement_snapshots(owner_user_id, finance_agreement_id, created_at desc);

create table if not exists public.asset_finance_agreement_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  finance_agreement_id uuid not null references public.asset_finance_agreements(id) on delete restrict,
  asset_register_item_id uuid not null references public.asset_register_items(id) on delete restrict,
  link_role text not null,
  original_amount_allocation numeric(14,2),
  settlement_allocation numeric(14,2),
  allocation_date date,
  allocation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (finance_agreement_id, asset_register_item_id)
);

alter table public.asset_finance_agreement_assets
  drop constraint if exists asset_finance_agreement_assets_role_check;
alter table public.asset_finance_agreement_assets
  add constraint asset_finance_agreement_assets_role_check
    check (link_role in ('directly_financed', 'financed_acquisition', 'collateral_only'));

create index if not exists idx_asset_finance_links_asset
  on public.asset_finance_agreement_assets(owner_user_id, asset_register_item_id, updated_at desc);

create table if not exists public.asset_accounting_value_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  asset_register_item_id uuid not null references public.asset_register_items(id) on delete restrict,
  original_accounting_cost numeric(14,2),
  accounting_book_value numeric(14,2) not null,
  book_value_date date not null,
  accumulated_depreciation numeric(14,2),
  source_accounting_system text,
  source_reference text,
  accountant_note text,
  recorded_by_user_id text not null,
  recorded_by_name text,
  recorded_by_organisation text,
  created_at timestamptz not null default now()
);

create index if not exists idx_asset_accounting_book_values_latest
  on public.asset_accounting_value_snapshots(owner_user_id, asset_register_item_id, book_value_date desc, created_at desc);

alter table if exists public.asset_accounting_values
  add column if not exists original_accounting_cost numeric(14,2),
  add column if not exists accumulated_depreciation numeric(14,2),
  add column if not exists source_accounting_system text,
  add column if not exists accountant_note text;

create table if not exists public.asset_recurring_commitments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  description text not null,
  category text not null,
  amount numeric(14,2) not null,
  frequency text not null,
  start_date date not null,
  end_date date,
  renewal_date date,
  status text not null default 'active',
  source_reference text,
  note text,
  created_by_user_id text not null,
  updated_by_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.asset_recurring_commitments
  drop constraint if exists asset_recurring_commitments_frequency_check;
alter table public.asset_recurring_commitments
  add constraint asset_recurring_commitments_frequency_check
    check (frequency in ('monthly', 'quarterly', 'six_monthly', 'annual'));

alter table public.asset_recurring_commitments
  drop constraint if exists asset_recurring_commitments_status_check;
alter table public.asset_recurring_commitments
  add constraint asset_recurring_commitments_status_check
    check (status in ('active', 'ended', 'cancelled'));

create index if not exists idx_asset_recurring_commitments_owner_status
  on public.asset_recurring_commitments(owner_user_id, status, renewal_date, updated_at desc);

create table if not exists public.asset_recurring_commitment_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  recurring_commitment_id uuid not null references public.asset_recurring_commitments(id) on delete restrict,
  asset_register_item_id uuid not null references public.asset_register_items(id) on delete restrict,
  annual_allocation numeric(14,2),
  allocation_note text,
  created_at timestamptz not null default now(),
  unique (recurring_commitment_id, asset_register_item_id)
);

create index if not exists idx_asset_recurring_commitment_links
  on public.asset_recurring_commitment_assets(owner_user_id, asset_register_item_id, created_at desc);

create table if not exists public.asset_accounting_review_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  register_id uuid,
  asset_register_item_id uuid,
  finance_agreement_id uuid,
  issue_key text not null,
  issue_status text not null default 'open',
  severity text not null default 'review',
  note text,
  deferred_until date,
  reviewed_by_user_id text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.asset_accounting_review_items
  drop constraint if exists asset_accounting_review_items_status_check;
alter table public.asset_accounting_review_items
  add constraint asset_accounting_review_items_status_check
    check (issue_status in ('open', 'waiting_for_owner', 'deferred', 'reviewed', 'resolved'));

alter table public.asset_accounting_review_items
  drop constraint if exists asset_accounting_review_items_severity_check;
alter table public.asset_accounting_review_items
  add constraint asset_accounting_review_items_severity_check
    check (severity in ('information', 'review', 'attention'));

create index if not exists idx_asset_accounting_review_queue
  on public.asset_accounting_review_items(owner_user_id, register_id, issue_status, severity, updated_at desc);

create unique index if not exists idx_asset_accounting_review_issue
  on public.asset_accounting_review_items(owner_user_id, register_id, issue_key);

commit;
