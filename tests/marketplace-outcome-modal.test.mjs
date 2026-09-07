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

  assert.match(source, /Did Aim4price help with this outcome in any way\?/);
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
  assert.match(source, /const listingId = String\(listing\.id \?\? ''\)\.trim\(\)/);
  assert.match(source, /assetId: assetId \|\| null/);
  assert.match(source, /listingId,/);
  assert.doesNotMatch(source, /not linked to a saved asset and cannot be removed here/);
  assert.match(source, /assetId \? \(/);
  assert.match(source, /its outcome history remains available/);
});

test('advert removal mirrors the Asset Register confirmation and four-step disposal journey', async () => {
  const [source, styles] = await Promise.all([
    read('components/MarketplaceOutcomeModal.tsx'),
    read('components/MarketplaceOutcomeModal.module.css'),
  ]);

  assert.match(source, /type RemovalStage = 'confirm' \| 'wizard'/);
  assert.match(source, /Are you sure you want to remove this\?/);
  assert.match(source, /Selected advert/);
  assert.match(source, /Yes, remove advert/);
  assert.match(source, /setStage\('wizard'\)/);

  for (const step of ['Outcome', 'Details', 'Aim4price impact', 'Information']) {
    assert.match(source, new RegExp(`label: '${step}'`));
  }

  assert.match(source, /aria-label=\{`Step \$\{step\} of 4`\}/);
  assert.match(source, /aria-current=\{item\.step === step \? 'step'/);
  assert.match(source, /step === 1[\s\S]*?What happened to this advert\?/);
  assert.match(source, /step === 2[\s\S]*?\{detailsHeading\(reason\)\}/);
  assert.match(source, /step === 3[\s\S]*?Did Aim4price help with this outcome in any way\?/);
  assert.match(source, /step === 4[\s\S]*?Review what will happen/);
  assert.match(source, /Withdraw advert and keep asset/);
  assert.match(source, /Your saved asset, valuation and history stay available/);
  assert.match(source, /step < 4[\s\S]*?nextStep[\s\S]*?submitOutcome/);
  assert.match(source, /Save outcome & remove advert/);

  const confirmStart = source.indexOf("{stage === 'confirm' ? (");
  const wizardStart = source.indexOf('\n        ) : (', confirmStart);
  const confirmSource = source.slice(confirmStart, wizardStart);
  const wizardSource = source.slice(wizardStart);

  assert.match(confirmSource, /styles\.confirmContent/);
  assert.match(confirmSource, /styles\.confirmCloseButton/);
  assert.match(confirmSource, /styles\.selectedAdvert/);
  assert.match(confirmSource, /styles\.confirmActions/);
  assert.doesNotMatch(confirmSource, /styles\.header|styles\.body|<footer/);
  assert.ok(wizardSource.indexOf('styles.wizardBody') < wizardSource.indexOf('styles.wizardActions'));
  assert.match(wizardSource, /styles\.wizardActions[\s\S]*?className=\{styles\.primaryButton\}[\s\S]*?Save outcome & remove advert/);

  assert.match(styles, /\.confirmDialog\s*\{[^}]*width:\s*min\(calc\(var\(--website-design-vw(?:, 1vw)?\) \* 96\), 58rem\)/);
  assert.match(styles, /\.confirmDialog\s*\{[^}]*padding:\s*clamp\(1\.75rem, calc\(var\(--website-design-vw(?:, 1vw)?\) \* 2\.55\), 2\.35rem\)/);
  assert.match(styles, /\.confirmContent\s*\{[^}]*gap:\s*1\.15rem/);
  assert.match(styles, /\.confirmContent h2\s*\{[^}]*padding:[^;]*1\.1rem[^;]*;[^}]*border-bottom:/);
  assert.match(styles, /\.confirmCloseButton\s*\{[^}]*position:\s*absolute;[^}]*width:\s*3rem/);
  assert.match(styles, /\.confirmActions\s*\{[^}]*justify-content:\s*flex-end;[^}]*gap:\s*0\.75rem/);
  assert.match(styles, /\.dialog\s*\{[^}]*width:\s*min\(52rem, calc\(calc\(var\(--website-design-vw(?:, 1vw)?\) \* 100\) - 2rem\)\)/);
  assert.match(styles, /\.dialog\s*\{[^}]*max-height:\s*min\((?:calc\(var\(--website-design-vh(?:, 1dvh)?\) \* 90\)|calc\(var\(--website-visible-height(?:, 100dvh)?\) \* 0\.9\)), 52rem\);[^}]*display:\s*flex;[^}]*flex-direction:\s*column/);
  assert.match(styles, /\.wizardActions\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*-1\.4rem;[^}]*padding:\s*0\.85rem 0 0/);
  assert.match(styles, /\.progress\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.reasonGrid\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.reasonGrid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*?\.reasonGrid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test('shared Marketplace outcome dialog is keyboard and screen-reader accessible', async () => {
  const [source, styles] = await Promise.all([
    read('components/MarketplaceOutcomeModal.tsx'),
    read('components/MarketplaceOutcomeModal.module.css'),
  ]);

  assert.match(source, /role=\{stage === 'confirm' \? 'alertdialog' : 'dialog'\}/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby=\{titleId\}/);
  assert.match(source, /aria-describedby=\{descriptionId\}/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /previouslyFocused\?\.focus\(\)/);
  assert.match(source, /role="alert"/);
  assert.match(source, /aria-pressed=\{reason === option\.value\}/);
  assert.match(source, /stepHeadingRef\.current\?\.focus\(\)/);
  assert.match(styles, /font-family: 'Montserrat'/);
  assert.match(styles, /\.dialog button,\s*\.dialog input,\s*\.dialog textarea\s*\{[^}]*font-family:\s*inherit/);
  assert.doesNotMatch(styles, /\.dialog button,\s*\.dialog input,\s*\.dialog textarea\s*\{[^}]*font:\s*inherit/);
  assert.match(styles, /\.dialog\s*\{[^}]*border-radius:\s*1\.8rem/);
  assert.match(styles, /\.closeButton\s*\{[^}]*width:\s*3\.08rem;[^}]*height:\s*3\.08rem;[^}]*border-radius:\s*999px/);
  assert.match(styles, /\.closeButton\s*\{[^}]*color:\s*#1d3b62;[^}]*background:\s*linear-gradient\(180deg, #f7fbff 0%, #edf4fb 100%\)/);
  assert.match(styles, /\.option\s*\{[^}]*min-height:\s*3\.55rem;[^}]*border-radius:\s*0\.95rem/);
  assert.match(styles, /\.cancelButton,[\s\S]*?\.removeButton\s*\{[^}]*min-height:\s*3\.25rem;[^}]*font-weight:\s*800/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.selectedAdvert span\s*\{[^}]*text-transform:\s*uppercase/);
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
  assert.match(marketplace, /const canManageActiveListing = Boolean\(activeListing\?\.canManage\)/);
  assert.match(marketplace, /disabled=\{!manageListingTarget\.sourceAssetId\}/);
  assert.match(marketplace, /item\.id !== listing\.id/);
  assert.doesNotMatch(marketplace, /method: 'DELETE'/);

  assert.match(showroom, /<MarketplaceOutcomeModal/);
  assert.match(showroom, /source="showroom"/);
  assert.match(showroom, /Manage advert/);
  assert.match(showroom, /Open in Marketplace/);
  assert.match(showroom, /setListings\(\(current\) => current\.filter\(\(item\) => item\.id !== listing\.id\)\)/);
  assert.match(showroom, /Editing requires a saved asset\./);
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

