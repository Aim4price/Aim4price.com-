BEGIN;

-- 1) New generic foundation tables
create table if not exists public.sectors (
  id bigserial primary key,
  sector_key text not null unique,
  sector_label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment_families (
  id bigserial primary key,
  sector_id bigint not null references public.sectors(id) on delete restrict,
  family_key text not null,
  family_label text not null,
  is_propelled boolean not null default true,
  usage_metric_type text not null default 'hours',
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sector_id, family_key)
);

create table if not exists public.equipment_models (
  id bigserial primary key,
  equipment_family_id bigint not null references public.equipment_families(id) on delete restrict,
  brand_id integer references public.brands(id) on delete restrict,
  legacy_tractor_catalog_id integer unique,
  model_name text not null,
  variant_name text,
  normalized_model_name text not null,
  display_name text not null,
  year_start integer,
  year_end integer,
  power_kw integer,
  tractor_type text,
  drive_type text,
  cab_type text,
  working_width_m numeric(10,2),
  rows_count integer,
  tank_capacity_l integer,
  specs_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipment_models_family_brand_name
  on public.equipment_models(equipment_family_id, brand_id, normalized_model_name);

create index if not exists idx_equipment_models_legacy_tractor_catalog_id
  on public.equipment_models(legacy_tractor_catalog_id)
  where legacy_tractor_catalog_id is not null;

create table if not exists public.equipment_model_aliases (
  id bigserial primary key,
  equipment_model_id bigint not null references public.equipment_models(id) on delete cascade,
  alias_text text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  unique (equipment_model_id, normalized_alias)
);

create index if not exists idx_equipment_model_aliases_normalized_alias
  on public.equipment_model_aliases(normalized_alias);

create table if not exists public.replacement_price_references (
  id bigserial primary key,
  equipment_model_id bigint not null references public.equipment_models(id) on delete cascade,
  reference_year integer not null,
  replacement_price_ex_vat numeric(14,2) not null,
  currency_code text not null default 'ZAR',
  source_name text not null,
  source_url text,
  confidence_score numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (equipment_model_id, reference_year, source_name)
);

create index if not exists idx_replacement_price_references_model_year
  on public.replacement_price_references(equipment_model_id, reference_year desc);

create table if not exists public.valuation_profiles (
  id bigserial primary key,
  equipment_family_id bigint not null references public.equipment_families(id) on delete cascade,
  profile_key text not null unique,
  is_propelled boolean not null default true,
  usage_metric_type text not null default 'hours',
  max_use_hours integer,
  age_curve jsonb not null default '{}'::jsonb,
  usage_curve jsonb not null default '{}'::jsonb,
  condition_curve jsonb not null default '{}'::jsonb,
  floor_percent numeric(5,2) not null default 20,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (equipment_family_id)
);

create table if not exists public.fallback_price_bands (
  id bigserial primary key,
  equipment_family_id bigint not null references public.equipment_families(id) on delete cascade,
  band_label text not null,
  spec_type text not null,
  spec_min numeric(14,2),
  spec_max numeric(14,2),
  year_from integer,
  year_to integer,
  replacement_price_ex_vat numeric(14,2) not null,
  currency_code text not null default 'ZAR',
  confidence_score numeric(5,2),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fallback_price_bands_family_spec
  on public.fallback_price_bands(equipment_family_id, spec_type, year_from, year_to);

-- 2) Add generic link columns to existing live tables
alter table if exists public.market_vault_listings
  add column if not exists sector_id bigint,
  add column if not exists equipment_family_id bigint,
  add column if not exists equipment_model_id bigint;

alter table if exists public.valuation_runs
  add column if not exists sector_id bigint,
  add column if not exists equipment_family_id bigint,
  add column if not exists equipment_model_id bigint;

alter table if exists public.asset_register_items
  add column if not exists sector_id bigint,
  add column if not exists equipment_family_id bigint,
  add column if not exists equipment_model_id bigint;

create index if not exists idx_market_vault_listings_sector_id on public.market_vault_listings(sector_id);
create index if not exists idx_market_vault_listings_equipment_family_id on public.market_vault_listings(equipment_family_id);
create index if not exists idx_market_vault_listings_equipment_model_id on public.market_vault_listings(equipment_model_id);

create index if not exists idx_valuation_runs_sector_id on public.valuation_runs(sector_id);
create index if not exists idx_valuation_runs_equipment_family_id on public.valuation_runs(equipment_family_id);
create index if not exists idx_valuation_runs_equipment_model_id on public.valuation_runs(equipment_model_id);

create index if not exists idx_asset_register_items_sector_id on public.asset_register_items(sector_id);
create index if not exists idx_asset_register_items_equipment_family_id on public.asset_register_items(equipment_family_id);
create index if not exists idx_asset_register_items_equipment_model_id on public.asset_register_items(equipment_model_id);

-- 3) Foreign keys on the new nullable link columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_market_vault_listings_sector_id') THEN
    ALTER TABLE public.market_vault_listings
      ADD CONSTRAINT fk_market_vault_listings_sector_id
      FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_market_vault_listings_equipment_family_id') THEN
    ALTER TABLE public.market_vault_listings
      ADD CONSTRAINT fk_market_vault_listings_equipment_family_id
      FOREIGN KEY (equipment_family_id) REFERENCES public.equipment_families(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_market_vault_listings_equipment_model_id') THEN
    ALTER TABLE public.market_vault_listings
      ADD CONSTRAINT fk_market_vault_listings_equipment_model_id
      FOREIGN KEY (equipment_model_id) REFERENCES public.equipment_models(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_valuation_runs_sector_id') THEN
    ALTER TABLE public.valuation_runs
      ADD CONSTRAINT fk_valuation_runs_sector_id
      FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_valuation_runs_equipment_family_id') THEN
    ALTER TABLE public.valuation_runs
      ADD CONSTRAINT fk_valuation_runs_equipment_family_id
      FOREIGN KEY (equipment_family_id) REFERENCES public.equipment_families(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_valuation_runs_equipment_model_id') THEN
    ALTER TABLE public.valuation_runs
      ADD CONSTRAINT fk_valuation_runs_equipment_model_id
      FOREIGN KEY (equipment_model_id) REFERENCES public.equipment_models(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_asset_register_items_sector_id') THEN
    ALTER TABLE public.asset_register_items
      ADD CONSTRAINT fk_asset_register_items_sector_id
      FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_asset_register_items_equipment_family_id') THEN
    ALTER TABLE public.asset_register_items
      ADD CONSTRAINT fk_asset_register_items_equipment_family_id
      FOREIGN KEY (equipment_family_id) REFERENCES public.equipment_families(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_asset_register_items_equipment_model_id') THEN
    ALTER TABLE public.asset_register_items
      ADD CONSTRAINT fk_asset_register_items_equipment_model_id
      FOREIGN KEY (equipment_model_id) REFERENCES public.equipment_models(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
