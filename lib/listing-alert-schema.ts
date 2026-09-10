import { getDb } from './db';
let ready: Promise<void> | undefined;
/** Called after the existing marketplace tables have been ensured. */
export function ensureListingAlertSchema() {
  if (!ready) ready = getDb().query(`
    create table if not exists app_listing_publications (
      listing_key text primary key, seller_id text not null, first_published_at timestamptz not null default now());
    create table if not exists app_listing_watches (
      app text not null check(app in ('owner','dealer','middleman')), account_id text not null, member_id text not null,
      filters jsonb not null, enabled boolean not null default true, delivery text not null check(delivery in ('daily','instant')),
      starts_at timestamptz not null default now(), primary key(app,account_id,member_id));
    create index if not exists app_listing_publications_date on app_listing_publications(first_published_at);
    create or replace function capture_app_listing_publication() returns trigger language plpgsql as $fn$
    begin
      if TG_TABLE_NAME = 'asset_register_items' then
        if new.marketplace_status = 'live' then
          insert into app_listing_publications(listing_key,seller_id) values('asset-' || new.id::text,new.user_id)
            on conflict do nothing;
        end if;
      elsif new.asset_register_item_id is null and lower(new.status) = 'live' then
        insert into app_listing_publications(listing_key,seller_id) values(new.id::text,new.user_id)
          on conflict do nothing;
      end if;
      return new;
    end $fn$;
    drop trigger if exists app_listing_publication on asset_register_items;
    create trigger app_listing_publication after insert or update of marketplace_status on asset_register_items
      for each row execute function capture_app_listing_publication();
    drop trigger if exists app_listing_publication on marketplace_listings;
    create trigger app_listing_publication after insert or update of status on marketplace_listings
      for each row execute function capture_app_listing_publication();
    -- Existing stock is a baseline, not a new-listing blast. Watch start times are saved afterwards.
    insert into app_listing_publications(listing_key,seller_id)
      select 'asset-' || id::text,user_id from asset_register_items where marketplace_status='live' on conflict do nothing;
    insert into app_listing_publications(listing_key,seller_id)
      select id::text,user_id from marketplace_listings where asset_register_item_id is null and lower(status)='live' on conflict do nothing;
  `).then(() => undefined).catch(error => { ready = undefined; throw error; });
  return ready;
}
