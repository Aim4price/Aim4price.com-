import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  filterAndSortAdminMarketplaceAssets,
  summarizeAdminMarketplaceAssets,
} from '../lib/admin-marketplace-shared.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const migration = read('database/migrations/93-marketplace-view-discovery-tracking.sql');
const viewStore = read('lib/marketplace-views.ts');
const publicViewApi = read('app/api/marketplace/views/route.ts');
const marketplaceClient = read('app/marketplace/marketplace-client.tsx');
const adminMarketplace = read('lib/admin-marketplace.ts');
const adminDashboard = read('lib/admin-dashboard.ts');
const adminApi = read('app/api/admin/marketplace/route.ts');
const adminClient = read('app/admin/marketplace/admin-marketplace-client.tsx');
const adminNavigation = read('components/AdminNavigation.tsx');
const adminLoading = read('app/admin/loading.tsx');
const adminFoundation = read('app/admin/admin-foundation.css');

const asset = (overrides = {}) => ({
  assetKey: 'asset:one',
  sourceAssetId: '8b461ad1-c346-4c0e-a221-e74901b3a96f',
  latestListingId: '20e62895-e940-4c65-b102-a4381631630d',
  accountUserId: 'seller-one',
  title: '2021 John Deere 6135B',
  description: 'Field tractor',
  status: 'live',
  askingPriceExVat: 780_000,
  sellerLabel: 'Example Machinery',
  sellerName: 'Seller',
  sellerCompany: 'Example Machinery',
  sellerEmail: 'seller@example.com',
  province: 'Western Cape',
  area: 'George',
  sectorKey: 'agricultural',
  sectorLabel: 'Agriculture',
  familyLabel: 'Tractors',
  brandName: 'John Deere',
  modelName: '6135B',
  firstAdvertisedAtIso: '2026-07-01T08:00:00.000Z',
  lastAdvertisedAtIso: '2026-08-20T08:00:00.000Z',
  listingEvents: 1,
  totalViews: 8,
  accountViews: 5,
  unknownViews: 3,
  uniqueViewers: 3,
  lastViewedAtIso: '2026-08-25T10:00:00.000Z',
  repeatViewerViews: 4,
  repeatViewerLabel: 'Buyer Account',
  repeatViewerAccountType: 'owner',
  repeatViewerLastViewedAtIso: '2026-08-25T10:00:00.000Z',
  hasRepeatInterest: true,
  ...overrides,
});

