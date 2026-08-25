-- Dealer-owned inventory uses the same account-scoped Asset Register as an
-- owner, while transfer intent keeps trade-ins dealer-only at claim time.

begin;

alter table if exists public.asset_transfer_offers
  add column if not exists transfer_reason text not null default 'sold',
  add column if not exists recipient_account_type text not null default 'owner_or_dealer';

update public.asset_transfer_offers offer
set transfer_reason = case
      when event.reason = 'traded_in' then 'traded_in'
      else 'sold'
    end,
    recipient_account_type = case
      when event.reason = 'traded_in' then 'dealer'
      else 'owner_or_dealer'
    end
from public.asset_lifecycle_events event
where event.transfer_offer_id = offer.id
  and event.reason in ('sold', 'traded_in');

alter table if exists public.asset_transfer_offers
  drop constraint if exists asset_transfer_offers_transfer_reason_check,
  drop constraint if exists asset_transfer_offers_recipient_account_type_check;

alter table if exists public.asset_transfer_offers
  add constraint asset_transfer_offers_transfer_reason_check
    check (transfer_reason in ('sold', 'traded_in')),
  add constraint asset_transfer_offers_recipient_account_type_check
    check (recipient_account_type in ('owner_or_dealer', 'dealer'));

create index if not exists idx_asset_transfer_recipient_status
  on public.asset_transfer_offers(recipient_account_type, status, created_at desc);

commit;
