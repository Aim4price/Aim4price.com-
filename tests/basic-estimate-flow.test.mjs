import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  BASIC_SPECIFICATION_LEVELS,
  getBasicConditionTemplate,
  getBasicFamilyExtra,
  resolveBasicReplacementGuide,
} from '../lib/basic-estimate.ts';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [client, valuationStyles, dealerStyles, genericValuation] = await Promise.all([
  read('app/valuation/valuation-client.tsx'),
  read('app/valuation/page.module.css'),
  read('app/dealer/dealer.module.css'),
  read('lib/generic-valuation.ts'),
]);

function band(overrides = {}) {
  return {
    id: 1,
    brandId: null,
    bandKey: 'family',
    bandLabel: 'Family range',
    specMatchJson: {},
    replacementMinExVat: 1_000_000,
    replacementMaxExVat: 3_000_000,
    replacementPriceYear: 2026,
    confidence: 0.7,
    ...overrides,
  };
}

test('Basic replacement guides only use family-level replacement bands', () => {
  const guide = resolveBasicReplacementGuide([
    band({ id: 11, brandId: 44, replacementMinExVat: 900_000, replacementMaxExVat: 1_100_000 }),
  ], 'standard');

  assert.equal(guide, null, 'brand/model pricing must not be aggregated into a made-up family range');
});

test('Entry, Standard and Premium position broad family pricing without changing valuation directly', () => {
  assert.deepEqual(BASIC_SPECIFICATION_LEVELS.map(({ key, label }) => [key, label]), [
    ['entry', 'Entry'],
    ['standard', 'Standard'],
    ['premium', 'Premium'],
  ]);

  const familyBands = [band()];
  const entry = resolveBasicReplacementGuide(familyBands, 'entry');
  const standard = resolveBasicReplacementGuide(familyBands, 'standard');
  const premium = resolveBasicReplacementGuide(familyBands, 'premium');

  assert.ok(entry && standard && premium);
  assert.ok(entry.suggestedExVat < standard.suggestedExVat);
  assert.ok(standard.suggestedExVat < premium.suggestedExVat);
  assert.equal(entry.source, 'family');
  assert.equal(standard.source, 'family');
  assert.equal(premium.source, 'family');
});

test('explicit family tier bands are preferred when the dataset contains them', () => {
  const guide = resolveBasicReplacementGuide([
    band({ id: 1 }),
    band({
      id: 2,
      bandKey: 'premium',
      bandLabel: 'Premium specification',
      replacementMinExVat: 2_600_000,
      replacementMaxExVat: 3_500_000,
    }),
  ], 'premium');

  assert.ok(guide);
  assert.equal(guide.source, 'tier');
  assert.deepEqual(guide.sourceBandIds, [2]);
  assert.ok(guide.suggestedExVat >= 2_600_000 && guide.suggestedExVat <= 3_500_000);
});

test('family-aware condition labels and common extras stay deliberately small', () => {
  const tractor = getBasicConditionTemplate({ familyKey: 'tractors', familyLabel: 'Tractors', isPropelled: true, usageMetricType: 'hours' });
  const trailer = getBasicConditionTemplate({ familyKey: 'flatbed_trailers', familyLabel: 'Flatbed Trailers', isPropelled: false, usageMetricType: 'wear_class' });

  assert.equal(tractor.mechanical, 'Mechanical / engine');
  assert.equal(trailer.mechanical, 'Structure / chassis');
  assert.deepEqual(getBasicFamilyExtra('tractors', 'Tractors'), { key: 'front_loader', label: 'Front Loader' });
  assert.deepEqual(getBasicFamilyExtra('excavators', 'Excavators'), { key: 'hammer_attachment', label: 'Hammer attachment' });
  assert.equal(getBasicFamilyExtra('miscellaneous', 'Miscellaneous equipment'), null);
});

