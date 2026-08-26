begin;

create table if not exists public.asset_discovery_views (
  id bigserial primary key,
  view_event_id uuid not null unique,
  asset_register_item_id uuid not null
    references public.asset_register_items(id) on delete cascade,
  owner_user_id text not null,
  viewer_user_id text,
  anonymous_viewer_hash text,
  view_window bigint not null,
  viewed_at timestamptz not null default now(),
  constraint asset_discovery_views_viewer_identity_check
    check (num_nonnulls(viewer_user_id, anonymous_viewer_hash) = 1)
);

comment on table public.asset_discovery_views is
  'Successful protected Discovery detail opens used only by Aim4price Admin reporting.';
comment on column public.asset_discovery_views.anonymous_viewer_hash is
  'Reserved privacy-safe identity for a future anonymous Discovery surface; current Discovery requires an account.';

create index if not exists idx_asset_discovery_views_asset_time
  on public.asset_discovery_views(asset_register_item_id, viewed_at desc);

create index if not exists idx_asset_discovery_views_account_repeat
  on public.asset_discovery_views(asset_register_item_id, viewer_user_id, viewed_at desc)
  where viewer_user_id is not null;

create index if not exists idx_asset_discovery_views_unknown_repeat
  on public.asset_discovery_views(asset_register_item_id, anonymous_viewer_hash, viewed_at desc)
  where anonymous_viewer_hash is not null;

-- Collapse double-clicks, request retries and concurrent opens from one viewer.
create unique index if not exists idx_asset_discovery_views_account_window
  on public.asset_discovery_views(asset_register_item_id, viewer_user_id, view_window)
  where viewer_user_id is not null;

create unique index if not exists idx_asset_discovery_views_unknown_window
  on public.asset_discovery_views(asset_register_item_id, anonymous_viewer_hash, view_window)
  where anonymous_viewer_hash is not null;

commit;
