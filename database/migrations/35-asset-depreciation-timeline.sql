-- 35-asset-depreciation-timeline.sql
-- Persistent market depreciation snapshots for Aim4price Asset Register reports.
-- This is a market-value history log, not a SARS tax-depreciation calculation.
-- Safe to run more than once after the asset register migrations.
-- v2 safety fix: the backfill does not assume that asset_register_items.value exists.

begin;

create extension if not exists pgcrypto;

create or replace function pg_temp.aim4price_to_numeric(raw_value text)
returns numeric
language plpgsql
immutable
as $$
declare
  cleaned text;
begin
  if raw_value is null then
    return null;
  end if;

  cleaned := nullif(regexp_replace(trim(raw_value), '[^0-9.\-]+', '', 'g'), '');

  if cleaned is null or cleaned !~ '^-?[0-9]+(\.[0-9]+)?$' then
    return null;
  end if;

  return cleaned::numeric;
exception when others then
  return null;
end;
$$;

create or replace function pg_temp.aim4price_to_integer(raw_value text)
returns integer
language plpgsql
immutable
as $$
declare
  parsed numeric;
begin
  parsed := pg_temp.aim4price_to_numeric(raw_value);
  if parsed is null then
    return null;
  end if;

  return round(parsed)::integer;
exception when others then
  return null;
end;
$$;

create or replace function pg_temp.aim4price_to_bigint(raw_value text)
returns bigint
language plpgsql
immutable
as $$
declare
  parsed numeric;
begin
  parsed := pg_temp.aim4price_to_numeric(raw_value);
  if parsed is null then
    return null;
  end if;

  return round(parsed)::bigint;
exception when others then
  return null;
end;
$$;

