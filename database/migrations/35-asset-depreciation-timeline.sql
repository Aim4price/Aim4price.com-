-- 35-asset-depreciation-timeline.sql
-- Persistent market depreciation snapshots for Aim4price Asset Register reports.
-- This is a market-value history log, not a SARS tax-depreciation calculation.
-- Safe to run more than once after the asset register migrations.

begin;

create extension if not exists pgcrypto;

create table if not exists public.asset_depreciation_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  register_id uuid null,
  asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
  valuation_run_id bigint null,
  captured_at timestamptz not null default now(),
  event_type text not null,
  event_source text null,
  asset_title text not null,
  asset_kind text null,
  sector_id bigint null,
  equipment_family_id bigint null,
  equipment_family_key text null,
  equipment_family_label text null,
  brand_name text null,
  model_name text null,
  year_model integer null,
  usage_amount numeric(14,2) null,
  usage_metric text null,
  life_worked_percent numeric(5,2) null,
  life_remaining_percent numeric(5,2) null,
  condition text null,
  replacement_price_ex_vat numeric(14,2) null,
  estimated_value_ex_vat numeric(14,2) not null,
  selected_method text null,
  depreciation_method_used text null,
  previous_estimated_value_ex_vat numeric(14,2) null,
  depreciation_since_previous_ex_vat numeric(14,2) null,
  depreciation_since_previous_percent numeric(8,4) null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.asset_depreciation_snapshots
  add column if not exists user_id text,
  add column if not exists register_id uuid null,
  add column if not exists asset_register_item_id uuid,
  add column if not exists valuation_run_id bigint null,
  add column if not exists captured_at timestamptz not null default now(),
  add column if not exists event_type text,
  add column if not exists event_source text null,
  add column if not exists asset_title text,
  add column if not exists asset_kind text null,
  add column if not exists sector_id bigint null,
  add column if not exists equipment_family_id bigint null,
  add column if not exists equipment_family_key text null,
  add column if not exists equipment_family_label text null,
  add column if not exists brand_name text null,
  add column if not exists model_name text null,
  add column if not exists year_model integer null,
  add column if not exists usage_amount numeric(14,2) null,
  add column if not exists usage_metric text null,
  add column if not exists life_worked_percent numeric(5,2) null,
  add column if not exists life_remaining_percent numeric(5,2) null,
  add column if not exists condition text null,
  add column if not exists replacement_price_ex_vat numeric(14,2) null,
  add column if not exists estimated_value_ex_vat numeric(14,2),
  add column if not exists selected_method text null,
  add column if not exists depreciation_method_used text null,
  add column if not exists previous_estimated_value_ex_vat numeric(14,2) null,
  add column if not exists depreciation_since_previous_ex_vat numeric(14,2) null,
  add column if not exists depreciation_since_previous_percent numeric(8,4) null,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

update public.asset_depreciation_snapshots
set
  metadata_json = coalesce(metadata_json, '{}'::jsonb),
  captured_at = coalesce(captured_at, now()),
  created_at = coalesce(created_at, now()),
  event_type = coalesce(nullif(trim(event_type), ''), 'asset_snapshot'),
  asset_title = coalesce(nullif(trim(asset_title), ''), 'Asset')
where metadata_json is null
   or captured_at is null
   or created_at is null
   or event_type is null
   or trim(coalesce(event_type, '')) = ''
   or asset_title is null
   or trim(coalesce(asset_title, '')) = '';

alter table public.asset_depreciation_snapshots
  alter column user_id set not null,
  alter column asset_register_item_id set not null,
  alter column captured_at set default now(),
  alter column captured_at set not null,
  alter column event_type set not null,
  alter column asset_title set not null,
  alter column estimated_value_ex_vat set not null,
  alter column metadata_json set default '{}'::jsonb,
  alter column metadata_json set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'asset_depreciation_snapshots_asset_register_item_id_fkey'
      and conrelid = 'public.asset_depreciation_snapshots'::regclass
  ) then
    alter table public.asset_depreciation_snapshots
      add constraint asset_depreciation_snapshots_asset_register_item_id_fkey
      foreign key (asset_register_item_id)
      references public.asset_register_items(id)
      on delete cascade;
  end if;
end $$;

create index if not exists idx_asset_depreciation_snapshots_user_asset_captured
  on public.asset_depreciation_snapshots(user_id, asset_register_item_id, captured_at desc);

