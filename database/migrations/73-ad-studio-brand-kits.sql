create table if not exists ad_brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  template_id text not null default 'showcase',
  logo_url text,
  primary_color text not null default '#165340',
  secondary_color text not null default '#0D3329',
  accent_color text not null default '#F2B84B',
  business_name text,
  contact_name text,
  phone text,
  email text,
  website text,
  language text not null default 'en',
  vat_label text not null default 'plus-vat',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_brand_kits_template_check check (
    template_id in ('showcase', 'price-focus', 'photo-first', 'classic', 'minimal')
  ),
  constraint ad_brand_kits_language_check check (language in ('en', 'af')),
  constraint ad_brand_kits_vat_label_check check (vat_label in ('plus-vat', 'vat-included', 'no-vat'))
);

create index if not exists idx_ad_brand_kits_user_updated
  on ad_brand_kits(user_id, updated_at desc);

create unique index if not exists idx_ad_brand_kits_one_default
  on ad_brand_kits(user_id)
  where is_default;

alter table asset_register_items
  add column if not exists marketplace_ad_brand jsonb;
