import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Share Asset opens the inside or outside Aim4price choice before either flow', async () => {
  const [client, component] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetExternalShare.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /type AssetShareDestination = 'choice' \| 'inside' \| 'outside'/);
  assert.match(client, /setAssetShareDestination\('choice'\);[\s\S]*?setQuoteAsset\(asset\)/);
  assert.equal((client.match(/<AssetShareDestinationPicker/g) ?? []).length, 2);
  assert.equal((client.match(/<AssetExternalShare/g) ?? []).length, 2);
  assert.match(client, /onInside=\{\(\) => setAssetShareDestination\('inside'\)\}/);
  assert.match(client, /onOutside=\{\(\) => setAssetShareDestination\('outside'\)\}/);
  assert.match(component, /<strong>Inside Aim4price<\/strong>/);
  assert.match(component, /<strong>Outside Aim4price<\/strong>/);
});

test('outside sharing maps saved asset details and exposes WhatsApp, email and copy actions', async () => {
  const [client, component] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetExternalShare.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /function buildExternalShareAsset/);
  assert.match(client, /serialNumber: asset\.serialNumber/);
  assert.match(client, /yearModel: asset\.yearModel/);
  assert.match(client, /usage: buildAssetUsageValue\(asset\)/);
  assert.match(client, /condition: conditionLabel\(asset\.condition\)/);
  assert.match(client, /replacementPriceExVat: readAssetReplacementPriceExVat\(asset\)/);
  assert.match(client, /valueExVat: asset\.value/);
  assert.match(client, /normalizePhotos\(asset\.photos\)\.flatMap/);
  assert.match(client, /toAbsoluteUrl\(photoUrl\)/);
  assert.match(client, /publicUrl: buildAssetScanUrl\(asset\)/);
  assert.match(component, /buildWhatsAppShareUrl/);
  assert.match(component, /buildEmailShareUrl/);
  assert.match(component, />WhatsApp<\/span>/);
  assert.match(component, />Email<\/span>/);
  assert.match(component, />Copy details<\/span>/);
});

test('the existing internal partner choices remain in the inside Aim4price path', async () => {
  const client = await readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');

  assert.match(client, /assetShareDestination === 'outside'[\s\S]*?assetShareInsideFlow/);
  assert.match(client, /Finance &amp; accounting/);
  assert.match(client, /<strong>Insurance<\/strong>/);
  assert.match(client, /<strong>Dealer<\/strong>/);
  assert.match(client, /<strong>Licence renewal<\/strong>/);
  assert.match(client, /openFullRegisterQuotePartnerPicker\('finance'\)/);
  assert.match(client, /openFullRegisterQuotePartnerPicker\('insurance'\)/);
  assert.match(client, /openFullRegisterQuotePartnerPicker\('replacement_quote'\)/);
  assert.match(client, /openFullRegisterQuotePartnerPicker\('license_renewal'\)/);
});

test('inside choices use a roomy 2x2 layout and outside sharing keeps polished send controls in reach', async () => {
  const [client, pageStyles, component, componentStyles] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetExternalShare.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetExternalShare.module.css', import.meta.url), 'utf8'),
  ]);

  assert.equal((client.match(/styles\.assetShareInsideModal/g) ?? []).length, 2);
  assert.match(pageStyles, /\.assetShareInsideModal \.assetQuoteChoiceGrid[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(pageStyles, /\.assetShareInsideModal \.assetQuoteChoiceGrid \.assetQuoteChoiceCard[\s\S]*?min-height: 13\.5rem !important/);
  assert.match(pageStyles, /@media \(max-width: 820px\)[\s\S]*?assetShareInsideModal[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important/);

  assert.match(pageStyles, /\.externalAssetShareModal \.assetQuoteScrollBody[\s\S]*?scrollbar-gutter: stable/);
  assert.match(pageStyles, /\.externalAssetShareModal \.assetQuoteScrollBody::\-webkit-scrollbar-thumb/);
  assert.match(componentStyles, /\.messagePreview::\-webkit-scrollbar-thumb/);
  assert.match(componentStyles, /\.externalActions \{[\s\S]*?position: sticky;[\s\S]*?bottom: -0\.35rem/);
  assert.match(component, /<strong>Choose how to send<\/strong>/);
  assert.match(component, /className=\{styles\.externalActionButtons\}/);
});
