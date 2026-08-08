create extension if not exists pgcrypto;

create table if not exists public.app_notification_reads (
  id uuid primary key default gen_random_uuid(),
  viewer_key text not null,
  event_key text not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (viewer_key, event_key)
);

create index if not exists app_notification_reads_viewer_idx
  on public.app_notification_reads (viewer_key, read_at desc);
