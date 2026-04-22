BEGIN;

-- 1) Seed sectors
insert into public.sectors (sector_key, sector_label, is_active)
values
  ('agricultural', 'Agricultural', true),
  ('industrial', 'Industrial', false),
  ('construction', 'Construction', false)
on conflict (sector_key)
do update set
  sector_label = excluded.sector_label,
  is_active = excluded.is_active,
  updated_at = now();

-- 2) Seed agricultural equipment families
with agri as (
  select id as sector_id
  from public.sectors
  where sector_key = 'agricultural'
)
insert into public.equipment_families (
  sector_id,
  family_key,
  family_label,
  is_propelled,
  usage_metric_type,
  sort_order,
  is_active
)
select
  agri.sector_id,
  data.family_key,
  data.family_label,
  data.is_propelled,
  data.usage_metric_type,
  data.sort_order,
  data.is_active
from agri
cross join (
  values
    ('tractors', 'Tractors', true, 'hours', 10, true),
    ('combines', 'Combines', true, 'hours', 20, false),
    ('forage_harvesters', 'Forage Harvesters', true, 'hours', 30, false),
    ('self_propelled_sprayers', 'Self-Propelled Sprayers', true, 'hours', 40, false),
    ('balers', 'Balers', false, 'wear_class', 50, false),
    ('planters', 'Planters', false, 'wear_class', 60, false),
    ('mowers', 'Mowers', false, 'wear_class', 70, false),
    ('seed_drills', 'Seed Drills', false, 'wear_class', 80, false),
    ('fertilizer_spreaders', 'Fertilizer Spreaders', false, 'wear_class', 90, false),
    ('tillage_implements', 'Tillage Implements', false, 'wear_class', 100, false),
    ('trailers', 'Trailers', false, 'wear_class', 110, false),
    ('telehandlers', 'Telehandlers', true, 'hours', 120, false)
) as data(family_key, family_label, is_propelled, usage_metric_type, sort_order, is_active)
on conflict (sector_id, family_key)
do update set
  family_label = excluded.family_label,
  is_propelled = excluded.is_propelled,
  usage_metric_type = excluded.usage_metric_type,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

-- 3) Backfill existing tractor_catalog rows into the new generic equipment_models table
with tractor_family as (
  select ef.id as family_id
  from public.equipment_families ef
  join public.sectors s on s.id = ef.sector_id
  where s.sector_key = 'agricultural'
    and ef.family_key = 'tractors'
)
insert into public.equipment_models (
  equipment_family_id,
  brand_id,
  legacy_tractor_catalog_id,
  model_name,
  variant_name,
  normalized_model_name,
  display_name,
  year_start,
  year_end,
  power_kw,
  tractor_type,
  drive_type,
  cab_type,
  specs_json,
  is_active
)
select
  tf.family_id,
  tc.brand_id,
  tc.id,
  tc.model_name,
  null,
  lower(regexp_replace(coalesce(tc.model_name, ''), '[^a-z0-9]+', '', 'g')),
  trim(concat(b.name, ' ', tc.model_name)),
  tc.year_start,
  tc.year_end,
  tc.power_kw,
  tc.tractor_type,
  tc.drive_type,
  tc.cab_type,
  jsonb_strip_nulls(jsonb_build_object(
    'equipment_type', tc.equipment_type,
    'front_pto_supported', tc.front_pto_supported,
    'front_loader_supported', tc.front_loader_supported,
    'gps_supported', tc.gps_supported
  )),
  coalesce(tc.is_active, true)
from public.tractor_catalog tc
join public.brands b
  on b.id = tc.brand_id
cross join tractor_family tf
on conflict (legacy_tractor_catalog_id)
do update set
  equipment_family_id = excluded.equipment_family_id,
  brand_id = excluded.brand_id,
  model_name = excluded.model_name,
  normalized_model_name = excluded.normalized_model_name,
  display_name = excluded.display_name,
  year_start = excluded.year_start,
  year_end = excluded.year_end,
  power_kw = excluded.power_kw,
  tractor_type = excluded.tractor_type,
  drive_type = excluded.drive_type,
  cab_type = excluded.cab_type,
  specs_json = excluded.specs_json,
  is_active = excluded.is_active,
  updated_at = now();

-- 4) Add self aliases for every tractor model
insert into public.equipment_model_aliases (equipment_model_id, alias_text, normalized_alias)
select
  em.id,
  em.model_name,
  lower(regexp_replace(coalesce(em.model_name, ''), '[^a-z0-9]+', '', 'g'))
from public.equipment_models em
join public.equipment_families ef on ef.id = em.equipment_family_id
join public.sectors s on s.id = ef.sector_id
where s.sector_key = 'agricultural'
  and ef.family_key = 'tractors'
on conflict (equipment_model_id, normalized_alias)
do nothing;

-- 5) Seed replacement price references from the live tractor catalog
insert into public.replacement_price_references (
  equipment_model_id,
  reference_year,
  replacement_price_ex_vat,
  currency_code,
  source_name,
  source_url,
  confidence_score
)
select
  em.id,
  coalesce(tc.year_end, extract(year from now())::integer),
  tc.aim4price_replacement_price_ex_vat,
  'ZAR',
  'Aim4price tractor catalog',
  null,
  1.00
