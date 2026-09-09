-- Stable business suffix shared by Owner, Dealer and Field Manager app logins.
-- Existing usernames remain unchanged; the account owner confirms their suffix
-- before creating or explicitly renaming a login.
create table if not exists public.app_login_namespaces (
  account_user_id text primary key references public."user"(id) on delete cascade,
  account_name text not null unique
    check (account_name ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
  created_at timestamptz not null default now()
);