create index if not exists idx_asset_depreciation_snapshots_asset_captured
  on public.asset_depreciation_snapshots(asset_register_item_id, captured_at desc);

create index if not exists idx_asset_depreciation_snapshots_user_captured
  on public.asset_depreciation_snapshots(user_id, captured_at desc);

insert into public.asset_depreciation_snapshots (
  user_id,
  register_id,
  asset_register_item_id,
  valuation_run_id,
  captured_at,
  event_type,
  event_source,
  asset_title,
  asset_kind,
  sector_id,
  equipment_family_id,
  equipment_family_key,
  equipment_family_label,
  brand_name,
  model_name,
  year_model,
  usage_amount,
  usage_metric,
  life_worked_percent,
  life_remaining_percent,
  condition,
  replacement_price_ex_vat,
  estimated_value_ex_vat,
  selected_method,
  depreciation_method_used,
  previous_estimated_value_ex_vat,
  depreciation_since_previous_ex_vat,
  depreciation_since_previous_percent,
  metadata_json,
  created_at
)
select
  ai.user_id,
  ai.register_id,
  ai.id,
  ai.valuation_run_id,
  coalesce(ai.updated_at, ai.created_at, now()) as captured_at,
  'backfill_current_asset_state' as event_type,
  'migration_35' as event_source,
  coalesce(nullif(trim(ai.title), ''), 'Asset') as asset_title,
  ai.kind as asset_kind,
  ai.sector_id,
  coalesce(ai.equipment_family_id, vr.equipment_family_id) as equipment_family_id,
  ef.family_key,
  ef.family_label,
  coalesce(nullif(trim(ai.brand_name), ''), nullif(trim(vr.brand_name), '')) as brand_name,
  coalesce(nullif(trim(ai.model_name), ''), nullif(trim(coalesce(vr.model_name, vr.typed_model_name, '')), '')) as model_name,
  ai.year_model,
  ai.hours as usage_amount,
  case
    when lower(coalesce(ai.kind, '')) = 'vehicle' then 'km'
    when lower(coalesce(ai.specs_json->>'usageMetric', ai.specs_json->>'usage_metric', ai.specs_json->>'usageUnit', ai.specs_json->>'usage_unit', ai.specs_json->>'usageMetricType', ai.specs_json->>'usage_metric_type', '')) in ('km', 'kms', 'kilometres', 'kilometers') then 'km'
    when lower(coalesce(ai.specs_json->>'usageMetric', ai.specs_json->>'usage_metric', ai.specs_json->>'usageUnit', ai.specs_json->>'usage_unit', ai.specs_json->>'usageMetricType', ai.specs_json->>'usage_metric_type', '')) in ('percent', 'percentage', 'percent_used', 'wear_class') then 'percent'
    else 'hours'
  end as usage_metric,
  ai.life_worked_percent,
  ai.life_remaining_percent,
  ai.condition,
  coalesce(ai.replacement_price_used_ex_vat, ai.user_replacement_price_ex_vat) as replacement_price_ex_vat,
  coalesce(ai.selected_value_ex_vat, ai.value) as estimated_value_ex_vat,
  ai.selected_method,
  ai.depreciation_method_used,
  null::numeric(14,2) as previous_estimated_value_ex_vat,
  null::numeric(14,2) as depreciation_since_previous_ex_vat,
  null::numeric(8,4) as depreciation_since_previous_percent,
  jsonb_build_object(
    'backfilledBy', '35-asset-depreciation-timeline.sql',
    'sourceUpdatedAt', ai.updated_at,
    'sourceCreatedAt', ai.created_at
  ) as metadata_json,
  now() as created_at
from public.asset_register_items ai
left join public.valuation_runs vr
  on vr.id = ai.valuation_run_id
left join public.equipment_families ef
  on ef.id = coalesce(ai.equipment_family_id, vr.equipment_family_id)
where ai.user_id is not null
  and trim(ai.user_id) <> ''
  and ai.id is not null
  and coalesce(ai.selected_value_ex_vat, ai.value) is not null
  and coalesce(ai.selected_value_ex_vat, ai.value) > 0
  and not exists (
    select 1
    from public.asset_depreciation_snapshots ads
    where ads.asset_register_item_id = ai.id
      and ads.event_type = 'backfill_current_asset_state'
  );

comment on table public.asset_depreciation_snapshots is
  'Market value timeline snapshots based on saved Aim4price asset-register values. Not a SARS tax-depreciation table.';

commit;
