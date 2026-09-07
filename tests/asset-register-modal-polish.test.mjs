import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const assetRegisterClient = read('app/asset-register/asset-register-client.tsx');
const assetRegisterStyles = read('app/asset-register/page.module.css');
const header = read('components/AppHeader.tsx');
const headerStyles = read('components/AppHeader.module.css');

test('header navigation arrows expose clear Previous and Next hover labels', () => {
  const previousButton = header.slice(
    header.indexOf('styles.navWindowButtonPrevious'),
    header.indexOf('</button>', header.indexOf('styles.navWindowButtonPrevious')),
  );
  const nextButton = header.slice(
    header.indexOf('styles.navWindowButtonNext'),
    header.indexOf('</button>', header.indexOf('styles.navWindowButtonNext')),
  );

  assert.match(previousButton, /aria-label="Show previous navigation items"/);
  assert.match(previousButton, /data-tooltip="Previous"/);
  assert.match(nextButton, /aria-label="Show next navigation items"/);
  assert.match(nextButton, /data-tooltip="Next"/);
  assert.match(headerStyles, /\.navWindowButton::after\s*\{[\s\S]*?content:\s*attr\(data-tooltip\);[\s\S]*?top:\s*-0\.35rem;[\s\S]*?bottom:\s*auto;/);
  assert.match(headerStyles, /\.navWindowButton:hover:not\(:disabled\)::after,[\s\S]*?\.navWindowButton:focus-visible::after/);
});

test('Manage uses the concise GPS location helper copy', () => {
  const manageMenu = assetRegisterClient.slice(
    assetRegisterClient.indexOf('styles.ownerCommandOverlay'),
    assetRegisterClient.indexOf('{activeAsset && ownerAssetCommandPanel', assetRegisterClient.indexOf('styles.ownerCommandOverlay')),
  );

  assert.match(manageMenu, /'Add a GPS location\.'/);
  assert.doesNotMatch(manageMenu, /Add a GPS location to place it on the map/);
});

test('new acquisition modal has one controlled spacing system', () => {
  const acquisitionStyles = assetRegisterStyles.slice(
    assetRegisterStyles.indexOf('Final cascade: simple shared Owner/Accountant acquisition question.'),
    assetRegisterStyles.indexOf('Owner paperwork and disposal refinements'),
  );

  assert.match(acquisitionStyles, /\.newAcquisitionChoiceModal\s*\{[\s\S]*?scrollbar-gutter:\s*auto !important;[\s\S]*?padding:\s*0 !important;/);
  assert.match(acquisitionStyles, /\.newAcquisitionChoiceHeader\s*\{[\s\S]*?display:\s*grid !important;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 3\.08rem !important;[\s\S]*?column-gap:\s*clamp\(2rem, calc\(var\(--website-design-vw(?:, 1vw)?\) \* 3\), 2\.75rem\) !important;[\s\S]*?margin:\s*0 !important;[\s\S]*?padding:\s*clamp\(1\.45rem,/);
  assert.match(acquisitionStyles, /\.newAcquisitionChoiceHeader \.modalHeaderText p\s*\{[\s\S]*?max-width:\s*34rem !important;[\s\S]*?white-space:\s*normal !important;[\s\S]*?text-wrap:\s*balance !important;[\s\S]*?overflow-wrap:\s*anywhere !important;/);
  assert.match(acquisitionStyles, /\.newAcquisitionChoiceBody\s*\{[\s\S]*?gap:\s*clamp\(1\.05rem,[\s\S]*?padding:\s*clamp\(1\.25rem,/);
  assert.match(acquisitionStyles, /\.newAcquisitionChoiceActions\s*\{[\s\S]*?gap:\s*0\.75rem !important;/);
});

test('Add an asset uses a wider, flatter and responsive choice layout', () => {
  const addAssetStyles = assetRegisterStyles.slice(
    assetRegisterStyles.indexOf('Manual Add Asset: visible click-to-select asset types'),
    assetRegisterStyles.indexOf('Asset update modal: refined header, section navigation and autosave'),
  );

  assert.match(addAssetStyles, /\.assetFormModalStepOne\s*\{[\s\S]*?width:\s*min\(calc\(var\(--website-design-vw(?:, 1vw)?\) \* 95\), 64rem\) !important;[\s\S]*?scrollbar-gutter:\s*auto !important;/);
  assert.match(addAssetStyles, /\.assetFormModalStepOne \.assetFormModalChromeHeader\s*\{[\s\S]*?display:\s*grid !important;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto !important;[\s\S]*?padding:\s*0 0 1\.15rem !important;/);
  assert.match(addAssetStyles, /\.assetFormModalStepOne \.assetFormModalChromeHeader p\s*\{[\s\S]*?max-width:\s*48rem !important;/);
  assert.match(addAssetStyles, /\.assetFormModalStepOne \.manualStepScrollBodyNoScroll\s*\{[\s\S]*?scrollbar-gutter:\s*auto !important;/);
  assert.match(addAssetStyles, /\.assetFormModalStepOne \.manualStepOneCard\s*\{[\s\S]*?border:\s*0 !important;[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/);
  assert.match(addAssetStyles, /\.manualAssetTypeGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;/);
  assert.match(addAssetStyles, /@media \(max-width: 820px\)[\s\S]*?\.manualAssetTypeGrid\s*\{[\s\S]*?grid-template-columns:\s*1fr !important;/);
});

test('asset entry modal close controls align to the far edge of their headers', () => {
  const addChoiceStyles = assetRegisterStyles.slice(
    assetRegisterStyles.indexOf('Add Asset choice modal compact layout, June 2026'),
    assetRegisterStyles.indexOf('@media (max-width: 900px)', assetRegisterStyles.indexOf('Add Asset choice modal compact layout, June 2026')),
  );

  assert.match(addChoiceStyles, /\.addAssetChoiceHeader\s*\{[\s\S]*?display:\s*grid !important;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto !important;[\s\S]*?padding:\s*0 0 clamp\(1rem,/);
  assert.match(addChoiceStyles, /\.addAssetChoiceModal\s*\{[\s\S]*?scrollbar-gutter:\s*auto !important;/);
  assert.match(addChoiceStyles, /\.addAssetChoiceHeader \.modalCloseButton,[\s\S]*?position:\s*static !important;[\s\S]*?justify-self:\s*end !important;[\s\S]*?margin:\s*0 !important;/);
  assert.match(assetRegisterStyles, /\.newAcquisitionChoiceHeader \.modalCloseButton\s*\{[\s\S]*?justify-self:\s*end !important;[\s\S]*?margin:\s*0 !important;/);
  assert.match(assetRegisterStyles, /\.assetFormModalStepOne \.assetFormModalChromeHeader \.modalCloseButton\s*\{[\s\S]*?justify-self:\s*end !important;[\s\S]*?margin:\s*0 !important;/);
});

