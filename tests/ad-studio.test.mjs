import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Ad Studio exposes eight reusable one-to-four-photo layouts and safe Brand Kit fields', async () => {
  const source = await read('lib/ad-studio.ts');
  for (const template of [
    'showcase',
    'price-focus',
    'photo-first',
    'classic',
    'minimal',
    'duo-split',
    'gallery-three',
    'catalogue-grid',
  ]) {
    assert.match(source, new RegExp(`id: '${template}'`));
  }
  assert.match(source, /photoCount: 1/);
  assert.match(source, /photoCount: 2/);
  assert.match(source, /photoCount: 3/);
  assert.match(source, /photoCount: 4/);
  assert.match(source, /logoUrl: string/);
  assert.match(source, /primaryColor: string/);
  assert.match(source, /contactName: string/);
  assert.match(source, /vatLabel: AdVatLabel/);
  assert.match(source, /normalizeAdBrandSnapshot/);
});

test('Brand Kits are dealer-only and only dealer owners may edit company kits', async () => {
  const [route, database, capability] = await Promise.all([
    read('app/api/ad-studio/brand-kits/route.ts'),
    read('lib/ad-studio-db.ts'),
    read('lib/dealer-app-access.ts'),
  ]);

  assert.match(route, /profile\.accountType !== 'dealer'/);
  assert.doesNotMatch(route, /profile\.accountType !== 'owner'/);
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
  assert.match(marketplaceDatabase, /input\.allowBrandKit/);
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
  assert.match(valuation, /Owner listings use the standard Aim4price Marketplace advert design/);
  assert.match(valuation, /resolvedAccountType === 'dealer'/);
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
  assert.match(marketplace, /templateId === 'duo-split'/);
  assert.match(marketplace, /templateId === 'gallery-three'/);
  assert.match(marketplace, /templateId === 'catalogue-grid'/);
  assert.match(marketplace, /listingImages\[index\]/);
});

test('Ad Studio is limited to dealer accounts and uses a four-step guided setup', async () => {
  const [desktopPage, dealerPage, client, header] = await Promise.all([
    read('app/ad-studio/page.tsx'),
    read('app/dealer/ad-studio/page.tsx'),
    read('components/AdStudioClient.tsx'),
    read('components/AppHeader.tsx'),
  ]);

  assert.match(desktopPage, /profile\.accountType !== 'dealer'/);
  assert.match(desktopPage, /<AdStudioClient/);
  assert.match(dealerPage, /<AdStudioClient dealerAppMode/);
  assert.match(client, /Save Brand Kit/);
  assert.match(client, /type StudioStep = 1 \| 2 \| 3 \| 4/);
  assert.match(client, /Details.*Layout.*Style.*Review/s);
  assert.match(client, /activeStep === 1/);
  assert.match(client, /activeStep === 4/);
  assert.match(client, /My Brand Kits/);
  assert.match(client, /setDefaultKit/);
  assert.match(client, /deleteKit\(kit\)/);
  assert.match(client, /selectedTemplate\.photoCount/);
  assert.match(header, /href: '\/ad-studio', label: 'Ad Studio', accountTypes: \['dealer'\]/);
  assert.doesNotMatch(header, /href: '\/ad-studio', label: 'Ad Studio', accountTypes: \['owner'/);
});

test('Marketplace only applies Brand Kits to dealer listings', async () => {
  const route = await read('app/api/marketplace/route.ts');

  assert.match(route, /brandKitId: accountType === 'dealer'/);
  assert.match(route, /allowBrandKit: accountType === 'dealer'/);
});
