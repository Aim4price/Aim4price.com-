import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Dealer Maintenance is paginated in both Dealer App and desktop', () => {
  const pagination = read('components/DealerMaintenancePagination.tsx');
  const paginationStyles = read('components/DealerMaintenancePagination.module.css');
  const appClient = read('app/dealer/maintenance/dealer-maintenance-client.tsx');
  const desktopClient = read('app/tracking/tracking-client.tsx');

  assert.match(pagination, /const DEFAULT_PAGE_SIZE = 10/);
  assert.match(pagination, /const PAGINATION_WINDOW = 5/);
  assert.match(pagination, /aria-label="Maintenance pagination"/);
  assert.match(pagination, /Showing <strong>\{rangeStart\}<\/strong>-<strong>\{rangeEnd\}<\/strong>/);
  assert.match(pagination, /showPage\(cards, nextPage, safePageSize\)/);
  assert.match(pagination, /assetStyles\.shell/);
  assert.match(pagination, /workspaceStyles\.shell/);
  assert.match(pagination, /assetStyles\.registerPanel/);
  assert.match(pagination, /paginationStyles\.paginationPanel/);
  assert.match(paginationStyles, /\.paginationPanel \{[\s\S]*?padding-top: 0 !important;[\s\S]*?padding-bottom: 0 !important;/);
  assert.match(paginationStyles, /\.pagination \{[\s\S]*?width: 100%;/);
  assert.match(appClient, /<DealerMaintenancePagination initialOpenAccessId=\{initialOpenAccessId\}>/);
  assert.match(desktopClient, /<DealerMaintenancePagination initialOpenAccessId=\{initialOpenAccessId\}>/);
});

test('Dealer App Maintenance loads independent profile and fast first-page data together', () => {
  const page = read('app/dealer/maintenance/page.tsx');

  assert.match(page, /const \[profile, initialLoad\] = await Promise\.all\(\[/);
  assert.match(page, /getAccountProfile\(/);
  assert.match(page, /listInitialDealerTrackedAssets\(\{/);
  assert.match(page, /initialAssetsHaveMore=\{initialLoad\.hasMore\}/);
});
