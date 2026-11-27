-- Basic estimates use the owner's replacement price and engine-hour reading.
insert into public.equipment_families
  (sector_id, family_key, family_label, is_propelled, usage_metric_type, valuation_mode, catalog_mode, sort_order, is_active)
select id, 'boats', 'Boats', true, 'hours', 'engine_hours', 'generic_specs', 100, true
from public.sectors where sector_key = 'motor'
on conflict (sector_id, family_key) do nothing;

-- Basic accepts a typed brand or model through the existing unknown-brand record.
insert into public.equipment_family_brands (sector_id, equipment_family_id, brand_id, is_active, sort_order)
select s.id, f.id, b.id, true, 1
from public.sectors s
join public.equipment_families f on f.sector_id = s.id and f.family_key = 'boats'
join public.brands b on b.slug = 'unknown'
where s.sector_key = 'motor'
on conflict (equipment_family_id, brand_id) do nothing;
