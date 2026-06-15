BEGIN;

-- =========================================================
-- AIM4 Stage 1 foundation
--
-- Adds Motor as the 4th sector, activates Industrial and Construction,
-- and seeds the starter families / spec questions needed for the generic
-- valuation page.
--
-- Important convention:
--   valuation_mode = 'engine_hours' stays unchanged.
--   For Motor, usage_metric_type = 'km'. The existing hours/engine_hours
--   storage fields are interpreted and displayed as kilometres by the app.
-- =========================================================

-- 1) Activate current sectors.
update public.sectors
set
  is_active = true,
  updated_at = now()
where sector_key in ('agricultural', 'industrial', 'construction');

-- 2) Add Motor. Prefer id = 4 where it is still available, but do not fail
-- if this database already has another row using id = 4.
insert into public.sectors (id, sector_key, sector_label, is_active, created_at, updated_at)
select 4, 'motor', 'Motor', true, now(), now()
where not exists (select 1 from public.sectors where sector_key = 'motor')
  and not exists (select 1 from public.sectors where id = 4);

insert into public.sectors (sector_key, sector_label, is_active, created_at, updated_at)
select 'motor', 'Motor', true, now(), now()
where not exists (select 1 from public.sectors where sector_key = 'motor');

update public.sectors
set
  sector_label = 'Motor',
  is_active = true,
  updated_at = now()
where sector_key = 'motor';

select setval(
  pg_get_serial_sequence('public.sectors', 'id'),
  greatest(coalesce((select max(id) from public.sectors), 1), 4),
  true
);

-- 3) Seed starter equipment families.
with seed_families (
  sector_key,
  family_key,
  family_label,
  is_propelled,
  usage_metric_type,
  valuation_mode,
  catalog_mode,
  sort_order
) as (
  values
  ('construction', 'excavators', 'Excavators', true, 'hours', 'engine_hours', 'generic_specs', 10),
  ('construction', 'tlbs_backhoes', 'TLBs / Backhoe Loaders', true, 'hours', 'engine_hours', 'generic_specs', 20),
  ('construction', 'wheel_loaders', 'Wheel Loaders', true, 'hours', 'engine_hours', 'generic_specs', 30),
  ('construction', 'skid_steers', 'Skid Steers', true, 'hours', 'engine_hours', 'generic_specs', 40),
  ('construction', 'graders', 'Graders', true, 'hours', 'engine_hours', 'generic_specs', 50),
  ('construction', 'rollers_compactors', 'Rollers / Compactors', true, 'hours', 'engine_hours', 'generic_specs', 60),
  ('construction', 'dumpers', 'Dumpers', true, 'hours', 'engine_hours', 'generic_specs', 70),
  ('construction', 'telehandlers', 'Telehandlers', true, 'hours', 'engine_hours', 'generic_specs', 80),

  ('industrial', 'forklifts', 'Forklifts', true, 'hours', 'engine_hours', 'generic_specs', 10),
  ('industrial', 'generators', 'Generators', true, 'hours', 'engine_hours', 'generic_specs', 20),
  ('industrial', 'compressors', 'Compressors', true, 'hours', 'engine_hours', 'generic_specs', 30),
  ('industrial', 'warehouse_equipment', 'Warehouse Equipment', true, 'hours', 'engine_hours', 'generic_specs', 40),
  ('industrial', 'industrial_pumps', 'Industrial Pumps', true, 'hours', 'engine_hours', 'generic_specs', 50),
  ('industrial', 'lighting_towers', 'Lighting Towers', true, 'hours', 'engine_hours', 'generic_specs', 60),

  ('motor', 'bakkies_ldvs', 'Bakkies / LDVs', true, 'km', 'engine_hours', 'generic_specs', 10),
  ('motor', 'cars_suvs', 'Cars / SUVs', true, 'km', 'engine_hours', 'generic_specs', 20),
  ('motor', 'light_commercial_vehicles', 'Light Commercial Vehicles', true, 'km', 'engine_hours', 'generic_specs', 30),
  ('motor', 'trucks', 'Trucks', true, 'km', 'engine_hours', 'generic_specs', 40),
  ('motor', 'trailers', 'Trailers', true, 'km', 'engine_hours', 'generic_specs', 50),
  ('motor', 'buses', 'Buses', true, 'km', 'engine_hours', 'generic_specs', 60)
)
insert into public.equipment_families (
  sector_id,
  family_key,
  family_label,
  is_propelled,
  usage_metric_type,
  valuation_mode,
  catalog_mode,
  sort_order,
  is_active,
  created_at,
  updated_at
)
select
  s.id,
  sf.family_key,
  sf.family_label,
  sf.is_propelled,
  sf.usage_metric_type,
  sf.valuation_mode,
  sf.catalog_mode,
  sf.sort_order,
  true,
  now(),
  now()
