begin;

create table if not exists public.marketplace_listing_views (
  id bigserial primary key,
  view_event_id uuid not null unique,
  asset_register_item_id uuid not null
    references public.asset_register_items(id) on delete cascade,
  listing_reference text not null,
  seller_user_id text not null,
  viewer_user_id text,
  anonymous_viewer_hash text,
  view_window bigint not null,
  viewed_at timestamptz not null default now(),
  constraint marketplace_listing_views_viewer_identity_check
    check (num_nonnulls(viewer_user_id, anonymous_viewer_hash) = 1)
);

comment on table public.marketplace_listing_views is
  'First-party Marketplace detail opens used only by Aim4price Admin discovery reporting.';
comment on column public.marketplace_listing_views.anonymous_viewer_hash is
  'One-way hash of a random first-party browser id; no IP address or device fingerprint is stored.';

create index if not exists idx_marketplace_listing_views_asset_time
  on public.marketplace_listing_views(asset_register_item_id, viewed_at desc);

create index if not exists idx_marketplace_listing_views_account_repeat
  on public.marketplace_listing_views(asset_register_item_id, viewer_user_id, viewed_at desc)
  where viewer_user_id is not null;

create index if not exists idx_marketplace_listing_views_unknown_repeat
  on public.marketplace_listing_views(asset_register_item_id, anonymous_viewer_hash, viewed_at desc)
  where anonymous_viewer_hash is not null;

-- These two small unique indexes also collapse concurrent duplicate opens.
create unique index if not exists idx_marketplace_listing_views_account_window
  on public.marketplace_listing_views(asset_register_item_id, viewer_user_id, view_window)
  where viewer_user_id is not null;

create unique index if not exists idx_marketplace_listing_views_unknown_window
  on public.marketplace_listing_views(asset_register_item_id, anonymous_viewer_hash, view_window)
  where anonymous_viewer_hash is not null;

commit;
