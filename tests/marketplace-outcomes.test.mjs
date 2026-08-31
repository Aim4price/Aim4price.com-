import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const migration = read('database/migrations/98-marketplace-listing-outcomes.sql');
const outcomeStore = read('lib/marketplace-outcomes.ts');
const outcomeApi = read('app/api/marketplace/outcomes/route.ts');
const marketplaceStore = read('lib/marketplace-db.ts');
const marketplaceApi = read('app/api/marketplace/route.ts');
const accountDeletion = read('lib/account-deletion.ts');
const showroomStore = read('lib/middleman-showroom-db.ts');
const showroomApi = read('app/api/middleman-showroom/route.ts');

test('Marketplace outcomes retain an immutable seller result without deleting the asset', () => {
  assert.match(migration, /create table if not exists public\.marketplace_listing_outcomes/);
  assert.match(migration, /marketplace_listing_id uuid[\s\S]*?on delete set null/);
  assert.match(migration, /asset_register_item_id uuid[\s\S]*?on delete set null/);
  assert.match(migration, /aim4price_helped boolean not null/);
  assert.match(migration, /final_sale_price_ex_vat numeric\(14,2\)/);
  assert.match(migration, /source_surface in \('marketplace', 'showroom'\)/);
  assert.match(migration, /total_views_at_close = account_views_at_close \+ unknown_views_at_close/);
  assert.match(migration, /create unique index if not exists idx_marketplace_listing_outcomes_listing/);
});

test('closing an advert is seller-scoped, transactional and preserves its history', () => {
  assert.match(outcomeStore, /export async function closeMarketplaceListingWithOutcome/);
  assert.match(outcomeStore, /where id = \$1::uuid and user_id = \$2[\s\S]*?for update/);
  assert.match(outcomeStore, /MARKETPLACE_LISTING_NOT_LIVE/);
  assert.match(outcomeStore, /set marketplace_status = 'draft'/);
  assert.match(outcomeStore, /set status = 'withdrawn'/);
  assert.match(outcomeStore, /insert into public\.marketplace_listing_outcomes/);
  assert.match(outcomeStore, /await client\.query\('begin'\)/);
  assert.match(outcomeStore, /await client\.query\('commit'\)/);
  assert.match(outcomeStore, /await client\.query\('rollback'\)/);
  assert.doesNotMatch(outcomeStore, /delete from public\.asset_register_items/);
  assert.doesNotMatch(outcomeStore, /delete from public\.marketplace_listings/);
});

test('listing-only adverts can close without inventing an asset reference', () => {
  assert.match(outcomeStore, /assetId\?: string \| null/);
  assert.match(outcomeStore, /listingId\?: string \| null/);
  assert.match(outcomeStore, /assetId: string \| null/);
  assert.match(outcomeStore, /marketplaceStatus: 'draft' \| null/);
  assert.match(outcomeStore, /if \(validated\.assetId\)[\s\S]*?else \{/);
  assert.match(
    outcomeStore,
    /from public\.marketplace_listings[\s\S]*?where id = \$1::uuid and user_id = \$2[\s\S]*?for update/,
  );
  assert.match(outcomeStore, /MARKETPLACE_OUTCOME_ASSET_REFERENCE_REQUIRED/);
  assert.match(
    outcomeStore,
    /where id = \$1::uuid[\s\S]*?and user_id = \$2[\s\S]*?lower\(coalesce\(status, ''\)\) = 'live'/,
  );
  assert.match(outcomeStore, /validated\.assetId \? 'draft' : null/);
  assert.match(outcomeStore, /error\.code === '23505'[\s\S]*?MARKETPLACE_OUTCOME_ALREADY_RECORDED/);
  assert.match(outcomeApi, /listingId\?: unknown/);
  assert.match(outcomeApi, /listingId: String\(body\.listingId \?\? ''\)\.trim\(\) \|\| null/);
  assert.match(outcomeApi, /sellerUserId: session\.user\.id/);
  assert.match(
    marketplaceStore,
    /listing\.asset_register_item_id is null[\s\S]*?lower\(coalesce\(listing\.status, ''\)\) = 'live'/,
  );
  assert.match(marketplaceStore, /listingSnapshot: true/);
});

test('every removal requires an explicit Aim4price yes or no answer', () => {
  assert.match(outcomeStore, /typeof input\.aim4priceHelped !== 'boolean'/);
  assert.match(outcomeStore, /MARKETPLACE_OUTCOME_HELP_RESPONSE_REQUIRED/);
  assert.match(outcomeStore, /outcomeReason === 'other' && outcomeNote\.length < 3/);
  assert.match(outcomeStore, /outcomeReason !== 'sold' && outcomeReason !== 'traded'/);
  assert.match(outcomeStore, /outcomeReason === 'other' && outcomeNote\.length < 3/);
  assert.match(outcomeApi, /Please tell us whether Aim4price helped with this outcome\./);
  assert.match(outcomeApi, /allowDealerApp: true, allowOwnerApp: true/);
  assert.match(outcomeApi, /dealerRoleCan\(session\.dealerApp\.role, 'marketplace'\)/);
  assert.match(outcomeApi, /sellerUserId: session\.user\.id/);
  assert.match(outcomeApi, /body\.finalSalePriceExVat === null/);
  assert.doesNotMatch(outcomeApi, /sellerUserId:\s*String\(body/);
  assert.match(marketplaceApi, /Use the guided Remove advert flow/);
  assert.doesNotMatch(marketplaceApi, /await removeAssetRegisterItemFromMarketplace/);
});

test('outcome snapshots are removed with a full account deletion', () => {
  const outcomeIndex = accountDeletion.indexOf("'marketplace_listing_outcomes'");
  const assetIndex = accountDeletion.indexOf("'asset_register_items'");
  assert.ok(outcomeIndex >= 0);
  assert.ok(assetIndex >= 0);
  assert.ok(outcomeIndex < assetIndex);
  assert.match(accountDeletion, /tableName === 'marketplace_listing_outcomes'[\s\S]*?'seller_user_id'/);
  assert.match(accountDeletion, /set actor_id = null[\s\S]*?where actor_id = \$1 and seller_user_id <> \$1/);
});

test('showroom deletion cannot bypass outcome capture or erase withdrawn advert history', () => {
  assert.match(showroomStore, /select marketplace_status[\s\S]*?from asset_register_items[\s\S]*?for update/);
  assert.match(showroomStore, /select status[\s\S]*?from marketplace_listings[\s\S]*?for update/);
  assert.match(showroomStore, /assetRows\.rows\.some\([\s\S]*?row\.marketplace_status[\s\S]*?=== 'live'/);
  assert.match(showroomStore, /listingRows\.rows\.some\([\s\S]*?row\.status[\s\S]*?=== 'live'/);
  assert.match(showroomStore, /SHOWROOM_LIVE_ADVERTS_REQUIRE_OUTCOMES/);
  assert.match(showroomStore, /delete from middleman_showrooms where user_id = \$1/);
  assert.doesNotMatch(showroomStore, /delete from marketplace_listings/);
  assert.doesNotMatch(showroomStore, /delete from marketplace_listing_outcomes/);
  assert.match(showroomStore, /await client\.query\('ROLLBACK'\)/);
  assert.match(showroomApi, /SHOWROOM_LIVE_ADVERTS_REQUIRE_OUTCOMES/);
  assert.match(showroomApi, /record its outcome before deleting the showroom/);
  assert.match(showroomApi, /status: 409/);
});