test('Basic Estimate exposes the requested six-step family-first flow and bypasses the legacy Path screen', () => {
  assert.match(client, /\{ step: 1, label: 'Equipment' \}[\s\S]*?\{ step: 2, label: 'Brand & Model' \}[\s\S]*?\{ step: 3, label: 'Level' \}[\s\S]*?\{ step: 4, label: 'Specs' \}[\s\S]*?\{ step: 5, label: 'Replacement' \}[\s\S]*?\{ step: 6, label: 'Value' \}/);
  assert.match(client, /if \(basicEstimateActive\) \{[\s\S]*?if \(step === 2\) return renderBasicBrandModelStep\(\);[\s\S]*?if \(step === 3\) return renderBasicLevelStep\(\);[\s\S]*?if \(step === 4\) return renderDetailsStep\(\);[\s\S]*?if \(step === 5\) return renderBasicReplacementStep\(\);/);
  assert.match(client, /<strong className=\{styles\.sectorLabel\}>Basic<\/strong>[\s\S]*?<span className=\{styles\.sectorCardHint\}>Start estimate →<\/span>/);
  assert.match(client, /<strong className=\{styles\.sectorLabel\}>Advanced<\/strong>[\s\S]*?styles\.estimateModeAdvancedSpacer/);
  assert.match(client, /Aim4price Exclusive/);
  assert.match(client, /styles\.estimateModeIntro/);
  assert.match(client, /styles\.estimateModeSectorLabel/);
  assert.match(client, /styles\.exclusiveBadge/);
  assert.doesNotMatch(client, /styles\.estimateModeBasicCard/);
  assert.doesNotMatch(client, /Quick mathematical estimate using the asset family, its condition, usage and replacement price\./);
  assert.doesNotMatch(client, /Deeper model, specification and Aim4price market intelligence\./);
});

test('typed Brand and optional Model are stored as identity inputs without creating catalogue requirements', () => {
  assert.match(client, /<span className=\{styles\.fieldLabel\}>Brand<\/span>[\s\S]*?placeholder="e\.g\. John Deere"/);
  assert.match(client, /<span className=\{styles\.fieldLabel\}>Model<\/span>[\s\S]*?placeholder="e\.g\. 6155M"[\s\S]*?Optional\. Brand and model are stored/);
  assert.match(client, /I don&apos;t know the model/);
  assert.match(client, /setBrandSlug\(UNKNOWN_BRAND_SLUG\)/);
  assert.match(client, /\[TYPED_BRAND_NAME_SPEC_KEY\]: typedUnlistedBrandName/);
  assert.match(client, /basic_estimate: true/);
});

test('Basic usage follows family valuationMode, including no-usage and percentage-worked families', () => {
  assert.match(client, /const basicUsageNotRequired = basicEstimateActive && selectedFamily\?\.valuationMode === 'year_condition'/);
  assert.match(client, /const basicUsesPercentageWorked = basicEstimateActive && selectedFamily\?\.valuationMode === 'percent_used'/);
  assert.match(client, /const showHoursInput = !basicUsageNotRequired && !basicUsesPercentageWorked/);
  assert.match(client, /Not required for this family/);
  assert.match(client, /usage_basis: 'none'/);
});

test('year_condition remains inside the shared generic engine and does not fabricate usage', () => {
  assert.match(genericValuation, /if \(input\.valuationMode === 'year_condition'\) \{[\s\S]*?const ageDepPct = input\.yearModelUnknown \? 0 : tractorAgeDepPct\(yearForDepreciation\);[\s\S]*?const ageAdjustedValue/);
  assert.match(genericValuation, /method: 'semi_depreciation',[\s\S]*?lifeWorkedPercent: null,[\s\S]*?lifeRemainingPercent: null,[\s\S]*?estimatedHours: null,[\s\S]*?maxLifetimeHours: null,[\s\S]*?usageDepPct: null/);
  assert.match(genericValuation, /family\.valuationMode === 'year_condition' \? 'none'/);
});

test('popularity, explicit extras and replacement-price confirmation are mandatory before Basic calculation', () => {
  assert.match(client, /if \(!popularityStepComplete\) return 'Choose a popularity rating from 1 to 5 stars\.'/);
  assert.match(client, /if \(!basicExtraChoice\) return 'Confirm whether an extra is fitted\.'/);
  assert.match(client, /None fitted/);
  assert.match(client, /Other extra/);
  assert.match(client, /Selected replacement price/);
  assert.match(client, /Enter replacement price manually/);
  assert.match(client, /Aim4price does not yet have a reliable replacement-price range/);
  assert.match(client, /basicTotalReplacementPriceExVat/);
});

test('replacement styling reuses the year slider visual language and does not introduce a new font', () => {
  assert.match(client, /styles\.yearSliderPanel/);
  assert.match(client, /styles\.yearSliderReadout/);
  assert.match(client, /styles\.yearRangeInput/);
  assert.match(client, /styles\.yearSliderMeta/);
  assert.match(valuationStyles, /\.stepper \{\s*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\);/);
  assert.match(dealerStyles, /wizardHeader[^\n]*> \[class\*='stepper'\][^\{]*\{[\s\S]*?grid-template-columns: repeat\(6, minmax\(0, 1fr\)\) !important;/);

  const basicCss = valuationStyles.split('/* === Family-first Basic Estimate ===')[1] ?? '';
  assert.ok(basicCss, 'Basic Estimate styling block should be present');
  assert.doesNotMatch(basicCss, /font-family\s*:/, 'Basic Estimate must inherit Aim4price typography');
  assert.match(valuationStyles, /\.estimateModeSectorLabel[^\{]*\{[\s\S]*?position: absolute;[\s\S]*?right: 0;[\s\S]*?justify-content: flex-end;/);
  assert.match(valuationStyles, /\.estimateModeAdvancedCard \.sectorCardTopRow[^\{]*\{[\s\S]*?position: absolute;[\s\S]*?right: clamp\(1rem, 1\.35vw, 1\.2rem\);/);
  assert.match(valuationStyles, /\.estimateModeAdvancedSpacer[^\{]*\{[\s\S]*?visibility: hidden;/);
  assert.match(valuationStyles, /\.exclusiveBadge[^\{]*\{[\s\S]*?border: 1px solid rgba\(239, 193, 84, 0\.9\);[\s\S]*?text-transform: uppercase;/);
  const estimateTypeCss = valuationStyles.split('/* === Estimate type: sector-card parity ===')[1] ?? '';
  assert.ok(estimateTypeCss, 'Estimate type parity styling block should be present');
  assert.doesNotMatch(estimateTypeCss, /\.estimateModeCard \.sectorLabel/);
  assert.doesNotMatch(estimateTypeCss, /\.estimateModeCard \.sectorBigCardContent/);
});

test('the final result renderer and save destinations remain shared with the existing valuation flow', () => {
  assert.match(client, /if \(basicEstimateActive\) \{[\s\S]*?if \(step === 5\) return renderBasicReplacementStep\(\);[\s\S]*?return renderResultStep\(\);/);
  assert.match(client, /Save to Asset Register/);
  assert.match(client, /Save to My Assets/);
  assert.match(client, /Dealer Asset Register/);
  assert.match(client, /Marketplace/);
  assert.match(client, /downloadValuationPdf/);
});
