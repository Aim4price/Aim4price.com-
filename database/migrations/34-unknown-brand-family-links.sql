-- Aim4price migration 34
-- Adds a safe Unknown brand option and links it to every active equipment family.
-- This lets the valuation flow save/spec-value assets even when the brand is intentionally unknown.

BEGIN;

insert into public.brands (slug, name, is_active, created_at, updated_at)
select 'unknown', 'Unknown', true, now(), now()
where not exists (
  select 1
  from public.brands b
  where lower(b.slug) = 'unknown'
);

update public.brands
set
  name = 'Unknown',
  is_active = true,
  updated_at = now()
where lower(slug) = 'unknown';

with unknown_brand as (
  select id
  from public.brands
  where lower(slug) = 'unknown'
  order by id
  limit 1
), active_families as (
  select
    ef.sector_id,
    ef.id as equipment_family_id
  from public.equipment_families ef
  join public.sectors s
    on s.id = ef.sector_id
  where coalesce(ef.is_active, true) = true
    and coalesce(s.is_active, true) = true
)
insert into public.equipment_family_brands (
  sector_id,
  equipment_family_id,
  brand_id,
  is_active,
  sort_order,
  created_at,
  updated_at
)
select
  af.sector_id,
  af.equipment_family_id,
  ub.id,
  true,
  0,
  now(),
  now()
from active_families af
cross join unknown_brand ub
on conflict (equipment_family_id, brand_id)
do update set
  sector_id = excluded.sector_id,
  sort_order = least(coalesce(public.equipment_family_brands.sort_order, excluded.sort_order), excluded.sort_order),
  is_active = true,
  updated_at = now();

COMMIT;
