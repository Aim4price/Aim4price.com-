-- 1) New generic tables should exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'sectors',
    'equipment_families',
    'equipment_models',
    'equipment_model_aliases',
    'replacement_price_references',
    'valuation_profiles',
    'fallback_price_bands'
  )
order by table_name;

-- 2) Seeded sectors and families
select s.sector_key, s.sector_label, s.is_active
from public.sectors s
order by s.id;

select
  s.sector_key,
  ef.family_key,
  ef.family_label,
  ef.is_propelled,
  ef.usage_metric_type,
  ef.is_active
from public.equipment_families ef
join public.sectors s on s.id = ef.sector_id
order by s.sector_key, ef.sort_order, ef.family_key;

-- 3) Tractor backfill count should match current tractor_catalog count
select
  (select count(*) from public.tractor_catalog) as tractor_catalog_count,
  (select count(*)
   from public.equipment_models em
   join public.equipment_families ef on ef.id = em.equipment_family_id
   join public.sectors s on s.id = ef.sector_id
   where s.sector_key = 'agricultural'
     and ef.family_key = 'tractors') as equipment_models_tractor_count;

-- 4) Model linkage coverage
select
  'market_vault_listings_linked' as check_name,
  count(*)::bigint as result
from public.market_vault_listings
where lower(trim(coalesce(equipment_type, 'tractor'))) = 'tractor'
  and equipment_model_id is not null
union all
select
  'market_vault_listings_unmatched',
  count(*)::bigint
from public.market_vault_listings
where lower(trim(coalesce(equipment_type, 'tractor'))) = 'tractor'
  and equipment_model_id is null
union all
select
  'valuation_runs_linked',
  count(*)::bigint
from public.valuation_runs
where lower(trim(coalesce(equipment_type, 'tractor'))) = 'tractor'
  and equipment_model_id is not null
union all
select
  'asset_register_items_family_linked',
  count(*)::bigint
from public.asset_register_items
where equipment_family_id is not null;

-- 5) Sample tractor models in the new generic table
select
  em.id,
  b.name as brand_name,
  em.model_name,
  em.display_name,
  em.year_start,
  em.year_end,
  em.power_kw,
  em.legacy_tractor_catalog_id
from public.equipment_models em
left join public.brands b on b.id = em.brand_id
join public.equipment_families ef on ef.id = em.equipment_family_id
join public.sectors s on s.id = ef.sector_id
where s.sector_key = 'agricultural'
  and ef.family_key = 'tractors'
order by b.name, em.model_name
limit 20;

-- 6) Sample seeded valuation profiles
select
  s.sector_key,
  ef.family_key,
  vp.profile_key,
  vp.is_propelled,
  vp.usage_metric_type,
  vp.max_use_hours,
  vp.floor_percent
from public.valuation_profiles vp
join public.equipment_families ef on ef.id = vp.equipment_family_id
join public.sectors s on s.id = ef.sector_id
order by s.sector_key, ef.sort_order;
