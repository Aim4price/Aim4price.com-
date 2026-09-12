-- Additive. Existing clients and historical notes remain valid.
begin;
create table if not exists public.maintenance_catalogue (
  id boolean primary key default true check (id),
  version integer not null,
  catalogue jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table if exists public.asset_maintenance_records add column if not exists maintenance_work jsonb;
alter table if exists public.asset_scan_events add column if not exists maintenance_work jsonb;
commit;
