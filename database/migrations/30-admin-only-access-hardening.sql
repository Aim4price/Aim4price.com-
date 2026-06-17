-- Aim4price admin-only access hardening and manual activation safety.
-- Run after 29-manual-activation-and-introduced-by.sql.
-- Idempotent: safe to run more than once.

begin;

alter table public.account_profiles
  add column if not exists account_status text,
  add column if not exists introduced_by_option text,
  add column if not exists introduced_by_name text;

-- Normalize existing profile values without downgrading already-active normal users.
update public.account_profiles
set
  account_status = case
    when account_status is null or trim(account_status) = '' then 'pending_payment'
    when lower(replace(trim(account_status), '-', '_')) in ('pending_payment', 'active', 'suspended')
      then lower(replace(trim(account_status), '-', '_'))
    else 'pending_payment'
  end,
  introduced_by_option = case
    when lower(replace(trim(coalesce(introduced_by_option, '')), '-', '_')) in ('kuyler', 'andre', 'direct', 'other')
      then lower(replace(trim(introduced_by_option), '-', '_'))
    when lower(replace(trim(coalesce(introduced_by_option, '')), '-', '_')) in ('no_one', 'none', 'direct_signup')
      then 'direct'
    else 'direct'
  end,
  introduced_by_name = nullif(trim(coalesce(introduced_by_name, '')), ''),
  updated_at = now();

alter table public.account_profiles
  alter column account_status set default 'pending_payment',
  alter column account_status set not null,
  alter column introduced_by_option set default 'direct',
  alter column introduced_by_option set not null;

alter table public.account_profiles
  drop constraint if exists account_profiles_account_status_check;

alter table public.account_profiles
  add constraint account_profiles_account_status_check
  check (account_status in ('pending_payment', 'active', 'suspended'));

alter table public.account_profiles
  drop constraint if exists account_profiles_introduced_by_option_check;

alter table public.account_profiles
  add constraint account_profiles_introduced_by_option_check
  check (introduced_by_option in ('kuyler', 'andre', 'direct', 'other'));

create index if not exists idx_account_profiles_account_status
  on public.account_profiles(account_status);

create index if not exists idx_account_profiles_introduced_by
  on public.account_profiles(introduced_by_option, introduced_by_name);

do $$
begin
  if to_regclass('public."user"') is not null then
    -- Backfill missing account_profiles rows. Normal accounts start pending_payment.
    insert into public.account_profiles (
      user_id,
      display_name,
      account_type,
      account_subtype,
      account_status,
      introduced_by_option,
      created_at,
      updated_at
    )
    select
      u.id,
      nullif(trim(coalesce(u.name, '')), ''),
      'owner',
      'farmer',
      case
        when lower(trim(coalesce(u.email, ''))) = 'aim4price@gmail.com'
          then 'active'
        else 'pending_payment'
      end,
      'direct',
      now(),
      now()
    from public."user" u
    where not exists (
      select 1
      from public.account_profiles ap
      where ap.user_id = u.id
    );

    -- The admin account must never be locked by payment/status checks.
    update public.account_profiles ap
    set account_status = 'active', updated_at = now()
    from public."user" u
    where ap.user_id = u.id
      and lower(trim(coalesce(u.email, ''))) = 'aim4price@gmail.com';
  end if;
end $$;

-- Optional current-flow reset:
-- If you intentionally want every existing non-admin user to require manual approval again,
-- run the statement below manually after reviewing the table. It is intentionally commented out.
--
-- update public.account_profiles ap
-- set account_status = 'pending_payment', updated_at = now()
-- from public."user" u
-- where ap.user_id = u.id
--   and lower(trim(coalesce(u.email, ''))) <> 'aim4price@gmail.com';

commit;