from seed_families sf
join public.sectors s
  on s.sector_key = sf.sector_key
on conflict (sector_id, family_key)
do update set
  family_label = excluded.family_label,
  is_propelled = excluded.is_propelled,
  usage_metric_type = excluded.usage_metric_type,
  valuation_mode = excluded.valuation_mode,
  catalog_mode = excluded.catalog_mode,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

-- 4) Seed missing starter brands.
with seed_brands (slug, name) as (
  values
  ('bell-equipment', 'Bell Equipment'),
  ('bobcat', 'Bobcat'),
  ('caterpillar', 'Caterpillar'),
  ('ford', 'Ford'),
  ('hino', 'Hino'),
  ('hitachi', 'Hitachi'),
  ('hyster', 'Hyster'),
  ('isuzu', 'Isuzu'),
  ('jcb', 'JCB'),
  ('komatsu', 'Komatsu'),
  ('man', 'MAN'),
  ('manitou', 'Manitou'),
  ('mercedes-benz', 'Mercedes-Benz'),
  ('nissan', 'Nissan'),
  ('perkins', 'Perkins'),
  ('scania', 'Scania'),
  ('toyota', 'Toyota'),
  ('ud-trucks', 'UD Trucks'),
  ('volkswagen', 'Volkswagen'),
  ('volvo', 'Volvo'),
  ('yale', 'Yale')
)
insert into public.brands (slug, name, is_active, created_at, updated_at)
select
  sb.slug,
  sb.name,
  true,
  now(),
  now()
from seed_brands sb
where not exists (
  select 1
  from public.brands b
  where lower(b.slug) = lower(sb.slug)
     or lower(b.name) = lower(sb.name)
);

with seed_brands (slug, name) as (
  values
  ('bell-equipment', 'Bell Equipment'),
  ('bobcat', 'Bobcat'),
  ('caterpillar', 'Caterpillar'),
  ('ford', 'Ford'),
  ('hino', 'Hino'),
  ('hitachi', 'Hitachi'),
  ('hyster', 'Hyster'),
  ('isuzu', 'Isuzu'),
  ('jcb', 'JCB'),
  ('komatsu', 'Komatsu'),
  ('man', 'MAN'),
  ('manitou', 'Manitou'),
  ('mercedes-benz', 'Mercedes-Benz'),
  ('nissan', 'Nissan'),
  ('perkins', 'Perkins'),
  ('scania', 'Scania'),
  ('toyota', 'Toyota'),
  ('ud-trucks', 'UD Trucks'),
  ('volkswagen', 'Volkswagen'),
  ('volvo', 'Volvo'),
  ('yale', 'Yale')
)
update public.brands b
set
  is_active = true,
  updated_at = now()
from seed_brands sb
where lower(b.slug) = lower(sb.slug)
   or lower(b.name) = lower(sb.name);

