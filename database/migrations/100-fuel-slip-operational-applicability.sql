alter table if exists public.fuel_slips
  add column if not exists usage_not_applicable boolean not null default false,
  add column if not exists operator_not_applicable boolean not null default false,
  add column if not exists activity_not_applicable boolean not null default false,
  add column if not exists work_area_not_applicable boolean not null default false;

update public.fuel_slips
set
  usage_not_applicable = coalesce(usage_not_applicable, false),
  operator_not_applicable = coalesce(operator_not_applicable, false),
  activity_not_applicable = coalesce(activity_not_applicable, false),
  work_area_not_applicable = coalesce(work_area_not_applicable, false);

alter table if exists public.fuel_slips
  alter column usage_not_applicable set default false,
  alter column usage_not_applicable set not null,
  alter column operator_not_applicable set default false,
  alter column operator_not_applicable set not null,
  alter column activity_not_applicable set default false,
  alter column activity_not_applicable set not null,
  alter column work_area_not_applicable set default false,
  alter column work_area_not_applicable set not null;
