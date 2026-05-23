-- Owner contact detail request workflow for the Users page.
-- Run once in DBeaver/Railway if you prefer explicit migrations.
-- The app also creates these structures at runtime if missing.

create extension if not exists pgcrypto;

create table if not exists account_contact_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  requester_user_id text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  denied_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table account_contact_requests
  add column if not exists owner_user_id text,
  add column if not exists requester_user_id text,
  add column if not exists status text not null default 'pending',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists denied_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_account_contact_requests_owner_requester
  on account_contact_requests(owner_user_id, requester_user_id);

create index if not exists idx_account_contact_requests_owner_status
  on account_contact_requests(owner_user_id, status, created_at desc);

create index if not exists idx_account_contact_requests_requester_status
  on account_contact_requests(requester_user_id, status, created_at desc);
