-- Owner Discovery participation and requester identity generalization.
-- Existing and new owner accounts remain opted out unless they explicitly opt in.

alter table public.account_profiles
  add column if not exists discovery_participation_enabled boolean not null default false;

create index if not exists idx_account_profiles_discovery_participation
  on public.account_profiles(account_type, account_status, discovery_participation_enabled);

alter table public.asset_discovery_enquiries
  add column if not exists requester_user_id text,
  add column if not exists requester_account_type text,
  add column if not exists requester_message text not null default '';

update public.asset_discovery_enquiries
set
  requester_user_id = coalesce(nullif(trim(requester_user_id), ''), dealer_user_id),
  requester_account_type = case
    when requester_account_type in ('owner', 'dealer') then requester_account_type
    else 'dealer'
  end,
  requester_message = coalesce(nullif(requester_message, ''), dealer_message, '');

alter table public.asset_discovery_enquiries
  alter column requester_user_id set not null,
  alter column requester_account_type set not null,
  alter column requester_account_type set default 'dealer',
  alter column dealer_user_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'asset_discovery_enquiries_requester_type_check'
      and conrelid = 'public.asset_discovery_enquiries'::regclass
  ) then
    alter table public.asset_discovery_enquiries
      add constraint asset_discovery_enquiries_requester_type_check
      check (requester_account_type in ('owner', 'dealer'));
  end if;
end $$;

alter table public.asset_discovery_enquiries
  drop constraint if exists asset_discovery_enquiries_status_check;

alter table public.asset_discovery_enquiries
  add constraint asset_discovery_enquiries_status_check
  check (status in (
    'pending',
    'approved',
    'temporarily_denied',
    'retracted',
    'expired',
    'revoked'
  ));

drop index if exists public.idx_asset_discovery_pending_once;

create index if not exists idx_asset_discovery_requester_status_created
  on public.asset_discovery_enquiries(requester_user_id, status, created_at desc);

create index if not exists idx_asset_discovery_asset_requester
  on public.asset_discovery_enquiries(asset_register_item_id, requester_user_id);

create unique index if not exists idx_asset_discovery_requester_pending_once
  on public.asset_discovery_enquiries(asset_register_item_id, requester_user_id)
  where status = 'pending';

create index if not exists idx_asset_discovery_requester_approval_expiry
  on public.asset_discovery_enquiries(requester_user_id, approved_at desc)
  where status = 'approved';
