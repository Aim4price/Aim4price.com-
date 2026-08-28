import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const migration = read('database/migrations/98-marketplace-listing-outcomes.sql');
const outcomeStore = read('lib/marketplace-outcomes.ts');
const outcomeApi = read('app/api/marketplace/outcomes/route.ts');
const marketplaceApi = read('app/api/marketplace/route.ts');
const accountDeletion = read('lib/account-deletion.ts');

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
