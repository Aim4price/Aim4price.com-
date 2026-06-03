-- Multi Asset Register support.
-- Creates one default register per owner and links saved assets to a register.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.asset_registers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  business_name text not null,
  email text,
  phone text,
  address_line_1 text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.asset_registers
  add column if not exists user_id text,
  add column if not exists business_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists address_line_1 text,
  add column if not exists is_primary boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.asset_register_items
  add column if not exists register_id uuid;

insert into public.asset_registers (
  user_id,
  business_name,
  email,
  phone,
  address_line_1,
  is_primary,
  created_at,
  updated_at
)
select
  users.user_id,
  coalesce(nullif(trim(ap.business_name), ''), nullif(trim(ap.display_name), ''), 'Main Asset Register') as business_name,
  '' as email,
  coalesce(ap.phone, '') as phone,
  concat_ws(', ', nullif(trim(coalesce(ap.address_line_1, '')), ''), nullif(trim(coalesce(ap.address_line_2, '')), ''), nullif(trim(coalesce(ap.town_city, '')), ''), nullif(trim(coalesce(ap.province, '')), '')) as address_line_1,
  true,
  now(),
  now()
from (
  select distinct user_id from public.asset_register_items where user_id is not null and trim(user_id) <> ''
  union
  select user_id from public.account_profiles where user_id is not null and trim(user_id) <> ''
) users
left join public.account_profiles ap on ap.user_id = users.user_id
where not exists (
  select 1
  from public.asset_registers ar
  where ar.user_id = users.user_id
);

with first_register as (
  select distinct on (user_id)
    user_id,
    id
  from public.asset_registers
  order by user_id, is_primary desc, created_at asc, id asc
)
update public.asset_registers ar
set is_primary = (ar.id = first_register.id),
    updated_at = now()
from first_register
where ar.user_id = first_register.user_id;

update public.asset_register_items ai
set register_id = ar.id
from public.asset_registers ar
where ai.user_id = ar.user_id
  and ar.is_primary = true
  and ai.register_id is null;

create index if not exists idx_asset_registers_user_created
  on public.asset_registers(user_id, created_at desc);

create index if not exists idx_asset_registers_user_primary
  on public.asset_registers(user_id, is_primary);

create index if not exists idx_asset_register_items_register
  on public.asset_register_items(user_id, register_id);
