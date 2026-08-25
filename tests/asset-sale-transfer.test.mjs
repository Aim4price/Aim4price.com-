import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  transferSource,
  transferRoute,
  ownerRoute,
  ownerClient,
  accountClient,
  transferPage,
  adminSales,
  adminPage,
  adminNavigation,
  migration,
] = await Promise.all([
  read('lib/asset-transfers.ts'),
  read('app/api/asset-transfers/route.ts'),
  read('app/api/owner-app/assets/[assetId]/route.ts'),
  read('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx'),
  read('app/account/account-client.tsx'),
  read('app/account/asset-transfers/asset-transfers-client.tsx'),
  read('lib/admin-asset-sales.ts'),
  read('app/admin/sold-assets/page.tsx'),
  read('components/AdminNavigation.tsx'),
  read('database/migrations/88-sold-asset-transfers.sql'),
]);

test('sold removal records Aim4price impact and makes transfer a deliberate choice', () => {
  assert.match(ownerClient, /Did Aim4price help with this sale\?/);
  assert.match(ownerClient, /Archive after sale/);
  assert.match(ownerClient, /Send to buyer/);
  assert.match(ownerClient, /aim4priceSaleInfluence/);
  assert.match(ownerClient, /transferAction/);
  assert.match(ownerRoute, /Tell us whether Aim4price helped with this sale/);
  assert.match(ownerRoute, /transferRequested/);
});

test('transfer codes are one-time credentials and are never stored as plaintext', () => {
  assert.match(transferSource, /randomBytes\(8\)/);
  assert.match(transferSource, /createHash\('sha256'\)/);
  assert.match(transferSource, /timingSafeEqual/);
  assert.match(transferSource, /status = 'claimed'/);
  assert.match(transferSource, /for update/i);
  assert.doesNotMatch(transferSource, /transfer_code\s+text/i);
  assert.doesNotMatch(migration, /transfer_code\s+text/i);
  assert.match(migration, /code_hash text not null/);
});

test('claiming is owner-scoped, rate limited and does not reveal account existence', () => {
  assert.match(transferRoute, /isAdminSupportSession/);
  assert.match(transferRoute, /profile\.accountType !== 'owner'/);
  assert.match(transferSource, /MAX_FAILED_CLAIM_ATTEMPTS/);
  assert.match(transferSource, /ASSET_TRANSFER_INVALID_CREDENTIALS/);
  assert.match(transferRoute, /identifier and transfer code could not be verified/);
  assert.doesNotMatch(transferRoute, /buyer.*email.*exists/i);
});

test('portable asset history moves while seller-private financial data is reset', () => {
  assert.match(transferSource, /asset_maintenance_records/);
  assert.match(transferSource, /asset_depreciation_snapshots/);
  assert.match(transferSource, /asset_lifecycle_events set owner_user_id/);
  assert.match(transferSource, /asset_register_uploads/);
  assert.match(transferSource, /asset_register_bucket_uploads/);
  assert.match(transferSource, /is_financed = false/);
  assert.match(transferSource, /is_insured = false/);
  assert.doesNotMatch(transferSource, /update public\.asset_invoices set user_id/);
  assert.match(transferPage, /private invoices, finance, insurance and account access do not transfer/i);
});

test('Account exposes claim and outgoing-transfer management', () => {
  assert.match(accountClient, /Claim or send an asset/);
  assert.match(accountClient, /\/account\/asset-transfers/);
  assert.match(transferPage, /Claim an asset/);
  assert.match(transferPage, /Replace code/);
  assert.match(transferPage, /Cancel & archive/);
  assert.match(transferPage, /autoComplete="one-time-code"/);
});

test('Admin has a dedicated sold-assets page with influence and transfer metrics', () => {
  assert.match(adminNavigation, /href: "\/admin\/sold-assets"/);
  assert.match(adminNavigation, /label: "Sold Assets"/);
  assert.match(adminPage, /<AdminNavigation active="sold-assets"/);
  assert.match(adminSales, /totalSold/);
  assert.match(adminSales, /helpedByAim4price/);
  assert.match(adminSales, /helpRatePercent/);
  assert.match(adminSales, /transferredAccounts/);
  assert.match(adminSales, /event\.reason = 'sold'/);
});

test('migration supports repeatable sold and transfer deployment', () => {
  assert.match(migration, /create table if not exists public\.asset_transfer_offers/);
  assert.match(migration, /add column if not exists aim4price_sale_influence/);
  assert.match(migration, /where status = 'pending'/);
  assert.match(migration, /asset_transfer_claim_attempts/);
});