test('view events use first-party anonymous IDs and reject false listing attribution', () => {
  assert.match(migration, /create table if not exists public\.marketplace_listing_views/);
  assert.match(migration, /num_nonnulls\(viewer_user_id, anonymous_viewer_hash\) = 1/);
  assert.match(migration, /idx_marketplace_listing_views_account_repeat/);
  assert.match(migration, /unique index if not exists idx_marketplace_listing_views_account_window/);
  assert.doesNotMatch(migration, /\bip_address\s+(?:text|inet)/i);
  assert.doesNotMatch(migration, /\buser_agent\s+text/i);

  assert.match(viewStore, /createHash\('sha256'\)/);
  assert.match(viewStore, /\$3::text = 'asset-' \|\| asset\.id::text/);
  assert.match(viewStore, /\$4::text <> asset\.user_id/);
  assert.match(viewStore, /DUPLICATE_WINDOW_SECONDS = 45/);
  assert.match(viewStore, /on conflict do nothing/);
  assert.match(viewStore, /isDatabaseSchemaReady/);

  assert.match(marketplaceClient, /aim4price\.marketplace\.viewer\.v1/);
  assert.match(marketplaceClient, /trackListingOpen\(listing\)/);
  assert.match(marketplaceClient, /keepalive: true/);
  assert.match(marketplaceClient, /fetch\('\/api\/marketplace\/views'/);
  assert.match(publicViewApi, /getOptionalMarketplaceViewer/);
  assert.match(publicViewApi, /allowAdmin: true/);
  assert.match(publicViewApi, /isAim4priceAdminEmail\(session\.user\.email\)/);
  assert.match(publicViewApi, /isAdminSupportSession\(session\)/);
  assert.match(publicViewApi, /viewerUserId: session\?\.user\?\.id \?\? null/);
  assert.doesNotMatch(publicViewApi, /export async function GET/);
});

test('view identities and timelines are available only through the Admin API', () => {
  assert.match(adminApi, /export async function GET\(request: NextRequest\)/);
  assert.match(adminApi, /await requireAdminApiAccess\(\)/);
  assert.match(adminApi, /getAdminMarketplaceViewDetails/);
  assert.match(adminApi, /Cache-Control': 'private, no-store'/);
  assert.match(viewStore, /Unknown viewer \$\{alias\}/);
  assert.match(viewStore, /hasRepeatInterest: viewCount >= 3/);
  assert.match(adminClient, /Who viewed this asset\?/);
  assert.match(adminClient, /Unknown viewer viewed this asset/);
  assert.match(adminClient, /privacy-safe browser ID/);
  assert.match(adminClient, /fetch\(`\/api\/admin\/marketplace\?\$\{params\.toString\(\)\}`/);
});

test('popular and repeat-interest discovery filters use recorded view totals', () => {
  const popular = asset({ assetKey: 'asset:popular', totalViews: 14, repeatViewerViews: 2, hasRepeatInterest: false });
  const repeated = asset({ assetKey: 'asset:repeat', totalViews: 8, repeatViewerViews: 4, hasRepeatInterest: true });
  const unseen = asset({
    assetKey: 'asset:unseen',
    totalViews: 0,
    accountViews: 0,
    unknownViews: 0,
    uniqueViewers: 0,
    lastViewedAtIso: null,
    repeatViewerViews: 0,
    repeatViewerLabel: '',
    repeatViewerAccountType: '',
    repeatViewerLastViewedAtIso: null,
    hasRepeatInterest: false,
  });
  const assets = [repeated, unseen, popular];
  const defaults = { search: '', status: 'all', sector: 'all', advertised: 'all' };

  assert.deepEqual(
    filterAndSortAdminMarketplaceAssets(assets, { ...defaults, interest: 'viewed', sort: 'popular' })
      .map((item) => item.assetKey),
    ['asset:popular', 'asset:repeat'],
  );
  assert.deepEqual(
    filterAndSortAdminMarketplaceAssets(assets, { ...defaults, interest: 'repeat', sort: 'repeat-interest' })
      .map((item) => item.assetKey),
    ['asset:repeat'],
  );
  assert.deepEqual(
    filterAndSortAdminMarketplaceAssets(assets, { ...defaults, interest: 'unviewed', sort: 'latest' })
      .map((item) => item.assetKey),
    ['asset:unseen'],
  );

  const summary = summarizeAdminMarketplaceAssets(assets);
  assert.equal(summary.totalViews, 22);
  assert.equal(summary.viewedAssets, 2);
  assert.equal(summary.repeatInterestAssets, 1);
});

test('all Admin routes get immediate feedback and expensive pages prefetch only on intent', () => {
  assert.match(adminLoading, /aria-busy="true"/);
  assert.match(adminLoading, /aria-label="Loading Admin"/);
  assert.doesNotMatch(adminLoading, /Loading Admin data/);
  assert.match(adminNavigation, /prefetch=\{false\}/);
  assert.match(adminNavigation, /onMouseEnter=\{\(\) => router\.prefetch\(item\.href\)\}/);
  assert.match(adminFoundation, /text-transform: none !important/);
  assert.match(adminFoundation, /prefers-reduced-motion: reduce/);
  assert.match(adminDashboard, /publicSchemaPromise: Promise<Map<string, Set<string>>> \| null/);
  assert.match(adminDashboard, /function loadPublicSchema/);
  assert.match(adminDashboard, /from information_schema\.columns/);
});

test('the Admin report aggregates view counts once and deletes them with listing history', () => {
  assert.match(adminMarketplace, /marketplace_viewer_counts as/);
  assert.match(adminMarketplace, /sum\(viewer\.view_count\)::bigint as total_views/);
  assert.match(adminMarketplace, /repeat_interest_assets/);
  assert.match(adminMarketplace, /delete from public\.marketplace_listing_views/);
});
