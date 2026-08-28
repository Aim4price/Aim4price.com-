begin;

create table if not exists public.marketplace_listing_outcomes (
  id uuid primary key default gen_random_uuid(),
  marketplace_listing_id uuid
    references public.marketplace_listings(id) on delete set null,
  asset_register_item_id uuid
    references public.asset_register_items(id) on delete set null,
  seller_user_id text not null,
  outcome_reason text not null,
  aim4price_helped boolean not null,
  final_sale_price_ex_vat numeric(14,2),
  outcome_note text not null default '',
  source_surface text not null,
  title_snapshot text not null,
  asking_price_ex_vat_snapshot numeric(14,2) not null default 0,
  aim4price_value_ex_vat_snapshot numeric(14,2),
  total_views_at_close bigint not null default 0,
  account_views_at_close bigint not null default 0,
  unknown_views_at_close bigint not null default 0,
  unique_viewers_at_close bigint not null default 0,
  published_at timestamptz,
  closed_at timestamptz not null default now(),
  actor_type text not null default 'account',
  actor_id text,
  constraint marketplace_listing_outcomes_reason_check
    check (outcome_reason in (
      'sold', 'traded', 'no_longer_available', 'decided_not_to_sell',
      'created_by_mistake', 'other'
    )),
  constraint marketplace_listing_outcomes_source_check
    check (source_surface in ('marketplace', 'showroom')),
  constraint marketplace_listing_outcomes_actor_check
    check (actor_type in ('account', 'dealer_staff', 'owner_app', 'admin_support')),
  constraint marketplace_listing_outcomes_final_price_check
    check (
      final_sale_price_ex_vat is null
      or (
        outcome_reason in ('sold', 'traded')
        and final_sale_price_ex_vat > 0
      )
    ),
  constraint marketplace_listing_outcomes_snapshot_values_check
    check (
      asking_price_ex_vat_snapshot >= 0
      and (aim4price_value_ex_vat_snapshot is null or aim4price_value_ex_vat_snapshot >= 0)
    ),
  constraint marketplace_listing_outcomes_view_counts_check
    check (
      total_views_at_close >= 0
      and account_views_at_close >= 0
      and unknown_views_at_close >= 0
      and unique_viewers_at_close >= 0
      and total_views_at_close = account_views_at_close + unknown_views_at_close
    ),
  constraint marketplace_listing_outcomes_note_length_check
    check (
      char_length(outcome_note) <= 500
      and (outcome_reason <> 'other' or char_length(trim(outcome_note)) >= 3)
    )
);

comment on table public.marketplace_listing_outcomes is
  'Immutable seller-reported outcomes captured whenever a live Marketplace advert is closed.';

comment on column public.marketplace_listing_outcomes.aim4price_helped is
  'Explicit seller answer saved for both yes and no so Admin conversion reporting has a valid denominator.';

comment on column public.marketplace_listing_outcomes.total_views_at_close is
  'Recorded detail views for the listing cycle, from its latest published timestamp until closure.';

create unique index if not exists idx_marketplace_listing_outcomes_listing
  on public.marketplace_listing_outcomes(marketplace_listing_id)
  where marketplace_listing_id is not null;

create index if not exists idx_marketplace_listing_outcomes_seller_closed
  on public.marketplace_listing_outcomes(seller_user_id, closed_at desc);

create index if not exists idx_marketplace_listing_outcomes_helped_closed
  on public.marketplace_listing_outcomes(aim4price_helped, closed_at desc);

create index if not exists idx_marketplace_listing_outcomes_reason_closed
  on public.marketplace_listing_outcomes(outcome_reason, closed_at desc);

commit;