-- 5) Link starter brands to starter families.
with seed_links (
  sector_key,
  family_key,
  brand_name,
  brand_slug,
  sort_order
) as (
  values
  ('motor', 'bakkies_ldvs', 'Toyota', 'toyota', 10),
  ('motor', 'bakkies_ldvs', 'Ford', 'ford', 20),
  ('motor', 'bakkies_ldvs', 'Isuzu', 'isuzu', 30),
  ('motor', 'bakkies_ldvs', 'Nissan', 'nissan', 40),
  ('motor', 'bakkies_ldvs', 'Volkswagen', 'volkswagen', 50),
  ('motor', 'cars_suvs', 'Toyota', 'toyota', 10),
  ('motor', 'cars_suvs', 'Ford', 'ford', 20),
  ('motor', 'cars_suvs', 'Volkswagen', 'volkswagen', 30),
  ('motor', 'cars_suvs', 'Nissan', 'nissan', 40),
  ('motor', 'light_commercial_vehicles', 'Toyota', 'toyota', 10),
  ('motor', 'light_commercial_vehicles', 'Ford', 'ford', 20),
  ('motor', 'light_commercial_vehicles', 'Mercedes-Benz', 'mercedes-benz', 30),
  ('motor', 'trucks', 'Hino', 'hino', 10),
  ('motor', 'trucks', 'Mercedes-Benz', 'mercedes-benz', 20),
  ('motor', 'trucks', 'MAN', 'man', 30),
  ('motor', 'trucks', 'Volvo', 'volvo', 40),
  ('motor', 'trucks', 'Scania', 'scania', 50),
  ('motor', 'trucks', 'UD Trucks', 'ud-trucks', 60),

  ('construction', 'excavators', 'Caterpillar', 'caterpillar', 10),
  ('construction', 'excavators', 'Komatsu', 'komatsu', 20),
  ('construction', 'excavators', 'JCB', 'jcb', 30),
  ('construction', 'excavators', 'Hitachi', 'hitachi', 40),
  ('construction', 'tlbs_backhoes', 'JCB', 'jcb', 10),
  ('construction', 'wheel_loaders', 'Caterpillar', 'caterpillar', 10),
  ('construction', 'wheel_loaders', 'Bell Equipment', 'bell-equipment', 20),
  ('construction', 'skid_steers', 'Bobcat', 'bobcat', 10),
  ('construction', 'telehandlers', 'Manitou', 'manitou', 10),

  ('industrial', 'forklifts', 'Toyota', 'toyota', 10),
  ('industrial', 'forklifts', 'Hyster', 'hyster', 20),
  ('industrial', 'forklifts', 'Yale', 'yale', 30),
  ('industrial', 'generators', 'Caterpillar', 'caterpillar', 10),
  ('industrial', 'generators', 'Perkins', 'perkins', 20)
),
resolved as (
  select distinct on (ef.id, b.id)
    s.id as sector_id,
    ef.id as equipment_family_id,
    b.id as brand_id,
    sl.sort_order
  from seed_links sl
  join public.sectors s
    on s.sector_key = sl.sector_key
  join public.equipment_families ef
    on ef.sector_id = s.id
   and ef.family_key = sl.family_key
  join public.brands b
    on lower(b.slug) = lower(sl.brand_slug)
    or lower(b.name) = lower(sl.brand_name)
  order by ef.id, b.id, sl.sort_order
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
  r.sector_id,
  r.equipment_family_id,
  r.brand_id,
  true,
  r.sort_order,
  now(),
  now()
from resolved r
on conflict (equipment_family_id, brand_id)
do update set
  sector_id = excluded.sector_id,
  sort_order = least(public.equipment_family_brands.sort_order, excluded.sort_order),
  is_active = true,
  updated_at = now();

-- 6) Upsert starter spec questions.
with seed_questions (
  sector_key,
  family_key,
  spec_key,
  label,
  input_type,
  unit,
  is_required,
  affects_value,
  use_for_market_matching,
  sort_order,
  help_text
) as (
  values
  ('construction', 'excavators', 'operating_weight_ton', 'Operating weight', 'number', 't', true, true, true, 10, 'Approximate machine class, e.g. 20 to 25 t'),
  ('construction', 'excavators', 'undercarriage_type', 'Undercarriage type', 'select', null, true, true, true, 20, 'Tracked or wheeled'),
  ('construction', 'tlbs_backhoes', 'drive_type', 'Drive type', 'select', null, true, true, true, 10, '2WD or 4WD'),
  ('construction', 'wheel_loaders', 'operating_weight_ton', 'Operating weight', 'number', 't', true, true, true, 10, 'Approximate machine class'),
  ('construction', 'skid_steers', 'lift_type', 'Lift type', 'select', null, false, true, true, 10, 'Radial or vertical lift'),
  ('construction', 'graders', 'power_kw', 'Engine power', 'number', 'kW', false, true, true, 10, 'Approximate engine power'),
  ('construction', 'rollers_compactors', 'roller_type', 'Roller type', 'select', null, true, true, true, 10, 'Smooth drum, padfoot or pneumatic'),
  ('construction', 'dumpers', 'payload_ton', 'Payload', 'number', 't', true, true, true, 10, 'Approximate payload'),
  ('construction', 'telehandlers', 'lift_capacity_ton', 'Lift capacity', 'number', 't', true, true, true, 10, 'Rated lift capacity'),

  ('industrial', 'forklifts', 'lift_capacity_ton', 'Lift capacity', 'number', 't', true, true, true, 10, 'Rated lift capacity'),
  ('industrial', 'forklifts', 'fuel_type', 'Fuel type', 'select', null, true, true, true, 20, 'Diesel, LPG or electric'),
  ('industrial', 'forklifts', 'mast_type', 'Mast type', 'select', null, false, true, true, 30, 'Duplex/triplex/etc.'),
  ('industrial', 'generators', 'power_kva', 'Power rating', 'number', 'kVA', true, true, true, 10, 'Generator rating'),
  ('industrial', 'generators', 'phase_type', 'Phase type', 'select', null, false, true, true, 20, 'Single or three phase'),
  ('industrial', 'generators', 'fuel_type', 'Fuel type', 'select', null, true, true, true, 30, 'Diesel/petrol/gas'),
  ('industrial', 'compressors', 'air_output_cfm', 'Air output', 'number', 'CFM', true, true, true, 10, 'Approximate compressor output'),
  ('industrial', 'warehouse_equipment', 'equipment_subtype', 'Equipment subtype', 'select', null, true, true, true, 10, 'Pallet jack, reach truck, stacker, etc.'),
  ('industrial', 'industrial_pumps', 'pump_type', 'Pump type', 'select', null, true, true, true, 10, 'Water, slurry, chemical, etc.'),
  ('industrial', 'lighting_towers', 'lamp_type', 'Lamp type', 'select', null, false, true, true, 10, 'LED or halogen'),

  ('motor', 'bakkies_ldvs', 'body_type', 'Body type', 'select', null, true, true, true, 10, 'Single cab, extra cab, double cab, SUV, panel van'),
  ('motor', 'bakkies_ldvs', 'fuel_type', 'Fuel type', 'select', null, true, true, true, 20, 'Diesel or petrol'),
  ('motor', 'bakkies_ldvs', 'transmission', 'Transmission', 'select', null, true, true, true, 30, 'Manual or automatic'),
  ('motor', 'bakkies_ldvs', 'drive_type', 'Drive type', 'select', null, true, true, true, 40, '4x2 or 4x4'),
  ('motor', 'cars_suvs', 'body_type', 'Body type', 'select', null, true, true, true, 10, 'Hatch, sedan, SUV, etc.'),
  ('motor', 'cars_suvs', 'fuel_type', 'Fuel type', 'select', null, true, true, true, 20, 'Petrol/diesel/hybrid/electric'),
  ('motor', 'light_commercial_vehicles', 'body_type', 'Body type', 'select', null, true, true, true, 10, 'Panel van, chassis cab, minibus, etc.'),
  ('motor', 'trucks', 'truck_type', 'Truck type', 'select', null, true, true, true, 10, 'Rigid, tipper, truck tractor, etc.'),
  ('motor', 'trucks', 'gvm_class', 'GVM class', 'select', null, false, true, true, 20, 'Light/medium/heavy/extra heavy'),
  ('motor', 'trailers', 'trailer_type', 'Trailer type', 'select', null, true, true, true, 10, 'Flatbed, dropside, tautliner, etc.'),
  ('motor', 'trailers', 'axle_count', 'Axle count', 'select', null, false, true, true, 20, 'Number of axles'),
  ('motor', 'buses', 'seat_count', 'Seat count', 'number', 'seats', false, true, true, 10, 'Approximate seating capacity')
),
resolved as (
  select
    s.id as sector_id,
    ef.id as equipment_family_id,
    sq.spec_key,
    sq.label,
    sq.input_type,
    sq.unit,
    sq.is_required,
    sq.affects_value,
    sq.use_for_market_matching,
    sq.sort_order,
    sq.help_text
  from seed_questions sq
  join public.sectors s
    on s.sector_key = sq.sector_key
  join public.equipment_families ef
    on ef.sector_id = s.id
   and ef.family_key = sq.family_key
)
insert into public.equipment_family_spec_questions (
  sector_id,
  equipment_family_id,
  spec_key,
  label,
  input_type,
  unit,
  is_required,
  affects_value,
  use_for_market_matching,
  sort_order,
  help_text,
  is_active,
  created_at,
  updated_at
)
select
  r.sector_id,
  r.equipment_family_id,
  r.spec_key,
  r.label,
  r.input_type,
  r.unit,
  r.is_required,
  r.affects_value,
  r.use_for_market_matching,
  r.sort_order,
  r.help_text,
  true,
  now(),
  now()