from public.equipment_models em
join public.tractor_catalog tc
  on tc.id = em.legacy_tractor_catalog_id
where tc.aim4price_replacement_price_ex_vat is not null
on conflict (equipment_model_id, reference_year, source_name)
do update set
  replacement_price_ex_vat = excluded.replacement_price_ex_vat,
  confidence_score = excluded.confidence_score,
  updated_at = now();

-- 6) Seed valuation profiles
insert into public.valuation_profiles (
  equipment_family_id,
  profile_key,
  is_propelled,
  usage_metric_type,
  max_use_hours,
  age_curve,
  usage_curve,
  condition_curve,
  floor_percent,
  notes,
  is_active
)
select
  ef.id,
  'agri_' || ef.family_key,
  ef.is_propelled,
  ef.usage_metric_type,
  case when ef.is_propelled then 12000 else null end,
  case
    when ef.is_propelled then '{"base_annual_depreciation_percent": 5.5, "minimum_factor": 0.50}'::jsonb
    else '{"base_annual_depreciation_percent": 6.5, "minimum_factor": 0.35}'::jsonb
  end,
  case
    when ef.is_propelled then '{"included_hours": 2500, "per_hour_after_included": 0.000025, "minimum_factor": 0.70}'::jsonb
    else '{"light": 1.00, "medium": 0.92, "heavy": 0.82}'::jsonb
  end,
  '{"excellent": 1.08, "good": 1.00, "fair": 0.93, "used": 0.86, "serious": 0.76}'::jsonb,
  case when ef.is_propelled then 20 else 15 end,
  case
    when ef.is_propelled then 'Propelled baseline profile. Use tractor-style depreciation first, then tune family-specific rules later.'
    else 'Non-propelled baseline profile. Use age + wear-class logic first, then tune family-specific rules later.'
  end,
  true
from public.equipment_families ef
join public.sectors s on s.id = ef.sector_id
where s.sector_key = 'agricultural'
on conflict (equipment_family_id)
do update set
  profile_key = excluded.profile_key,
  is_propelled = excluded.is_propelled,
  usage_metric_type = excluded.usage_metric_type,
  max_use_hours = excluded.max_use_hours,
  age_curve = excluded.age_curve,
  usage_curve = excluded.usage_curve,
  condition_curve = excluded.condition_curve,
  floor_percent = excluded.floor_percent,
  notes = excluded.notes,
  is_active = excluded.is_active,
  updated_at = now();

-- 7) Backfill live tractor listings with sector/family/model links
update public.market_vault_listings m
set
  sector_id = (
    select id from public.sectors where sector_key = 'agricultural'
  ),
  equipment_family_id = (
    select ef.id
    from public.equipment_families ef
    join public.sectors s on s.id = ef.sector_id
    where s.sector_key = 'agricultural'
      and ef.family_key = 'tractors'
    limit 1
  ),
  equipment_model_id = (
    select em.id
    from public.equipment_models em
    join public.brands b on b.id = em.brand_id
    join public.equipment_families ef on ef.id = em.equipment_family_id
    join public.sectors s on s.id = ef.sector_id
    where s.sector_key = 'agricultural'
      and ef.family_key = 'tractors'
      and lower(trim(b.name)) = lower(trim(m.brand_name))
      and lower(trim(em.model_name)) = lower(trim(m.model_name))
      and coalesce(lower(trim(em.tractor_type)), '') = coalesce(lower(trim(m.tractor_type)), '')
      and replace(coalesce(lower(trim(em.drive_type)), ''), ' ', '') = replace(coalesce(lower(trim(m.drive_type)), ''), ' ', '')
      and coalesce(lower(trim(em.cab_type)), '') = coalesce(lower(trim(m.cab_type)), '')
    order by em.id
    limit 1
  )
where lower(trim(coalesce(m.equipment_type, 'tractor'))) = 'tractor';

-- 8) Backfill valuation_runs with sector/family/model links
update public.valuation_runs v
set
  sector_id = (
    select id from public.sectors where sector_key = 'agricultural'
  ),
  equipment_family_id = (
    select ef.id
    from public.equipment_families ef
    join public.sectors s on s.id = ef.sector_id
    where s.sector_key = 'agricultural'
      and ef.family_key = 'tractors'
    limit 1
  ),
  equipment_model_id = (
    select em.id
    from public.equipment_models em
    where em.legacy_tractor_catalog_id = v.model_id::integer
    limit 1
  )
where lower(trim(coalesce(v.equipment_type, 'tractor'))) = 'tractor';

-- 9) Backfill asset_register_items from linked valuation runs
update public.asset_register_items a
set
  sector_id = v.sector_id,
  equipment_family_id = v.equipment_family_id,
  equipment_model_id = v.equipment_model_id
from public.valuation_runs v
where a.valuation_run_id = v.id;

-- 10) For manually created tractor assets, at least tag sector + family
update public.asset_register_items a
set
  sector_id = (
    select id from public.sectors where sector_key = 'agricultural'
  ),
  equipment_family_id = (
    select ef.id
    from public.equipment_families ef
    join public.sectors s on s.id = ef.sector_id
    where s.sector_key = 'agricultural'
      and ef.family_key = 'tractors'
    limit 1
  )
where a.kind = 'tractor'
  and a.equipment_family_id is null;

COMMIT;
