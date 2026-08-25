import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  filterAndSortAdminMarketplaceAssets,
  summarizeAdminMarketplaceAssets,
} from '../lib/admin-marketplace-shared.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const adminMarketplace = read('lib/admin-marketplace.ts');
const adminMarketplacePage = read('app/admin/marketplace/page.tsx');
const adminMarketplaceClient = read('app/admin/marketplace/admin-marketplace-client.tsx');
const adminMarketplaceStyles = read('app/admin/marketplace/page.module.css');
const adminDashboard = read('lib/admin-dashboard.ts');
const dashboardPage = read('app/admin/dashboard/page.tsx');
const adminNavigation = read('components/AdminNavigation.tsx');

const baseAsset = {
  assetKey: 'asset:one',
  sourceAssetId: 'one',
  latestListingId: 'listing-one',
  accountUserId: 'seller-one',
  title: 'Kubota M8540',
  description: 'Low-hour tractor',
  status: 'live',
  askingPriceExVat: 1_000_000,
  sellerLabel: 'Example Tractors',
  sellerName: 'Example Seller',
  sellerCompany: 'Example Tractors',
  sellerEmail: 'seller@example.com',
  province: 'Free State',
  area: 'Bothaville',
  sectorKey: 'agricultural',
  sectorLabel: 'Agriculture',
  familyLabel: 'Tractors',
  brandName: 'Kubota',
  modelName: 'M8540',
  firstAdvertisedAtIso: '2026-01-10T08:00:00.000Z',
  lastAdvertisedAtIso: '2026-08-20T08:00:00.000Z',
  listingEvents: 2,
};

const sampleAssets = [
  baseAsset,
  {
    ...baseAsset,
    assetKey: 'asset:two',
    sourceAssetId: 'two',
    latestListingId: 'listing-two',
    accountUserId: 'seller-two',
    title: 'CAT 320 Excavator',
    status: 'withdrawn',
    askingPriceExVat: 250_000,
    sellerLabel: 'Earthmoving Co',
    sectorKey: 'construction',
    sectorLabel: 'Construction',
    brandName: 'CAT',
    modelName: '320',
    firstAdvertisedAtIso: '2025-04-01T08:00:00.000Z',
    lastAdvertisedAtIso: '2025-04-01T08:00:00.000Z',
    listingEvents: 1,
  },
  {
    ...baseAsset,
    assetKey: 'asset:three',
    sourceAssetId: 'three',
    latestListingId: 'listing-three',
    accountUserId: 'seller-one',
    title: 'Toyota Forklift',
    askingPriceExVat: 500_000,
    sectorKey: 'industrial',
    sectorLabel: 'Industrial',
    brandName: 'Toyota',
    modelName: '8FG',
    firstAdvertisedAtIso: '2026-05-01T08:00:00.000Z',
    lastAdvertisedAtIso: '2026-05-01T08:00:00.000Z',
    listingEvents: 1,
  },
];

test('marketplace totals count each unique asset once and retain listing-event history', () => {
  const summary = summarizeAdminMarketplaceAssets(sampleAssets);
  assert.equal(summary.totalUniqueAssets, 3);
  assert.equal(summary.totalListingEvents, 4);
  assert.equal(summary.relistedAssets, 1);
  assert.equal(summary.allTimeAdvertisedValueExVat, 1_750_000);
  assert.equal(summary.liveAdvertisedValueExVat, 1_500_000);
  assert.equal(summary.liveAssets, 2);
  assert.equal(summary.withdrawnAssets, 1);
  assert.equal(summary.accountsAdvertising, 2);
});

test('marketplace search, status, sector and advertised-date filters work together', () => {
  const defaults = {
    search: '',
    status: 'all',
    sector: 'all',
    advertised: 'all',
    sort: 'latest',
  };
  const now = new Date('2026-08-25T12:00:00.000Z');

  assert.deepEqual(
    filterAndSortAdminMarketplaceAssets(sampleAssets, { ...defaults, search: 'kubota' }, now)
      .map((asset) => asset.assetKey),
    ['asset:one'],
  );
  assert.deepEqual(
    filterAndSortAdminMarketplaceAssets(sampleAssets, { ...defaults, status: 'withdrawn' }, now)
      .map((asset) => asset.assetKey),
    ['asset:two'],
  );
  assert.deepEqual(
    filterAndSortAdminMarketplaceAssets(sampleAssets, { ...defaults, sector: 'industrial' }, now)
      .map((asset) => asset.assetKey),
    ['asset:three'],
  );
  assert.deepEqual(
    filterAndSortAdminMarketplaceAssets(sampleAssets, { ...defaults, advertised: 'last-30-days' }, now)
      .map((asset) => asset.assetKey),
    ['asset:one'],
  );
  assert.deepEqual(
    filterAndSortAdminMarketplaceAssets(sampleAssets, { ...defaults, advertised: 'year:2025' }, now)
      .map((asset) => asset.assetKey),
    ['asset:two'],
  );
});

test('the database report de-duplicates re-listings without dropping historical assets', () => {
  assert.match(adminMarketplace, /from public\.marketplace_listings listing/);
  assert.match(adminMarketplace, /partition by history\.asset_key/);
  assert.match(adminMarketplace, /where history\.latest_rank = 1/);
  assert.match(adminMarketplace, /coalesce\(sum\(asking_price_ex_vat\), 0\)/);
  assert.match(adminMarketplace, /coalesce\(asset\.marketplace_status, 'draft'\) = 'live'/);
  assert.match(adminMarketplace, /not exists \([\s\S]*?saved_listing\.asset_register_item_id = asset\.id/);
  assert.doesNotMatch(adminMarketplace, /limit\s+\d+/i);
});

test('the Admin Marketplace page is admin-only and exposes the complete filterable history', () => {
  assert.match(adminMarketplacePage, /await requireAdminPageAccess\(\)/);
  assert.match(adminMarketplacePage, /getAdminMarketplaceReport\(\)/);
  assert.match(adminMarketplacePage, /<AdminNavigation active="marketplace" \/>/);
  assert.match(adminMarketplaceClient, /All-time advertised value/);
  assert.match(adminMarketplaceClient, /Every asset ever advertised/);
  assert.match(adminMarketplaceClient, /Asset, seller, location or reference/);
  assert.match(adminMarketplaceClient, /All statuses/);
  assert.match(adminMarketplaceClient, /All sectors/);
  assert.match(adminMarketplaceClient, /Last advertised/);
  assert.match(adminMarketplaceClient, /Highest value/);
  assert.match(adminMarketplaceClient, /Clear filters/);
  assert.match(adminMarketplaceClient, /PAGE_SIZE = 25/);
  assert.match(adminMarketplaceStyles, /\.tableScroller/);
  assert.match(adminMarketplaceStyles, /@media \(max-width: 540px\)/);
});

test('Marketplace is visible in Admin navigation and on the main Dashboard', () => {
  assert.match(adminNavigation, /href: "\/admin\/marketplace", label: "Marketplace"/);
  assert.match(adminDashboard, /id: 'marketplace-advertised'/);
  assert.match(adminDashboard, /getAdminMarketplaceSummary\(\)/);
  assert.match(adminDashboard, /View every marketplace asset/);
  assert.match(dashboardPage, /"marketplace-advertised"/);
  assert.match(dashboardPage, /card\.href/);
});