from resolved r
on conflict (equipment_family_id, spec_key)
do update set
  sector_id = excluded.sector_id,
  label = excluded.label,
  input_type = excluded.input_type,
  unit = excluded.unit,
  is_required = excluded.is_required,
  affects_value = excluded.affects_value,
  use_for_market_matching = excluded.use_for_market_matching,
  sort_order = excluded.sort_order,
  help_text = excluded.help_text,
  is_active = true,
  updated_at = now();

-- 7) Upsert starter spec options.
with seed_options (
  sector_key,
  family_key,
  spec_key,
  option_value,
  option_label,
  sort_order
) as (
  values
  ('construction', 'excavators', 'undercarriage_type', 'tracked', 'Tracked', 10),
  ('construction', 'excavators', 'undercarriage_type', 'wheeled', 'Wheeled', 20),
  ('construction', 'tlbs_backhoes', 'drive_type', 'two_wheel_drive', '2WD', 10),
  ('construction', 'tlbs_backhoes', 'drive_type', 'four_wheel_drive', '4WD', 20),
  ('construction', 'skid_steers', 'lift_type', 'radial_lift', 'Radial lift', 10),
  ('construction', 'skid_steers', 'lift_type', 'vertical_lift', 'Vertical lift', 20),
  ('construction', 'rollers_compactors', 'roller_type', 'smooth_drum', 'Smooth drum', 10),
  ('construction', 'rollers_compactors', 'roller_type', 'padfoot', 'Padfoot', 20),
  ('construction', 'rollers_compactors', 'roller_type', 'pneumatic', 'Pneumatic', 30),

  ('industrial', 'forklifts', 'fuel_type', 'diesel', 'Diesel', 10),
  ('industrial', 'forklifts', 'fuel_type', 'lpg', 'LPG', 20),
  ('industrial', 'forklifts', 'fuel_type', 'electric', 'Electric', 30),
  ('industrial', 'forklifts', 'mast_type', 'duplex', 'Duplex', 10),
  ('industrial', 'forklifts', 'mast_type', 'triplex', 'Triplex', 20),
  ('industrial', 'generators', 'phase_type', 'single_phase', 'Single phase', 10),
  ('industrial', 'generators', 'phase_type', 'three_phase', 'Three phase', 20),
  ('industrial', 'generators', 'fuel_type', 'diesel', 'Diesel', 10),
  ('industrial', 'generators', 'fuel_type', 'petrol', 'Petrol', 20),
  ('industrial', 'generators', 'fuel_type', 'gas', 'Gas', 30),
  ('industrial', 'warehouse_equipment', 'equipment_subtype', 'pallet_jack', 'Pallet jack', 10),
  ('industrial', 'warehouse_equipment', 'equipment_subtype', 'reach_truck', 'Reach truck', 20),
  ('industrial', 'warehouse_equipment', 'equipment_subtype', 'stacker', 'Stacker', 30),
  ('industrial', 'industrial_pumps', 'pump_type', 'water', 'Water pump', 10),
  ('industrial', 'industrial_pumps', 'pump_type', 'slurry', 'Slurry pump', 20),
  ('industrial', 'industrial_pumps', 'pump_type', 'chemical', 'Chemical pump', 30),
  ('industrial', 'lighting_towers', 'lamp_type', 'led', 'LED', 10),
  ('industrial', 'lighting_towers', 'lamp_type', 'halogen', 'Halogen', 20),

  ('motor', 'bakkies_ldvs', 'body_type', 'single_cab', 'Single cab', 10),
  ('motor', 'bakkies_ldvs', 'body_type', 'extra_cab', 'Extra cab', 20),
  ('motor', 'bakkies_ldvs', 'body_type', 'double_cab', 'Double cab', 30),
  ('motor', 'bakkies_ldvs', 'body_type', 'suv', 'SUV', 40),
  ('motor', 'bakkies_ldvs', 'body_type', 'panel_van', 'Panel van', 50),
  ('motor', 'bakkies_ldvs', 'fuel_type', 'diesel', 'Diesel', 10),
  ('motor', 'bakkies_ldvs', 'fuel_type', 'petrol', 'Petrol', 20),
  ('motor', 'bakkies_ldvs', 'transmission', 'manual', 'Manual', 10),
  ('motor', 'bakkies_ldvs', 'transmission', 'automatic', 'Automatic', 20),
  ('motor', 'bakkies_ldvs', 'drive_type', 'four_by_two', '4x2', 10),
  ('motor', 'bakkies_ldvs', 'drive_type', 'four_by_four', '4x4', 20),
  ('motor', 'cars_suvs', 'body_type', 'hatch', 'Hatch', 10),
  ('motor', 'cars_suvs', 'body_type', 'sedan', 'Sedan', 20),
  ('motor', 'cars_suvs', 'body_type', 'suv', 'SUV', 30),
  ('motor', 'cars_suvs', 'fuel_type', 'petrol', 'Petrol', 10),
  ('motor', 'cars_suvs', 'fuel_type', 'diesel', 'Diesel', 20),
  ('motor', 'cars_suvs', 'fuel_type', 'hybrid', 'Hybrid', 30),
  ('motor', 'cars_suvs', 'fuel_type', 'electric', 'Electric', 40),
  ('motor', 'light_commercial_vehicles', 'body_type', 'panel_van', 'Panel van', 10),
  ('motor', 'light_commercial_vehicles', 'body_type', 'chassis_cab', 'Chassis cab', 20),
  ('motor', 'light_commercial_vehicles', 'body_type', 'minibus', 'Minibus', 30),
  ('motor', 'trucks', 'truck_type', 'rigid', 'Rigid', 10),
  ('motor', 'trucks', 'truck_type', 'tipper', 'Tipper', 20),
  ('motor', 'trucks', 'truck_type', 'truck_tractor', 'Truck tractor', 30),
  ('motor', 'trucks', 'truck_type', 'dropside', 'Dropside', 40),
  ('motor', 'trucks', 'gvm_class', 'light', 'Light', 10),
  ('motor', 'trucks', 'gvm_class', 'medium', 'Medium', 20),
  ('motor', 'trucks', 'gvm_class', 'heavy', 'Heavy', 30),
  ('motor', 'trucks', 'gvm_class', 'extra_heavy', 'Extra heavy', 40),
  ('motor', 'trailers', 'trailer_type', 'flatbed', 'Flatbed', 10),
  ('motor', 'trailers', 'trailer_type', 'dropside', 'Dropside', 20),
  ('motor', 'trailers', 'trailer_type', 'tautliner', 'Tautliner', 30),
  ('motor', 'trailers', 'trailer_type', 'lowbed', 'Lowbed', 40),
  ('motor', 'trailers', 'axle_count', 'one', '1 axle', 10),
  ('motor', 'trailers', 'axle_count', 'two', '2 axles', 20),
  ('motor', 'trailers', 'axle_count', 'three_plus', '3+ axles', 30)
),
resolved as (
  select
    q.id as spec_question_id,
    so.option_value,
    so.option_label,
    so.sort_order
  from seed_options so
  join public.sectors s
    on s.sector_key = so.sector_key
  join public.equipment_families ef
    on ef.sector_id = s.id
   and ef.family_key = so.family_key
  join public.equipment_family_spec_questions q
    on q.equipment_family_id = ef.id
   and q.spec_key = so.spec_key
)
insert into public.equipment_family_spec_options (
  spec_question_id,
  option_value,
  option_label,
  sort_order,
  is_active,
  created_at,
  updated_at
)
select
  r.spec_question_id,
  r.option_value,
  r.option_label,
  r.sort_order,
  true,
  now(),
  now()
from resolved r
on conflict (spec_question_id, option_value)
do update set
  option_label = excluded.option_label,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

COMMIT;
