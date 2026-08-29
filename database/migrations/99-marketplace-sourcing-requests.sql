begin;

create extension if not exists pgcrypto;

create table if not exists public.marketplace_sourcing_requests (
  id uuid primary key default gen_random_uuid(),
  marketplace_listing_id uuid not null
    references public.marketplace_listings(id) on delete cascade,
  asset_register_item_id uuid,
  advertiser_user_id text not null
    references public.account_profiles(user_id) on delete cascade,
  requester_user_id text not null
    references public.account_profiles(user_id) on delete cascade,
  requester_account_type text not null,
  status text not null default 'pending',
  requester_message text not null default '',
  requester_contact_name text not null,
  requester_contact_phone text not null default '',
  requester_contact_email text not null default '',
  advert_title_snapshot text not null,
  advertiser_name_snapshot text not null,
  advert_status_snapshot text not null,
  advert_published_at timestamptz not null,
  created_at timestamptz not null default now(),
  viewed_at timestamptz,
  declined_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint marketplace_sourcing_requests_requester_type_check
    check (requester_account_type in ('owner', 'dealer')),
  constraint marketplace_sourcing_requests_status_check
    check (status in ('pending', 'viewed', 'declined', 'closed')),
  constraint marketplace_sourcing_requests_advert_status_check
    check (advert_status_snapshot in ('available', 'sold', 'ended')),
  constraint marketplace_sourcing_requests_distinct_users_check
    check (advertiser_user_id <> requester_user_id),
  constraint marketplace_sourcing_requests_contact_check
    check (
      char_length(trim(requester_contact_phone)) > 0
      or char_length(trim(requester_contact_email)) > 0
    ),
  constraint marketplace_sourcing_requests_lengths_check
    check (
      char_length(advertiser_user_id) between 1 and 200
      and char_length(requester_user_id) between 1 and 200
      and char_length(requester_message) <= 600
      and char_length(requester_contact_name) between 1 and 200
      and char_length(requester_contact_phone) <= 80
      and char_length(requester_contact_email) <= 320
      and char_length(advert_title_snapshot) between 1 and 500
      and char_length(advertiser_name_snapshot) between 1 and 300
    )
);

comment on table public.marketplace_sourcing_requests is
  'Privacy-preserving requests asking a previous Marketplace advertiser to help source similar equipment.';

comment on column public.marketplace_sourcing_requests.requester_contact_phone is
  'Requester Marketplace contact shared only with the targeted advertiser after that advertiser opens the request.';

comment on column public.marketplace_sourcing_requests.requester_contact_email is
  'Requester Marketplace contact shared only with the targeted advertiser after that advertiser opens the request.';

create unique index if not exists idx_marketplace_sourcing_requests_active_once
  on public.marketplace_sourcing_requests(marketplace_listing_id, requester_user_id)
  where status in ('pending', 'viewed');

create index if not exists idx_marketplace_sourcing_requests_advertiser_status
  on public.marketplace_sourcing_requests(advertiser_user_id, status, created_at desc);

create index if not exists idx_marketplace_sourcing_requests_requester_created
  on public.marketplace_sourcing_requests(requester_user_id, created_at desc);

commit;