create or replace function pg_temp.aim4price_to_uuid(raw_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if raw_value is null or trim(raw_value) = '' then
    return null;
  end if;

  if trim(raw_value) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;

  return trim(raw_value)::uuid;
exception when others then
  return null;
end;
$$;

create or replace function pg_temp.aim4price_to_timestamptz(raw_value text)
returns timestamptz
language plpgsql
immutable
as $$
begin
  if raw_value is null or trim(raw_value) = '' then
    return null;
  end if;

  return trim(raw_value)::timestamptz;
exception when others then
  return null;
end;
$$;

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

with source_assets as (
  select
    ai.id as asset_register_item_id,
    to_jsonb(ai) as ai_json,
    to_jsonb(vr) as vr_json,
    to_jsonb(ef) as ef_json
  from public.asset_register_items ai
  left join public.valuation_runs vr
    on vr.id::text = to_jsonb(ai)->>'valuation_run_id'
  left join public.equipment_families ef
    on ef.id::text = coalesce(to_jsonb(ai)->>'equipment_family_id', to_jsonb(vr)->>'equipment_family_id')
), normalized_assets as (
  select
    nullif(trim(ai_json->>'user_id'), '') as user_id,
    pg_temp.aim4price_to_uuid(ai_json->>'register_id') as register_id,
    asset_register_item_id,
    pg_temp.aim4price_to_bigint(ai_json->>'valuation_run_id') as valuation_run_id,
    coalesce(
      pg_temp.aim4price_to_timestamptz(ai_json->>'updated_at'),
      pg_temp.aim4price_to_timestamptz(ai_json->>'created_at'),
      now()
    ) as captured_at,
    coalesce(nullif(trim(ai_json->>'title'), ''), 'Asset') as asset_title,
    nullif(trim(ai_json->>'kind'), '') as asset_kind,
    pg_temp.aim4price_to_bigint(ai_json->>'sector_id') as sector_id,
    coalesce(
      pg_temp.aim4price_to_bigint(ai_json->>'equipment_family_id'),
      pg_temp.aim4price_to_bigint(vr_json->>'equipment_family_id')
    ) as equipment_family_id,
    nullif(trim(ef_json->>'family_key'), '') as equipment_family_key,
    nullif(trim(ef_json->>'family_label'), '') as equipment_family_label,
    coalesce(
      nullif(trim(ai_json->>'brand_name'), ''),
      nullif(trim(vr_json->>'brand_name'), '')
    ) as brand_name,
    coalesce(
      nullif(trim(ai_json->>'model_name'), ''),
      nullif(trim(ai_json->>'typed_model_name'), ''),
      nullif(trim(vr_json->>'model_name'), ''),
      nullif(trim(vr_json->>'typed_model_name'), '')
    ) as model_name,
    pg_temp.aim4price_to_integer(ai_json->>'year_model') as year_model,
    coalesce(
      pg_temp.aim4price_to_numeric(ai_json->>'hours'),
      pg_temp.aim4price_to_numeric(ai_json->>'estimated_hours'),
      pg_temp.aim4price_to_numeric(ai_json->'specs_json'->>'usageAmount'),
      pg_temp.aim4price_to_numeric(ai_json->'specs_json'->>'usage_amount'),
      pg_temp.aim4price_to_numeric(ai_json->'specs_json'->>'engine_hours'),
      pg_temp.aim4price_to_numeric(ai_json->'specs_json'->>'km')
    ) as usage_amount,
    case
      when lower(coalesce(ai_json->>'kind', '')) = 'vehicle' then 'km'
      when lower(coalesce(
        ai_json->'specs_json'->>'usageMetric',
        ai_json->'specs_json'->>'usage_metric',
        ai_json->'specs_json'->>'usageUnit',
        ai_json->'specs_json'->>'usage_unit',
        ai_json->'specs_json'->>'usageMetricType',
        ai_json->'specs_json'->>'usage_metric_type',
        ef_json->>'usage_metric_type',
        ''
      )) in ('km', 'kms', 'kilometres', 'kilometers') then 'km'
      when lower(coalesce(
        ai_json->'specs_json'->>'usageMetric',
        ai_json->'specs_json'->>'usage_metric',
        ai_json->'specs_json'->>'usageUnit',
        ai_json->'specs_json'->>'usage_unit',
        ai_json->'specs_json'->>'usageMetricType',
        ai_json->'specs_json'->>'usage_metric_type',
        ef_json->>'usage_metric_type',
        ''
      )) in ('percent', 'percentage', 'percent_used', 'wear_class') then 'percent'
      else 'hours'
    end as usage_metric,
    pg_temp.aim4price_to_numeric(ai_json->>'life_worked_percent') as life_worked_percent,
    pg_temp.aim4price_to_numeric(ai_json->>'life_remaining_percent') as life_remaining_percent,
    nullif(trim(ai_json->>'condition'), '') as condition,
    coalesce(
      pg_temp.aim4price_to_numeric(ai_json->>'replacement_price_used_ex_vat'),
      pg_temp.aim4price_to_numeric(ai_json->>'user_replacement_price_ex_vat'),
      pg_temp.aim4price_to_numeric(ai_json->'specs_json'->>'replacementPriceExVat'),
      pg_temp.aim4price_to_numeric(ai_json->'specs_json'->>'replacement_price_ex_vat'),
      pg_temp.aim4price_to_numeric(ai_json->'specs_json'->>'replacementPrice'),
      pg_temp.aim4price_to_numeric(ai_json->'specs_json'->>'replacement_price'),
      pg_temp.aim4price_to_numeric(vr_json->>'replacement_price_used_ex_vat'),
      pg_temp.aim4price_to_numeric(vr_json->>'user_replacement_price_ex_vat')
    ) as replacement_price_ex_vat,
    coalesce(
      pg_temp.aim4price_to_numeric(ai_json->>'selected_value_ex_vat'),
      pg_temp.aim4price_to_numeric(ai_json->>'value'),
      pg_temp.aim4price_to_numeric(ai_json->>'selected_value'),
      pg_temp.aim4price_to_numeric(ai_json->>'saved_value_ex_vat'),
      pg_temp.aim4price_to_numeric(ai_json->>'aim4price_value_ex_vat'),
      pg_temp.aim4price_to_numeric(ai_json->>'aim4price_value'),
      pg_temp.aim4price_to_numeric(vr_json->>'selected_value_ex_vat'),
      pg_temp.aim4price_to_numeric(vr_json->>'valuation_mid_ex_vat'),
      pg_temp.aim4price_to_numeric(vr_json->>'aim4price_value_ex_vat'),
      pg_temp.aim4price_to_numeric(vr_json->>'aim4price_value')
    ) as estimated_value_ex_vat,
    nullif(trim(ai_json->>'selected_method'), '') as selected_method,
    nullif(trim(ai_json->>'depreciation_method_used'), '') as depreciation_method_used,
    coalesce(ai_json->'specs_json', '{}'::jsonb) as specs_json,
    pg_temp.aim4price_to_timestamptz(ai_json->>'updated_at') as source_updated_at,
    pg_temp.aim4price_to_timestamptz(ai_json->>'created_at') as source_created_at
  from source_assets
)
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
  user_id,
  register_id,
  asset_register_item_id,
  valuation_run_id,
  captured_at,
  'backfill_current_asset_state' as event_type,
  'migration_35' as event_source,
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
  null::numeric(14,2) as previous_estimated_value_ex_vat,
  null::numeric(14,2) as depreciation_since_previous_ex_vat,
  null::numeric(8,4) as depreciation_since_previous_percent,
  jsonb_build_object(
    'backfilledBy', '35-asset-depreciation-timeline.sql',
    'backfillVersion', 2,
    'sourceUpdatedAt', source_updated_at,
    'sourceCreatedAt', source_created_at
  ) as metadata_json,
  now() as created_at
from normalized_assets
where user_id is not null
  and trim(user_id) <> ''
  and asset_register_item_id is not null
  and estimated_value_ex_vat is not null
  and estimated_value_ex_vat > 0
  and not exists (
    select 1
    from public.asset_depreciation_snapshots ads
    where ads.asset_register_item_id = normalized_assets.asset_register_item_id
      and ads.event_type = 'backfill_current_asset_state'
  );

comment on table public.asset_depreciation_snapshots is
  'Market value timeline snapshots based on saved Aim4price asset-register values. Not a SARS tax-depreciation table.';

commit;
