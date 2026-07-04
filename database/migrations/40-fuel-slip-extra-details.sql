-- Fuel slip extra posting details for two-step manual/review completion.
-- Idempotent migration: safe to run multiple times.

alter table if exists public.fuel_slips
  add column if not exists operator_name text,
  add column if not exists activity_text text,
  add column if not exists work_area_text text,
  add column if not exists note text,
  add column if not exists asset_fuel_percent_before integer,
  add column if not exists asset_fuel_percent_after integer;

alter table if exists public.fuel_slips
  drop constraint if exists fuel_slips_asset_fuel_percent_before_check;

alter table if exists public.fuel_slips
  add constraint fuel_slips_asset_fuel_percent_before_check
  check (asset_fuel_percent_before is null or (asset_fuel_percent_before >= 0 and asset_fuel_percent_before <= 100));

alter table if exists public.fuel_slips
  drop constraint if exists fuel_slips_asset_fuel_percent_after_check;

alter table if exists public.fuel_slips
  add constraint fuel_slips_asset_fuel_percent_after_check
  check (asset_fuel_percent_after is null or (asset_fuel_percent_after >= 0 and asset_fuel_percent_after <= 100));
