BEGIN;

-- =========================================================
-- OPTION B V2
-- Step 1: Normalize sectors to fixed IDs and add simple schema
-- Target sector IDs:
--   1 = agricultural
--   2 = industrial
--   3 = construction
-- =========================================================

-- 1) Create temporary sector rows at IDs 1,2,3 if they do not already exist.
insert into public.sectors (id, sector_key, sector_label, is_active, created_at, updated_at)
values
  (1, 'agricultural_tmp', 'Agricultural', true, now(), now()),
  (2, 'industrial_tmp',   'Industrial',   false, now(), now()),
  (3, 'construction_tmp', 'Construction', false, now(), now())
on conflict (id) do nothing;

-- 2) Move existing foreign-key references from the old sector rows (4,5,6) to 1,2,3.
update public.equipment_families ef
set sector_id = case s.sector_key
  when 'agricultural' then 1
  when 'industrial' then 2
  when 'construction' then 3
  else ef.sector_id
end
from public.sectors s
where ef.sector_id = s.id
  and s.sector_key in ('agricultural', 'industrial', 'construction')
  and ef.sector_id not in (1, 2, 3);

update public.valuation_runs v
set sector_id = case s.sector_key
  when 'agricultural' then 1
  when 'industrial' then 2
  when 'construction' then 3
  else v.sector_id
end
from public.sectors s
where v.sector_id = s.id
  and s.sector_key in ('agricultural', 'industrial', 'construction')
  and v.sector_id not in (1, 2, 3);

update public.asset_register_items a
set sector_id = case s.sector_key
  when 'agricultural' then 1
  when 'industrial' then 2
  when 'construction' then 3
  else a.sector_id
end
from public.sectors s
where a.sector_id = s.id
  and s.sector_key in ('agricultural', 'industrial', 'construction')
  and a.sector_id not in (1, 2, 3);

-- 3) Remove the old sector rows with IDs 4,5,6.
delete from public.sectors
where id not in (1, 2, 3)
  and sector_key in ('agricultural', 'industrial', 'construction');

-- 4) Finalize the fixed sector rows.
update public.sectors
set sector_key = 'agricultural',
    sector_label = 'Agricultural',
    is_active = true,
    updated_at = now()
where id = 1;

update public.sectors
set sector_key = 'industrial',
    sector_label = 'Industrial',
    is_active = false,
    updated_at = now()
where id = 2;

update public.sectors
set sector_key = 'construction',
    sector_label = 'Construction',
    is_active = false,
    updated_at = now()
where id = 3;

-- 5) Keep the sectors id sequence correct.
select setval(
  pg_get_serial_sequence('public.sectors', 'id'),
  coalesce((select max(id) from public.sectors), 1),
  true
);

-- 6) Add the simple Option B fields.
alter table if exists public.equipment_families
  add column if not exists valuation_mode text;

alter table if exists public.equipment_models
  add column if not exists aim4price_replacement_price_ex_vat numeric(14,2),
  add column if not exists replacement_price_year integer,
  add column if not exists is_generic_fallback boolean not null default false;

-- 7) Add / refresh simple check constraints.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'chk_equipment_families_valuation_mode'
  ) then
    alter table public.equipment_families
      drop constraint chk_equipment_families_valuation_mode;
  end if;
end $$;

alter table public.equipment_families
  add constraint chk_equipment_families_valuation_mode
  check (valuation_mode in ('engine_hours', 'year_condition', 'percent_used'));

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'chk_equipment_models_replacement_price_year'
  ) then
    alter table public.equipment_models
      drop constraint chk_equipment_models_replacement_price_year;
  end if;
end $$;

alter table public.equipment_models
  add constraint chk_equipment_models_replacement_price_year
  check (
    replacement_price_year is null
    or (replacement_price_year between 1950 and 2100)
  );

create index if not exists idx_equipment_models_is_generic_fallback
  on public.equipment_models(is_generic_fallback);

create index if not exists idx_equipment_models_family_fallback
  on public.equipment_models(equipment_family_id, is_generic_fallback, brand_id);

COMMIT;