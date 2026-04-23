BEGIN;

-- =========================================================
-- OPTION B V2
-- Step 2: Seed simple valuation modes, backfill tractors,
--         generate aliases, create generic fallback rows,
--         and remove old unused pricing/valuation tables.
-- =========================================================

-- 1) Seed / normalize the agricultural families you already use in the product.
insert into public.equipment_families (
  sector_id,
  family_key,
  family_label,
  is_propelled,
  usage_metric_type,
  sort_order,
  is_active
)
values
  (1, 'tractors',                'Tractors',                 true,  'hours',      10, true),
  (1, 'combines',                'Combines',                 true,  'hours',      20, false),
  (1, 'forage_harvesters',       'Forage Harvesters',        true,  'hours',      30, false),
  (1, 'self_propelled_sprayers', 'Self-Propelled Sprayers',  true,  'hours',      40, false),
  (1, 'balers',                  'Balers',                   false, 'wear_class', 50, false),
  (1, 'planters',                'Planters',                 false, 'wear_class', 60, false),
  (1, 'mowers',                  'Mowers',                   false, 'wear_class', 70, false),
  (1, 'seed_drills',             'Seed Drills',              false, 'wear_class', 80, false),
  (1, 'fertilizer_spreaders',    'Fertilizer Spreaders',     false, 'wear_class', 90, false),
  (1, 'tillage_implements',      'Tillage Implements',       false, 'wear_class', 100, false),
  (1, 'trailers',                'Trailers',                 false, 'wear_class', 110, false),
  (1, 'telehandlers',            'Telehandlers',             true,  'hours',      120, false)
on conflict (sector_id, family_key)
do update set
  family_label = excluded.family_label,
  is_propelled = excluded.is_propelled,
  usage_metric_type = excluded.usage_metric_type,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

-- 2) Set the simple Option B valuation mode.
update public.equipment_families
set valuation_mode = case
  when family_key in ('tractors', 'combines', 'forage_harvesters', 'self_propelled_sprayers', 'telehandlers')
    then 'engine_hours'
  when family_key in ('balers', 'planters', 'mowers', 'seed_drills', 'fertilizer_spreaders', 'tillage_implements', 'trailers')
    then 'year_condition'
  else coalesce(valuation_mode, 'year_condition')
end,
updated_at = now()
where sector_id = 1;

-- 3) Keep usage_metric_type aligned with the simple mode, but preserve the field for current code compatibility.
update public.equipment_families
set usage_metric_type = case
  when valuation_mode = 'engine_hours' then 'hours'
  else 'wear_class'
end,
updated_at = now()
where sector_id = 1;

-- 4) If old replacement_price_references rows exist, copy the latest price onto equipment_models first.
with latest_ref as (
  select distinct on (r.equipment_model_id)
    r.equipment_model_id,
    r.reference_year,
    r.replacement_price_ex_vat
  from public.replacement_price_references r
  order by r.equipment_model_id, r.reference_year desc, r.id desc
)
update public.equipment_models em
set
  aim4price_replacement_price_ex_vat = coalesce(em.aim4price_replacement_price_ex_vat, latest_ref.replacement_price_ex_vat),
  replacement_price_year = coalesce(em.replacement_price_year, latest_ref.reference_year),
  updated_at = now()
from latest_ref
where em.id = latest_ref.equipment_model_id;

-- 5) Upsert the live tractor catalog into equipment_models, now with direct replacement prices.
with tractor_family as (
  select id as family_id
  from public.equipment_families
  where sector_id = 1
    and family_key = 'tractors'
  limit 1
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
  aim4price_replacement_price_ex_vat,
  replacement_price_year,
  is_generic_fallback,
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
  jsonb_strip_nulls(
    jsonb_build_object(
      'equipment_type', tc.equipment_type,
      'front_pto_supported', tc.front_pto_supported,
      'front_loader_supported', tc.front_loader_supported,
      'gps_supported', tc.gps_supported
    )
  ),
  tc.aim4price_replacement_price_ex_vat,
  coalesce(tc.year_end, extract(year from now())::integer),
  false,
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
  variant_name = excluded.variant_name,
  normalized_model_name = excluded.normalized_model_name,
  display_name = excluded.display_name,
  year_start = excluded.year_start,
  year_end = excluded.year_end,
  power_kw = excluded.power_kw,
  tractor_type = excluded.tractor_type,
  drive_type = excluded.drive_type,
  cab_type = excluded.cab_type,
  specs_json = excluded.specs_json,
  aim4price_replacement_price_ex_vat = excluded.aim4price_replacement_price_ex_vat,
  replacement_price_year = excluded.replacement_price_year,
  is_generic_fallback = false,
  is_active = excluded.is_active,
  updated_at = now();

-- 6) Auto-generate simple aliases for tractors.
insert into public.equipment_model_aliases (
  equipment_model_id,
  alias_text,
  normalized_alias
)
select distinct
  x.equipment_model_id,
  x.alias_text,
  lower(regexp_replace(coalesce(x.alias_text, ''), '[^a-z0-9]+', '', 'g')) as normalized_alias
from (
  select
    em.id as equipment_model_id,
    em.model_name as alias_text
  from public.equipment_models em
  join public.equipment_families ef
    on ef.id = em.equipment_family_id
  where ef.sector_id = 1
    and ef.family_key = 'tractors'

  union all

  select
    em.id as equipment_model_id,
    em.display_name as alias_text
  from public.equipment_models em
  join public.equipment_families ef
    on ef.id = em.equipment_family_id
  where ef.sector_id = 1
    and ef.family_key = 'tractors'
) x
where coalesce(trim(x.alias_text), '') <> ''
on conflict (equipment_model_id, normalized_alias)
do nothing;

-- 7) Create one simple generic fallback row per agricultural family if it does not exist yet.
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
  aim4price_replacement_price_ex_vat,
  replacement_price_year,
  is_generic_fallback,
  is_active
)
select
  ef.id,
  null,
  null,
  'Unknown / Generic',
  null,
  'unknowngeneric',
  'Generic ' || ef.family_label,
  null,
  null,
  null,
  null,
  null,
  null,
  jsonb_build_object('generic_fallback', true),
  case
    when ef.family_key = 'tractors' then (
      select round(avg(tc.aim4price_replacement_price_ex_vat))::numeric(14,2)
      from public.tractor_catalog tc
      where tc.aim4price_replacement_price_ex_vat is not null
    )
    else null
  end,
  case
    when ef.family_key = 'tractors' then extract(year from now())::integer
    else null
  end,
  true,
  true
from public.equipment_families ef
where ef.sector_id = 1
  and not exists (
    select 1
    from public.equipment_models em
    where em.equipment_family_id = ef.id
      and em.is_generic_fallback = true
  );

-- 8) Clean up the old Option A tables because you do not want to use them.
drop table if exists public.replacement_price_references cascade;
drop table if exists public.valuation_profiles cascade;
drop table if exists public.fallback_price_bands cascade;

COMMIT;