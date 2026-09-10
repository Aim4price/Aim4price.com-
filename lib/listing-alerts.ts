import { getDb } from './db';
import { ensureMarketplaceColumns, listPublishedMarketplaceAssetListings } from './marketplace-db';
import { EMPTY_LISTING_FILTERS, matchesListingWatch, type ListingWatch } from './listing-alert-policy';
import { PUSH_APPS } from './push-policy';
import type { PushIdentity } from './push-store';
import type { PushEvent } from './push-events';
export async function getListingWatch(who: PushIdentity): Promise<ListingWatch> {
  await ensureMarketplaceColumns();
  const r = await getDb().query('select enabled,delivery,filters from app_listing_watches where app=$1 and account_id=$2 and member_id=$3', [who.app,who.accountId,who.memberId]);
  return r.rows[0] ?? { enabled: false, delivery: 'daily', filters: { ...EMPTY_LISTING_FILTERS } };
}
export async function saveListingWatch(who: PushIdentity, watch: ListingWatch) {
  await ensureMarketplaceColumns();
  await getDb().query(`insert into app_listing_watches(app,account_id,member_id,enabled,delivery,filters)
    values($1,$2,$3,$4,$5,$6::jsonb) on conflict(app,account_id,member_id) do update set
      starts_at=case when app_listing_watches.filters<>excluded.filters or (not app_listing_watches.enabled and excluded.enabled)
        then now() else app_listing_watches.starts_at end,
      enabled=excluded.enabled,delivery=excluded.delivery,filters=excluded.filters`,
    [who.app,who.accountId,who.memberId,watch.enabled,watch.delivery,JSON.stringify(watch.filters)]);
}
export async function listMatchingListingEvents(who: PushIdentity): Promise<PushEvent[]> {
  const watch = await getListingWatch(who);
  if (!watch.enabled) return [];
  const publications = await getDb().query<{ listing_key: string; first_published_at: Date }>(`
    select p.listing_key,p.first_published_at from app_listing_publications p
    join app_listing_watches w on w.app=$1 and w.account_id=$2 and w.member_id=$3
    join account_profiles seller on seller.user_id=p.seller_id and seller.account_status='active'
    where w.enabled=true and p.seller_id<>$2 and p.first_published_at>w.starts_at
      and p.first_published_at>now()-interval '30 days'
    order by p.first_published_at desc,p.listing_key`, [who.app,who.accountId,who.memberId]);
  if (!publications.rows.length) return [];
  const published = new Map<string,string>(publications.rows.map(row => [row.listing_key,new Date(row.first_published_at).toISOString()]));
  // Reuse public Marketplace visibility and classification. Never search private Discovery assets.
  const listings = await listPublishedMarketplaceAssetListings({ viewerUserId:who.accountId, exposeContact:false });
  return listings.filter(listing => published.has(listing.id) && !listing.canManage && matchesListingWatch(watch.filters,listing))
    .map(listing => ({ id:`listing:${listing.id}`, category:'listings' as const,
      title:'New listing matching your interests', body:`${listing.title} · ${listing.province} · R${listing.askingPriceExVat.toLocaleString('en-ZA')} excl. VAT`,
      href:`${PUSH_APPS[who.app].root}/marketplace?listing=${encodeURIComponent(listing.id)}`,
      createdAtIso:published.get(listing.id)!, delivery:watch.delivery }));
}
