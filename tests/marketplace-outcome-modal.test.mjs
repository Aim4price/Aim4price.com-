import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('shared Marketplace outcome dialog records a complete removal outcome', async () => {
  const source = await read('components/MarketplaceOutcomeModal.tsx');

  for (const reason of [
    'sold',
    'traded',
    'no_longer_available',
    'decided_not_to_sell',
    'created_by_mistake',
    'other',
  ]) {
    assert.match(source, new RegExp(`'${reason}'`));
  }

  assert.match(source, /Did Aim4price help with this outcome\?/);
  assert.match(source, /aim4priceHelped === null/);
  assert.match(source, /reason === 'other' && notes\.trim\(\)\.length < 3/);
  assert.match(source, /reason === 'sold' \|\| reason === 'traded'/);
  assert.match(source, /fetch\('\/api\/marketplace\/outcomes'/);
  assert.match(source, /method: 'POST'/);
  assert.match(source, /outcomeReason: reason/);
  assert.match(source, /aim4priceHelped,/);
  assert.match(source, /finalSalePriceExVat:/);
  assert.match(source, /outcomeNote:/);
  assert.match(source, /sourceSurface: source/);
});

test('shared Marketplace outcome dialog is keyboard and screen-reader accessible', async () => {
  const [source, styles] = await Promise.all([
    read('components/MarketplaceOutcomeModal.tsx'),
    read('components/MarketplaceOutcomeModal.module.css'),
  ]);

  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby=\{titleId\}/);
  assert.match(source, /aria-describedby=\{descriptionId\}/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /previouslyFocused\?\.focus\(\)/);
  assert.match(source, /role="alert"/);
  assert.match(source, /aria-required="true"/);
  assert.match(styles, /font-family: 'Montserrat'/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /text-transform:\s*uppercase/);
});

test('Marketplace and My Showroom use one managed outcome flow', async () => {
  const [marketplace, showroom, legacyRoute] = await Promise.all([
    read('app/marketplace/marketplace-client.tsx'),
    read('components/MiddlemanShowroomClient.tsx'),
    read('app/api/marketplace/route.ts'),
  ]);

  assert.match(marketplace, /<MarketplaceOutcomeModal/);
  assert.match(marketplace, /source="marketplace"/);
  assert.match(marketplace, /Manage advert/);
  assert.match(marketplace, /Download JPEG/);
  assert.match(marketplace, /Remove advert/);
  assert.doesNotMatch(marketplace, /method: 'DELETE'/);

  assert.match(showroom, /<MarketplaceOutcomeModal/);
  assert.match(showroom, /source="showroom"/);
  assert.match(showroom, /Manage advert/);
  assert.match(showroom, /Open in Marketplace/);
  assert.match(showroom, /design: usesSavedBrandDesign && listing\.adBrand \? 'saved-brand' : 'aim4price-marketplace'/);
  assert.doesNotMatch(showroom, /window\.confirm/);
  assert.doesNotMatch(showroom, /fetch\(`\/api\/marketplace\?assetId=[\s\S]*?method: 'DELETE'/);

  assert.match(legacyRoute, /status: 405/);
  assert.match(legacyRoute, /guided Remove advert flow/);
});

test('Owner App sends listing removal through the guided Marketplace manager', async () => {
  const [ownerAssetActions, ownerAssetDetail] = await Promise.all([
    read('app/api/owner-app/assets/[assetId]/actions/route.ts'),
    read('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx'),
  ]);

  assert.doesNotMatch(ownerAssetActions, /removeAssetRegisterItemFromMarketplace/);
  assert.match(ownerAssetActions, /record the listing outcome before removing it/);
  assert.match(ownerAssetActions, /status: 409/);
  assert.doesNotMatch(ownerAssetDetail, /action: 'marketplace-remove'/);
  assert.match(ownerAssetDetail, /href=\{`\/marketplace\?listing=\$\{encodeURIComponent\(draft\.id\)\}&manage=1`\}/);
  assert.match(ownerAssetDetail, />Manage or remove advert<\/Link>/);
});
