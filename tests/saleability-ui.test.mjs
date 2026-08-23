import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const valuationClient = read('app/valuation/valuation-client.tsx');
const reportRoute = read('app/api/valuation/report/route.ts');
const ownerAsset = read('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx');
const assetRegister = read('app/asset-register/asset-register-client.tsx');
const assetRegisterStyles = read('app/asset-register/page.module.css');
const valuationStyles = read('app/valuation/page.module.css');
const pricingRoute = read('app/owner-app/assets/[assetId]/manage/pricing/[mode]/page.tsx');
const modal = read('components/SaleabilityModal.tsx');
const modalStyles = read('components/saleability-modal.module.css');
const assetDb = read('lib/asset-register-db.ts');
const revaluation = read('lib/asset-register-revaluation.ts');

test('the estimate result and standard PDF include General Saleability', () => {
  assert.match(valuationClient, /General Saleability/);
  assert.match(valuationClient, /Refine Saleability/);
  assert.match(valuationClient, /saleabilityRows:/);
  assert.match(reportRoute, /<h2>Saleability<\/h2>/);
  assert.match(reportRoute, /payload\.saleabilityRows/);
});

test('Manage Pricing opens the same Saleability calculator', () => {
  assert.match(ownerAsset, /OwnerAssetPricingMode = 'landing' \| 'recalculate' \| 'future' \| 'saleability'/);
  assert.match(ownerAsset, /pricingBase}\/saleability/);
  assert.match(ownerAsset, /<SaleabilityModal/);
  assert.match(pricingRoute, /\['recalculate', 'future', 'saleability'\]/);
  assert.match(assetRegister, /<strong>Saleability<\/strong>/);
  assert.match(assetRegister, /setSaleabilityAsset\(activeAsset\)/);
  assert.match(assetRegister, /buildRegisterAssetSaleabilityInput/);
});

test('the questions use plain selectable answers and preserve the valuation boundary', () => {
  for (const wording of [
    'Where are you willing to sell it?',
    'How many similar assets are currently for sale?',
    'How many people would realistically buy it?',
    'What is demand like right now?',
    'How easy is this make or model for buyers to recognise?',
    'How quickly would you like to sell?',
    'What matters most?',
  ]) {
    assert.match(modal, new RegExp(wording.replace(/[?]/g, '\\?')));
  }
  assert.match(modal, /I’m not sure/);
  assert.doesNotMatch(modal, /<select/);
  assert.match(modal, /this value does not change here/);
  assert.match(modal, /selling-price guidance only/);
  assert.doesNotMatch(modal, /Outlook/i);
});

test('Saleability layouts preserve the estimate hierarchy and use the available modal height', () => {
  assert.match(valuationStyles, /\.resultHero\s*\{\s*order:\s*1;\s*\}[\s\S]*?\.saleabilitySummary\s*\{\s*order:\s*2;/);
  assert.match(modalStyles, /\.modal\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
  assert.match(modalStyles, /\.body\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/);
  assert.match(modal, /<h2 id="saleability-title">\{assetTitle\}<\/h2>/);
  assert.doesNotMatch(modal, /<span>Saleability<\/span>/);
  assert.match(modal, /styles\.baselineStrip/);
  assert.match(modal, /styles\.settingsCard/);
  assert.match(modal, /styles\.resultHero/);
  assert.match(modalStyles, /\.baselineStrip\s*\{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(modalStyles, /\.choiceActive,[\s\S]*?linear-gradient\(180deg, #1d7255 0%, #10533e 100%\)/);
  assert.match(modalStyles, /\.resultHero\s*\{[\s\S]*?linear-gradient\(180deg, #f7fcf9 0%, #e7f5ee 100%\)/);
  assert.match(assetRegisterStyles, /Saleability completes the main Asset Register Manage pricing choices[\s\S]*?\.pricingOptionsGrid\s*\{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
});

test('valuation inputs needed by saved assets are retained without a database migration', () => {
  assert.match(assetDb, /aim4priceSaleabilityInputs/);
  assert.match(assetDb, /conditionFactorPercent/);
  assert.match(assetDb, /popularityStars/);
  assert.match(revaluation, /resolveAdvancedAssumptionsForRevaluation/);
  assert.match(revaluation, /\.\.\.\(saved \?\? \{\}\),[\s\S]*\.\.\.requested/);
});
