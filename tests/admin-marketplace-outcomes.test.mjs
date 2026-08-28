import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const page = read('app/admin/sold-assets/page.tsx');
const client = read('app/admin/sold-assets/admin-marketplace-outcomes-client.tsx');
const styles = read('app/admin/sold-assets/page.module.css');
const navigation = read('components/AdminNavigation.tsx');

test('Admin Asset Outcomes is protected and uses the reserved Admin navigation destination', () => {
  assert.match(page, /await requireAdminPageAccess\(\)/);
  assert.match(page, /getAdminMarketplaceOutcomeReport\(\)/);
  assert.match(page, /<AdminNavigation active="sold-assets" \/>/);
  assert.match(navigation, /href: "\/admin\/sold-assets"[\s\S]*?label: "Asset Outcomes"/);
});

test('Admin Asset Outcomes exposes clear first-party help and value metrics', () => {
  assert.match(client, /Total outcomes/);
  assert.match(client, /Sold or traded/);
  assert.match(client, /Aim4price helped/);
  assert.match(client, /Aim4price did not help/);
  assert.match(client, /Help rate/);
  assert.match(client, /Recorded final value/);
  assert.match(client, /Both Yes and No answers are retained/);
  assert.match(client, /safeMoney\(outcome\.finalSalePriceExVat\)/);
});

test('Admin can filter every outcome without hiding No answers', () => {
  assert.match(client, /type HelpFilter = 'all' \| 'yes' \| 'no'/);
  assert.match(client, /All outcomes/);
  assert.match(client, /Yes and No/);
  assert.match(client, /Marketplace and Showroom/);
  assert.match(client, /Last 30 days/);
  assert.match(client, /Highest final value/);
  assert.match(client, /Asset, seller, sector or reference/);
  assert.match(client, /PAGE_SIZE = 25/);
});

test('Admin outcome rows retain sale evidence and closing context', () => {
  assert.match(client, /Final price excl\. VAT/);
  assert.match(client, /Aim4price value/);
  assert.match(client, /Seller response/);
  assert.match(client, /From My Showroom/);
  assert.match(client, /From Marketplace/);
  assert.match(client, /different viewers/);
  assert.match(client, /days advertised/);
});

test('Admin Asset Outcomes keeps the white responsive Aim4price layout', () => {
  assert.match(styles, /font-family: Montserrat/);
  assert.match(styles, /background: #ffffff/);
  assert.match(styles, /\.tableScroller/);
  assert.match(styles, /@media \(max-width: 980px\)/);
  assert.match(styles, /@media \(max-width: 540px\)/);
});

