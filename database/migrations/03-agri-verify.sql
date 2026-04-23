-- =========================================================
-- OPTION B V2
-- Step 3: Verify
-- =========================================================

-- A) Sectors must now be 1,2,3 exactly.
select
  id,
  sector_key,
  sector_label,
  is_active
from public.sectors
order by id;

-- B) There should be no old sector IDs left in the linked tables.
select 'equipment_families_old_sector_refs' as check_name, count(*)::bigint as result
from public.equipment_families
where sector_id not in (1, 2, 3)

union all
select 'market_vault_listings_old_sector_refs', count(*)::bigint
from public.market_vault_listings
where sector_id is not null
  and sector_id not in (1, 2, 3)

union all
select 'valuation_runs_old_sector_refs', count(*)::bigint
from public.valuation_runs
where sector_id is not null
  and sector_id not in (1, 2, 3)

union all
select 'asset_register_items_old_sector_refs', count(*)::bigint
from public.asset_register_items
where sector_id is not null
  and sector_id not in (1, 2, 3);

-- C) Equipment family setup.
select
  ef.id,
  ef.sector_id,
  ef.family_key,
  ef.family_label,
  ef.is_propelled,
  ef.usage_metric_type,
  ef.valuation_mode,
  ef.sort_order,
  ef.is_active
from public.equipment_families ef
where ef.sector_id = 1
order by ef.sort_order, ef.family_key;

-- D) Tractor model backfill count.
select
  (select count(*) from public.tractor_catalog) as tractor_catalog_count,
  (select count(*) from public.equipment_models em
   join public.equipment_families ef on ef.id = em.equipment_family_id
   where ef.sector_id = 1 and ef.family_key = 'tractors' and em.is_generic_fallback = false
  ) as equipment_models_tractor_count;

-- E) Direct replacement price fields now stored on equipment_models.
select
  count(*) filter (where aim4price_replacement_price_ex_vat is not null) as models_with_replacement_price,
  count(*) filter (where replacement_price_year is not null) as models_with_replacement_year,
  count(*) filter (where is_generic_fallback = true) as generic_fallback_rows
from public.equipment_models;

-- F) Show sample tractor rows with direct replacement price.
select
  em.id,
  b.name as brand_name,
  em.model_name,
  em.display_name,
  em.aim4price_replacement_price_ex_vat,
  em.replacement_price_year,
  em.is_generic_fallback
from public.equipment_models em
left join public.brands b
  on b.id = em.brand_id
join public.equipment_families ef
  on ef.id = em.equipment_family_id
where ef.sector_id = 1
  and ef.family_key = 'tractors'
order by em.is_generic_fallback desc, b.name nulls last, em.model_name
limit 20;

-- G) Alias count.
select
  count(*) as alias_count
from public.equipment_model_aliases;

-- H) The old Option A tables should now be gone.
select
  to_regclass('public.replacement_price_references') as replacement_price_references_should_be_null,
  to_regclass('public.valuation_profiles') as valuation_profiles_should_be_null,
  to_regclass('public.fallback_price_bands') as fallback_price_bands_should_be_null;