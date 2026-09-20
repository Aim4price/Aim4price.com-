-- Additive offline support; no change to existing records.
create table if not exists public.app_offline_notes (
  identity text not null, event_id text not null, user_id text not null,
  app text not null, title text not null, note text not null,
  captured_at timestamptz not null, created_at timestamptz not null default now(),
  primary key (identity, event_id)
);
alter table if exists public.fuel_slips add column if not exists offline_event_id text;
create unique index if not exists fuel_slips_offline_event_idx on public.fuel_slips(user_id, offline_event_id) where offline_event_id is not null;

create table if not exists public.app_offline_completions (user_id text not null, maintenance_id uuid not null, event_id text not null, primary key (user_id,event_id));
