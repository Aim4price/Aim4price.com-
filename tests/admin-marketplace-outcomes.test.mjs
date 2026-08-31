import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const page = read('app/admin/sold-assets/page.tsx');
const client = read('app/admin/sold-assets/admin-marketplace-outcomes-client.tsx');
const assetClient = read('app/admin/sold-assets/sold-assets-client.tsx');
const styles = read('app/admin/sold-assets/page.module.css');
const navigation = read('components/AdminNavigation.tsx');

test('Admin Outcomes is protected and exposes both ledgers without loading both', () => {
  assert.match(page, /await requireAdminPageAccess\(\)/);
  assert.match(page, /getAdminMarketplaceOutcomeReport\(\)/);
  assert.match(page, /getAdminAssetOutcomesReport\(\)/);
  assert.match(page, /listAdminAssetAllocationAccounts\(\)/);
  assert.match(page, /source === 'assets'/);
  assert.match(page, /<SoldAssetsClient/);
  assert.match(page, /<AdminMarketplaceOutcomesClient/);
  assert.match(page, /href="\/admin\/sold-assets\?source=assets"/);
  assert.match(page, /aria-current=\{source === 'marketplace'/);
  assert.match(page, /aria-current=\{source === 'assets'/);
  assert.match(page, /<AdminNavigation active="sold-assets" \/>/);
  assert.match(navigation, /href: "\/admin\/sold-assets"[\s\S]*?label: "Outcomes"/);
});

test('Admin Asset Outcomes exposes concise value metrics', () => {
  assert.match(client, /<span>Outcomes<\/span>/);
  assert.match(client, /Sold or traded/);
  assert.match(client, /<span>Helped<\/span>/);
  assert.match(client, /Not helped/);
  assert.match(client, /Help rate/);
  assert.match(client, /Final value/);
  assert.match(client, /summarizeAdminMarketplaceOutcomes\(filteredOutcomes\)/);
  assert.match(client, /safeMoney\(outcome\.finalSalePriceExVat\)/);
});

test('Admin can filter every outcome without hiding No answers', () => {
  assert.match(client, /type HelpFilter = 'all' \| 'yes' \| 'no'/);
  assert.match(client, /All outcomes/);
  assert.match(client, /Yes and No/);
  assert.match(client, /Marketplace and Showroom/);
  assert.match(client, /Last 30 days/);
  assert.match(client, /Highest final value/);
  assert.match(client, /Asset, seller or reference/);
  assert.match(client, /PAGE_SIZE = 25/);
  assert.match(client, /yearInJohannesburg/);
  assert.match(client, /compareRecordedFinalValue/);
  assert.match(client, /if \(leftValue === null\) return rightValue === null \? 0 : 1/);
});

test('Admin outcome rows retain essential sale evidence and closing context', () => {
  assert.match(client, /Price evidence/);
  assert.match(client, /Aim4price/);
  assert.match(client, /Showroom/);
  assert.match(client, /Marketplace/);
  assert.match(client, /totalViewsAtClose/);
  assert.match(client, /formatDays\(daysToOutcome\(outcome\)\)/);
  assert.match(client, /detailOutcome\.outcomeNote/);
  assert.match(client, /detailOutcome\.outcomeId/);
  assert.match(client, /detailOutcome\.accountViewsAtClose/);
  assert.match(client, /role="dialog"/);
  assert.match(client, /event\.key === 'Escape'/);
  assert.doesNotMatch(styles, /\.yesAnswer[\s\S]*?border:\s*1px solid currentColor/);
});

test('Asset register outcomes retain correction actions with compact pagination', () => {
  assert.match(assetClient, /PAGE_SIZE = 25/);
  assert.match(assetClient, /All outcomes/);
  assert.match(assetClient, /All answers/);
  assert.match(assetClient, /All statuses/);
  assert.match(assetClient, /compareRecordedAmount/);
  assert.match(assetClient, /if \(leftAmount === null\) return rightAmount === null \? 0 : 1/);
  assert.match(assetClient, /openAction\('allocate'/);
  assert.match(assetClient, /openAction\('delete'/);
  assert.match(assetClient, />\s*Allocate or restore\s*</);
  assert.match(assetClient, /selectedBuyerUserId === actionDialog\.record\.sourceUserId/);
  assert.match(assetClient, /\? 'Restore'/);
  assert.match(assetClient, /: 'Allocate'/);
  assert.match(assetClient, /\? 'Delete'/);
  assert.match(assetClient, /fetch\('\/api\/admin\/sold-assets'/);
  assert.match(assetClient, /role="dialog"/);
  assert.match(assetClient, /event\.key === 'Escape'/);
});

test('Outcome styles cover both ledgers without pills or wrapped record text', () => {
  assert.match(styles, /\.sourceSwitch\s*\{/);
  assert.match(styles, /\.assetButton\s*\{/);
  assert.match(styles, /\.rowActions\s*\{/);
  assert.match(styles, /\.detailOverlay\s*\{/);
  assert.match(styles, /\.detailModal\s*\{/);
  assert.match(styles, /\.detailGrid\s*\{/);
  assert.match(styles, /\.accountList\s*\{/);
  assert.match(styles, /\.confirmAllocate\s*\{/);
  assert.match(styles, /\.confirmDelete\s*\{/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.detailGrid\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.detailGrid \.detailWide\s*\{[\s\S]*?grid-column:\s*auto/);
  assert.doesNotMatch(styles, /border-radius:\s*999px/);
  assert.doesNotMatch(styles, /white-space:\s*normal/);
});

test('Admin Asset Outcomes keeps the white responsive Aim4price layout', () => {
  assert.match(styles, /font-family: Montserrat/);
  assert.match(styles, /background: #ffffff/);
  assert.match(styles, /\.tableScroller/);
  assert.match(styles, /@media \(max-width: 980px\)/);
  assert.match(styles, /@media \(max-width: 540px\)/);
});
