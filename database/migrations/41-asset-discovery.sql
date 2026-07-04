-- Asset Discovery: dealer-only asset discovery enquiries.

create extension if not exists pgcrypto;

create table if not exists public.asset_discovery_enquiries (
  id uuid primary key default gen_random_uuid(),
  asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
  owner_user_id text not null,
  dealer_user_id text not null,
  status text not null default 'pending',
  dealer_message text not null default '',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  denied_at timestamptz,
  request_again_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.asset_discovery_enquiries
  add column if not exists asset_register_item_id uuid references public.asset_register_items(id) on delete cascade,
  add column if not exists owner_user_id text,
  add column if not exists dealer_user_id text,
  add column if not exists status text not null default 'pending',
  add column if not exists dealer_message text not null default '',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists denied_at timestamptz,
  add column if not exists request_again_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.asset_discovery_enquiries
set status = case
  when status in ('pending', 'approved', 'temporarily_denied') then status
  when status in ('denied', 'declined') then 'temporarily_denied'
  else 'pending'
end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'asset_discovery_enquiries_status_check'
      and conrelid = 'public.asset_discovery_enquiries'::regclass
  ) then
    alter table public.asset_discovery_enquiries
      add constraint asset_discovery_enquiries_status_check
      check (status in ('pending', 'approved', 'temporarily_denied'));
  end if;
end $$;

create index if not exists idx_asset_discovery_owner_status_created
  on public.asset_discovery_enquiries(owner_user_id, status, created_at desc);

create index if not exists idx_asset_discovery_dealer_status_created
  on public.asset_discovery_enquiries(dealer_user_id, status, created_at desc);

create index if not exists idx_asset_discovery_asset_dealer
  on public.asset_discovery_enquiries(asset_register_item_id, dealer_user_id);

create unique index if not exists idx_asset_discovery_pending_once
  on public.asset_discovery_enquiries(asset_register_item_id, dealer_user_id)
  where status = 'pending';
