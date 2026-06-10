-- Users page pagination, contact-request lockouts, POPIA acknowledgement,
-- daily request tracking, and internal owner messages/ads.
-- Safe to run more than once in DBeaver/Railway.

begin;

create extension if not exists pgcrypto;

-- Existing owner contact request table: extend the workflow beyond pending/approved/denied.
create table if not exists public.account_contact_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  requester_user_id text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  approved_at timestamptz,
  denied_at timestamptz,
  denied_count integer not null default 0,
  last_denied_at timestamptz,
  request_again_at timestamptz,
  permanently_denied_at timestamptz,
  popia_acknowledged_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.account_contact_requests
  add column if not exists owner_user_id text,
  add column if not exists requester_user_id text,
  add column if not exists status text not null default 'pending',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists last_requested_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists denied_at timestamptz,
  add column if not exists denied_count integer not null default 0,
  add column if not exists last_denied_at timestamptz,
  add column if not exists request_again_at timestamptz,
  add column if not exists permanently_denied_at timestamptz,
  add column if not exists popia_acknowledged_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.account_contact_requests
set
  denied_count = case
    when status in ('denied', 'temporarily_denied') and coalesce(denied_count, 0) < 1 then 1
    else coalesce(denied_count, 0)
  end,
  last_denied_at = case
    when status in ('denied', 'temporarily_denied') then coalesce(last_denied_at, denied_at, updated_at, now())
    else last_denied_at
  end,
  request_again_at = case
    when status in ('denied', 'temporarily_denied') and permanently_denied_at is null then coalesce(request_again_at, denied_at + interval '90 days', updated_at + interval '90 days', now() + interval '90 days')
    else request_again_at
  end,
  status = case
    when status = 'denied' then 'temporarily_denied'
    when status not in ('pending', 'approved', 'temporarily_denied', 'permanently_denied') then 'pending'
    else status
  end,
  last_requested_at = coalesce(last_requested_at, created_at, updated_at, now());

update public.account_contact_requests
set
  status = 'permanently_denied',
  permanently_denied_at = coalesce(permanently_denied_at, last_denied_at, denied_at, updated_at, now()),
  request_again_at = null
where coalesce(denied_count, 0) >= 3
  and status <> 'approved';

alter table public.account_contact_requests
  drop constraint if exists account_contact_requests_status_check;

alter table public.account_contact_requests
  add constraint account_contact_requests_status_check
  check (status in ('pending', 'approved', 'temporarily_denied', 'permanently_denied'));

create unique index if not exists idx_account_contact_requests_owner_requester
  on public.account_contact_requests(owner_user_id, requester_user_id);

create index if not exists idx_account_contact_requests_owner_status
  on public.account_contact_requests(owner_user_id, status, created_at desc);

create index if not exists idx_account_contact_requests_requester_status
  on public.account_contact_requests(requester_user_id, status, created_at desc);

create index if not exists idx_account_contact_requests_requester_requested_day
  on public.account_contact_requests(requester_user_id, last_requested_at desc);

comment on column public.account_contact_requests.denied_count is
  'Number of declined contact requests for the same owner/requester pair. Third denial becomes permanent.';

comment on column public.account_contact_requests.request_again_at is
  '90-day retry date after the first or second denial.';

comment on column public.account_contact_requests.popia_acknowledged_at is
  'Requester acknowledgement timestamp before unlocked contact details are shown.';

-- Internal messages and ad images sent from partner accounts to owner accounts.
create table if not exists public.account_user_messages (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  sender_user_id text not null,
  message_type text not null default 'message',
  message_text text not null default '',
  ad_caption text not null default '',
  image_file_name text,
  image_mime_type text,
  image_size_bytes integer,
  image_bytes bytea,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_user_messages
  add column if not exists owner_user_id text,
  add column if not exists sender_user_id text,
  add column if not exists message_type text not null default 'message',
  add column if not exists message_text text not null default '',
  add column if not exists ad_caption text not null default '',
  add column if not exists image_file_name text,
  add column if not exists image_mime_type text,
  add column if not exists image_size_bytes integer,
  add column if not exists image_bytes bytea,
  add column if not exists read_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.account_user_messages
  drop constraint if exists account_user_messages_type_check;

alter table public.account_user_messages
  add constraint account_user_messages_type_check
  check (message_type in ('message', 'ad'));

create index if not exists idx_account_user_messages_owner_read_created
  on public.account_user_messages(owner_user_id, read_at, created_at desc);

create index if not exists idx_account_user_messages_sender_created
  on public.account_user_messages(sender_user_id, created_at desc);

comment on table public.account_user_messages is
  'Internal messages and ad images sent from finance, insurance, and dealer accounts to owner accounts from the Users page.';

comment on column public.account_user_messages.image_bytes is
  'Raw JPG/PNG/WebP ad image bytes. The API limits uploads to 8 MB.';

commit;
