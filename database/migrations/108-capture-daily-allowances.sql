-- Separate South African daily capture allowances and Admin follow-up.

create table if not exists public.capture_daily_usage (
  request_id uuid primary key,
  owner_user_id text not null references public."user"(id) on delete cascade,
  request_type text not null check (request_type in ('invoice', 'fuel_slip')),
  usage_day date not null default ((now() at time zone 'Africa/Johannesburg')::date)
);
create index if not exists capture_daily_usage_account_day
  on public.capture_daily_usage(owner_user_id, request_type, usage_day);
create table if not exists public.capture_assistance_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null references public."user"(id) on delete cascade,
  actor_user_id text not null references public."user"(id) on delete cascade,
  request_type text not null check (request_type in ('invoice', 'fuel_slip')),
  usage_day date not null default ((now() at time zone 'Africa/Johannesburg')::date),
  shown_at timestamptz not null default now(),
  requested_at timestamptz,
  note text not null default '',
  resolved_at timestamptz,
  unique(owner_user_id, actor_user_id, request_type, usage_day)
);
