-- Aim4price manual account activation and introduced-by tracking.
-- Run this after the Better Auth core tables exist.

begin;

alter table public.account_profiles
  add column if not exists account_status text,
  add column if not exists introduced_by_option text,
  add column if not exists introduced_by_name text;

-- Existing profiles were created before manual payment approval existed.
-- Keep them active instead of unexpectedly locking live accounts.
update public.account_profiles
set account_status = 'active'
where account_status is null or trim(account_status) = '';

update public.account_profiles
set account_status = lower(replace(trim(account_status), '-', '_'));

update public.account_profiles
set account_status = 'pending_payment'
where account_status not in ('pending_payment', 'active', 'suspended');

update public.account_profiles
set introduced_by_option = case
  when lower(replace(trim(coalesce(introduced_by_option, '')), '-', '_')) in ('kuyler', 'andre', 'direct', 'other')
    then lower(replace(trim(introduced_by_option), '-', '_'))
  when lower(replace(trim(coalesce(introduced_by_option, '')), '-', '_')) in ('no_one', 'none', 'direct_signup')
    then 'direct'
  else 'direct'
end,
introduced_by_name = nullif(trim(coalesce(introduced_by_name, '')), '');

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

-- Backfill profiles for existing Better Auth users that do not yet have account_profiles rows.
do $$
begin
  if to_regclass('public."user"') is not null then
    execute '
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
        nullif(trim(coalesce(u.name, '''')), ''''),
        ''owner'',
        ''farmer'',
        case when lower(trim(coalesce(u.email, ''''))) = ''aim4price@gmail.com'' then ''active'' else ''active'' end,
        ''direct'',
        now(),
        now()
      from public."user" u
      where not exists (
        select 1
        from public.account_profiles ap
        where ap.user_id = u.id
      )
    ';

    execute '
      update public.account_profiles ap
      set account_status = ''active'', updated_at = now()
      from public."user" u
      where ap.user_id = u.id
        and lower(trim(coalesce(u.email, ''''))) = ''aim4price@gmail.com''
    ';
  end if;
end $$;

commit;
