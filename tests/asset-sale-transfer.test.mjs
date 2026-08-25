import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  transferSource,
  transferRoute,
  ownerRoute,
  ownerClient,
  desktopRoute,
  desktopClient,
  accountantRoute,
  accountantClient,
  accountClient,
  transferPage,
  adminSales,
  adminPage,
  adminClient,
  adminActionRoute,
  adminNavigation,
  migration,
  pendingStateMigration,
  outcomeInfluenceMigration,
] = await Promise.all([
  read('lib/asset-transfers.ts'),
  read('app/api/asset-transfers/route.ts'),
  read('app/api/owner-app/assets/[assetId]/route.ts'),
  read('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx'),
  read('app/api/asset-register/route.ts'),
  read('app/asset-register/asset-register-client.tsx'),
  read('app/api/accountant/registers/[shareId]/assets/[assetId]/lifecycle/route.ts'),
  read('components/AccountantAssetManageModal.tsx'),
  read('app/account/account-client.tsx'),
  read('app/account/asset-transfers/asset-transfers-client.tsx'),
  read('lib/admin-asset-sales.ts'),
  read('app/admin/sold-assets/page.tsx'),
  read('app/admin/sold-assets/sold-assets-client.tsx'),
  read('app/api/admin/sold-assets/route.ts'),
  read('components/AdminNavigation.tsx'),
  read('database/migrations/88-sold-asset-transfers.sql'),
  read('database/migrations/89-asset-transfer-pending-state.sql'),
  read('database/migrations/90-disposal-outcome-influence.sql'),
]);

test('owner removal is a four-step flow with a deliberate sold transfer choice', () => {
  assert.match(ownerClient, /DISPOSAL_WIZARD_STEPS/);
  assert.match(ownerClient, /Did Aim4price help with this outcome in any way\?/);
  assert.match(ownerClient, /reason === 'sold'[\s\S]*reason === 'traded_in'[\s\S]*reason === 'scrapped'/);
  assert.match(ownerClient, /Archive after sale/);
  assert.match(ownerClient, /Send to buyer/);
  assert.match(ownerClient, /aim4priceOutcomeInfluence/);
  assert.match(ownerClient, /transferAction/);
  assert.match(ownerRoute, /Tell us whether Aim4price helped with this outcome/);
  assert.match(ownerRoute, /transferRequested/);
});

test('desktop Asset Register collects outcome, details, impact and information in sequence', () => {
  assert.match(desktopClient, /type DisposalWizardStep = 1 \| 2 \| 3 \| 4/);
  assert.match(desktopClient, /Did Aim4price help with this outcome in any way\?/);
  assert.match(desktopClient, /Trade-in allowance/);
  assert.match(desktopClient, /Archive after sale/);
  assert.match(desktopClient, /Send to buyer/);
  assert.match(desktopClient, /Save sale & create code/);
  assert.match(desktopClient, /assetTransferReceipt/);
  assert.match(desktopRoute, /Tell us whether Aim4price helped with this outcome/);
  assert.match(desktopRoute, /aim4priceOutcomeInfluence/);
  assert.match(desktopRoute, /transferRequested/);
  assert.match(desktopRoute, /transfer: outcome\.transfer/);
});

test('accountant disposal requires outcome impact for sold, traded and scrapped assets', () => {
  assert.match(accountantClient, /Did Aim4price help with this outcome in any way\?/);
  assert.match(accountantClient, /aim4priceOutcomeInfluence: impactQuestionRequired/);
  assert.match(accountantRoute, /Tell us whether Aim4price helped with this outcome/);
  assert.match(accountantRoute, /'sold', 'traded_in', 'scrapped'/);
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

test('claiming is Asset Register scoped, rate limited and does not reveal account existence', () => {
  assert.match(transferRoute, /isAdminSupportSession/);
  assert.match(transferRoute, /getAssetRegisterAccountAccess/);
  assert.match(transferRoute, /allowDealerApp: true/);
  assert.match(transferSource, /MAX_FAILED_CLAIM_ATTEMPTS/);
  assert.match(transferSource, /ASSET_TRANSFER_INVALID_CREDENTIALS/);
  assert.match(transferRoute, /identifier and transfer code could not be verified/);
  assert.doesNotMatch(transferRoute, /buyer.*email.*exists/i);
});

test('portable asset history moves while seller-private financial data is reset', () => {
  assert.match(transferSource, /asset_maintenance_records/);
  assert.match(transferSource, /asset_depreciation_snapshots/);
  assert.match(transferSource, /update public\.asset_lifecycle_events[\s\S]*set owner_user_id/);
  assert.match(transferSource, /asset_register_uploads/);
  assert.match(transferSource, /asset_register_bucket_uploads/);
  assert.match(transferSource, /is_financed = false/);
  assert.match(transferSource, /is_insured = false/);
  assert.match(transferSource, /portableDocuments/);
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
  assert.match(adminClient, />Allocate</);
  assert.match(adminClient, />Delete</);
  assert.match(adminActionRoute, /requireAdminApiAccess/);
  assert.match(adminActionRoute, /adminAllocateDisposedAsset/);
  assert.match(adminActionRoute, /adminDeleteSoldAsset/);
});

test('migration supports repeatable sold and transfer deployment', () => {
  assert.match(migration, /create table if not exists public\.asset_transfer_offers/);
  assert.match(migration, /add column if not exists aim4price_sale_influence/);
  assert.match(migration, /where status = 'pending'/);
  assert.match(migration, /asset_transfer_claim_attempts/);
  assert.match(migration, /'transfer_pending'/);
  assert.match(pendingStateMigration, /drop constraint if exists asset_register_items_lifecycle_state_check/);
  assert.match(pendingStateMigration, /'active', 'disposed', 'archived', 'transfer_pending'/);
  assert.match(transferSource, /position\('transfer_pending' in lifecycle_constraint_definition\)/);
  assert.match(outcomeInfluenceMigration, /add column if not exists aim4price_outcome_influence/);
  assert.match(outcomeInfluenceMigration, /add column if not exists original_owner_user_id/);
});
