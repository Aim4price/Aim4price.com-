alter table public.asset_register_items
  add column if not exists marketplace_show_deal_rating boolean not null default true;

create table if not exists public.middleman_showrooms (
  user_id text primary key,
  slug text not null unique,
  bio text not null default '',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_middleman_showrooms_slug
  on public.middleman_showrooms (slug);
