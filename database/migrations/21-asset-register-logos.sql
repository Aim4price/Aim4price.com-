-- Asset register logo support.
-- Adds optional multiple logos per register and a display toggle.
-- Safe to run more than once.

alter table if exists public.asset_registers
  add column if not exists logo_urls jsonb not null default '[]'::jsonb,
  add column if not exists show_logos_on_register boolean not null default true;

update public.asset_registers
set logo_urls = '[]'::jsonb
where logo_urls is null;

update public.asset_registers
set show_logos_on_register = true
where show_logos_on_register is null;

alter table if exists public.asset_registers
  alter column logo_urls set default '[]'::jsonb,
  alter column logo_urls set not null,
  alter column show_logos_on_register set default true,
  alter column show_logos_on_register set not null;
