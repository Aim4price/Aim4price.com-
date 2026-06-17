-- 31-admin-dashboard-usage-tracking.sql
-- Simple internal admin dashboard usage tracking.
-- Safe to run more than once after the existing account/profile migrations.

begin;

alter table if exists public.account_profiles
  add column if not exists last_active_at timestamptz;

create index if not exists idx_account_profiles_last_active_at
  on public.account_profiles(last_active_at desc);

create table if not exists public.admin_usage_events (
  id bigserial primary key,
  user_id text,
  event_type text not null,
  event_source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_usage_events
  add column if not exists user_id text,
  add column if not exists event_type text,
  add column if not exists event_source text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

update public.admin_usage_events
set metadata = '{}'::jsonb
where metadata is null;

alter table public.admin_usage_events
  alter column event_type set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists idx_admin_usage_events_event_type_created_at
  on public.admin_usage_events(event_type, created_at desc);

create index if not exists idx_admin_usage_events_user_id_created_at
  on public.admin_usage_events(user_id, created_at desc);

create index if not exists idx_admin_usage_events_created_at
  on public.admin_usage_events(created_at desc);

comment on column public.account_profiles.last_active_at is
  'Last real signed-in user activity timestamp. Admin support/open-account mode must not update this field.';

comment on table public.admin_usage_events is
  'Lightweight internal usage events for the simple Aim4price admin dashboard. Historical values start from deployment of this migration.';

commit;
