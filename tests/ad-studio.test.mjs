import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Ad Studio exposes five reusable layout choices and safe Brand Kit fields', async () => {
  const source = await read('lib/ad-studio.ts');
  for (const template of ['showcase', 'price-focus', 'photo-first', 'classic', 'minimal']) {
    assert.match(source, new RegExp(`id: '${template}'`));
  }
  assert.match(source, /logoUrl: string/);
  assert.match(source, /primaryColor: string/);
  assert.match(source, /contactName: string/);
  assert.match(source, /vatLabel: AdVatLabel/);
  assert.match(source, /normalizeAdBrandSnapshot/);
});

test('Brand Kits are owned per account and only dealer owners may edit company kits', async () => {
  const [route, database, capability] = await Promise.all([
    read('app/api/ad-studio/brand-kits/route.ts'),
    read('lib/ad-studio-db.ts'),
    read('lib/dealer-app-access.ts'),
  ]);

  assert.match(route, /profile\.accountType !== 'owner'.*profile\.accountType !== 'dealer'/s);
  assert.match(route, /canManage: !dealerSession \|\| dealerSession\.role === 'owner'/);
  assert.match(route, /Only the Dealer Owner can change company Brand Kits/);
  assert.match(database, /where user_id = \$1/);
  assert.match(database, /pg_advisory_xact_lock/);
  assert.match(capability, /'ad_studio'/);
});

test('schema preserves the selected branding as a Marketplace advert snapshot', async () => {
  const [migration, marketplaceDatabase] = await Promise.all([
    read('database/migrations/73-ad-studio-brand-kits.sql'),
    read('lib/marketplace-db.ts'),
  ]);

  assert.match(migration, /create table if not exists ad_brand_kits/);
  assert.match(migration, /unique index if not exists idx_ad_brand_kits_one_default/);
  assert.match(migration, /marketplace_ad_brand jsonb/);
  assert.match(marketplaceDatabase, /toAdBrandSnapshot\(brandKit\)/);
  assert.match(marketplaceDatabase, /marketplace_ad_brand = \$\$\{updateValues\.length\}::jsonb/);
  assert.match(marketplaceDatabase, /normalizeAdBrandSnapshot\(pick\(row, \['marketplace_ad_brand'\]\)/);
});

test('valuation Create Ad flow selects a Brand Kit and publishes without a second Marketplace action', async () => {
  const valuation = await read('app/valuation/valuation-client.tsx');

  assert.match(valuation, /'Create Ad'/);
  assert.match(valuation, /name="brandKitId"/);
  assert.match(valuation, /brandKitId: marketplaceDraft\.brandKitId \|\| null/);
  assert.match(valuation, /Create ad and publish/);
  assert.match(valuation, /&createAd=1/);
  assert.doesNotMatch(valuation, /saveAndSendToMarketplace/);
});

test('Marketplace opens the advert sheet and renders the saved layout and dealer branding', async () => {
  const marketplace = await read('app/marketplace/marketplace-client.tsx');

  assert.match(marketplace, /searchParams\.get\('createAd'\) === '1'/);
  assert.match(marketplace, /setShareListing\(nextListing\)/);
  assert.match(marketplace, /listing\.adBrand\?\.logoUrl/);
  assert.match(marketplace, /listing\.adBrand\?\.templateId/);
  assert.match(marketplace, /drawAlternateBrandedAdCanvas/);
  assert.match(marketplace, /drawAim4priceCredit/);
});

test('owner and Dealer App Ad Studio pages share one implementation', async () => {
  const [ownerPage, dealerPage, client] = await Promise.all([
    read('app/ad-studio/page.tsx'),
    read('app/dealer/ad-studio/page.tsx'),
    read('components/AdStudioClient.tsx'),
  ]);

  assert.match(ownerPage, /<AdStudioClient/);
  assert.match(dealerPage, /<AdStudioClient dealerAppMode/);
  assert.match(client, /Save Brand Kit/);
  assert.match(client, /Build your advert style once/);
});
