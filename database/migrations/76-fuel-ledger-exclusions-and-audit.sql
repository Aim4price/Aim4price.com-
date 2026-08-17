begin;

alter table if exists public.fuel_storage_events
  add column if not exists work_use_excluded boolean not null default false,
  add column if not exists work_use_exclusion_reason text;

alter table if exists public.fuel_slips
  add column if not exists work_use_excluded boolean not null default false,
  add column if not exists work_use_exclusion_reason text,
  add column if not exists record_status text not null default 'active',
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by_user_id text,
  add column if not exists voided_by_name text,
  add column if not exists voided_by_email text,
  add column if not exists void_reason text;

update public.fuel_slips
set record_status = case when record_status = 'voided' then 'voided' else 'active' end;

alter table if exists public.fuel_slips drop constraint if exists fuel_slips_record_status_check;
alter table if exists public.fuel_slips
  add constraint fuel_slips_record_status_check check (record_status in ('active', 'voided'));

create table if not exists public.fuel_asset_exclusions (
  user_id text not null,
  asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
  is_excluded boolean not null default true,
  reason text,
  updated_by_user_id text,
  updated_by_name text,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, asset_register_item_id)
);

create index if not exists idx_fuel_asset_exclusions_user
  on public.fuel_asset_exclusions(user_id, is_excluded, updated_at desc);

create table if not exists public.fuel_ledger_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  record_type text not null,
  record_id text not null,
  action text not null,
  actor_user_id text,
  actor_name text,
  actor_email text,
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_fuel_ledger_audit_record
  on public.fuel_ledger_audit_events(user_id, record_type, record_id, created_at desc);

commit;
