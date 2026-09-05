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
  assert.match(client, /function renderBasicBrandModelStep\(\)[\s\S]*?styles\.basicFamilyContextStage[\s\S]*?styles\.equipmentStageTopSolo[\s\S]*?selectedFamily\.familyLabel/);
  assert.match(client, /function renderBasicLevelStep\(\)[\s\S]*?styles\.basicFamilyContextStage[\s\S]*?styles\.equipmentStageTopSolo[\s\S]*?selectedFamily\.familyLabel/);
  assert.match(client, /function renderDetailsStep\(\)[\s\S]*?basicEstimateActive && selectedFamily[\s\S]*?styles\.equipmentStageTopSolo[\s\S]*?selectedFamily\.familyLabel/);
  assert.match(client, /function renderBasicReplacementStep\(\)[\s\S]*?styles\.basicFamilyContextStage[\s\S]*?styles\.equipmentStageTopSolo[\s\S]*?selectedFamily\.familyLabel/);
  assert.match(client, /<section className=\{`\$\{styles\.wizardShell\} \$\{styles\.sectorWizardShell\}`\}>/);
  assert.match(client, /id="valuation-wizard-card" className=\{`\$\{styles\.wizardCard\} \$\{styles\.sectorWizardCard\}`\}/);
  assert.doesNotMatch(client, /isSectorIntroStep \? styles\.sectorWizardShell/);
  assert.doesNotMatch(client, /isSectorIntroStep \? styles\.sectorWizardCard/);
  assert.doesNotMatch(client, /Quick mathematical estimate using the asset family, its condition, usage and replacement price\./);
  assert.doesNotMatch(client, /Deeper model, specification and Aim4price market intelligence\./);
});

test('typed Brand and optional Model stay simple and user-facing', () => {
  assert.match(client, /<span className=\{styles\.fieldLabel\}>Brand<\/span>[\s\S]*?placeholder="e\.g\. John Deere"/);
  assert.match(client, /<span className=\{styles\.fieldLabel\}>Model<\/span>[\s\S]*?placeholder="e\.g\. 6155M"/);
  assert.match(client, /Add as much brand and model detail as you can\. Aim4price will use it to build the strongest estimate possible\./);
  assert.match(client, /styles\.basicIdentityIntro/);
  assert.doesNotMatch(client, /I don&apos;t know the model/);
  assert.doesNotMatch(client, /Brand and model are stored with the estimate and Asset Register without creating catalogue records/);
  assert.match(client, /setBrandSlug\(UNKNOWN_BRAND_SLUG\)/);
  assert.match(client, /setGenericModelMode\(normalizeText\(typedModelName\) \? 'manual' : 'unknown'\)/);
  assert.match(client, /\[TYPED_BRAND_NAME_SPEC_KEY\]: typedUnlistedBrandName/);
  assert.match(client, /basic_estimate: true/);
});

test('Specification Level does not repeat Brand or Model above the heading', () => {
  const levelStart = client.indexOf('function renderBasicLevelStep()');
  const levelEnd = client.indexOf('function renderBasicReplacementStep()', levelStart);
  const levelBlock = client.slice(levelStart, levelEnd);
  assert.ok(levelStart >= 0 && levelEnd > levelStart);
  assert.doesNotMatch(levelBlock, /normalizeText\(unlistedBrandName\)/);
  assert.doesNotMatch(levelBlock, /normalizeText\(typedModelName\)/);
  assert.match(levelBlock, /styles\.equipmentStageTopSolo[\s\S]*?selectedFamily\.familyLabel/);
});

test('Basic Specs uses modal cards for condition, popularity and extras', () => {
  assert.match(client, /type DetailsModal = 'year' \| 'usage' \| 'condition' \| 'popularity' \| 'extras' \| null/);
  assert.match(client, /type ConditionModalView = 'choose' \| 'basic' \| 'advanced'/);
  assert.match(client, /function renderBasicConditionModal\(\)/);
  assert.match(client, /conditionModalView === 'choose'/);
  assert.match(client, /chooseConditionRoute\('basic'\)/);
  assert.match(client, /chooseConditionRoute\('advanced'\)/);
  assert.match(client, /<strong>Basic<\/strong>/);
  assert.match(client, /<strong>Advanced<\/strong>/);
  assert.match(client, /basicEstimateActive && usageStepComplete[\s\S]*?id="valuation-condition-step"[\s\S]*?conditionReady \? '✓' : 3/);
  assert.match(client, /basicEstimateActive && conditionReady[\s\S]*?id="valuation-popularity-step"[\s\S]*?popularityStepComplete \? '✓' : 4/);
  assert.match(client, /basicEstimateActive && popularityStepComplete[\s\S]*?id="valuation-extras-step"[\s\S]*?basicExtrasComplete \? '✓' : 5/);
  assert.match(client, /activeDetailsModal === 'condition' \? renderBasicConditionModal\(\)/);
  assert.match(client, /activeDetailsModal === 'popularity' \? renderBasicPopularityModal\(\)/);
  assert.match(client, /activeDetailsModal === 'extras' \? renderBasicExtrasModal\(\)/);
  assert.match(client, /styles\.conditionRouteModal/);
  assert.match(client, /styles\.conditionOptionsModal/);
  assert.match(client, /styles\.popularityModalPanel/);
  assert.match(client, /styles\.popularityModalStarButton/);
  assert.match(valuationStyles, /\.conditionRouteGrid[^\{]*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(valuationStyles, /\.conditionAdvancedPanel[^\{]*\{[\s\S]*?overflow-y: auto/);
  assert.match(valuationStyles, /\.specChoiceModal[^\{]*\{[\s\S]*?scrollbar-width: thin/);
  assert.match(valuationStyles, /\.popularityModalStars[^\{]*\{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
});
test('Condition modal keeps the route choice minimal and shows Advanced questions one at a time', () => {
  const conditionStart = client.indexOf('function renderBasicConditionModal()');
  const popularityStart = client.indexOf('function renderBasicPopularityModal()', conditionStart);
  const conditionBlock = client.slice(conditionStart, popularityStart);
  const chooserStart = conditionBlock.indexOf("conditionModalView === 'choose'");
  const detailStart = conditionBlock.indexOf('const advancedCondition', chooserStart);
  const chooserBlock = conditionBlock.slice(chooserStart, detailStart);

  assert.ok(conditionStart >= 0 && popularityStart > conditionStart);
  assert.doesNotMatch(chooserBlock, /Choose one overall condition for the asset\./);
  assert.doesNotMatch(chooserBlock, /Assess the important condition areas separately\./);
  assert.doesNotMatch(chooserBlock, /Choose the amount of detail you know\. Both routes feed the same Aim4price estimate\./);
  assert.doesNotMatch(conditionBlock, /conditionModalBackButton/);
  assert.match(conditionBlock, /const advancedQuestionIndex = currentDetailedSectionIndex >= 0 \? currentDetailedSectionIndex : 0/);
  assert.match(conditionBlock, /Question \{advancedQuestionIndex \+ 1\} of \{advancedQuestionTotal\}/);
  assert.match(conditionBlock, /showNextAdvancedQuestion\(0\)/);
  assert.match(conditionBlock, /showNextAdvancedQuestion\(3\)/);
  assert.match(valuationStyles, /\.conditionBasicModal \.basicConditionOptionGrid[^\{]*\{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(valuationStyles, /\.conditionProgressiveModal[^\{]*\{[\s\S]*?overflow: hidden/);
  assert.match(valuationStyles, /\.conditionQuestionProgressTrack/);
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
  assert.doesNotMatch(client, /Replacement price required/);
  assert.doesNotMatch(client, /Aim4price does not yet have a reliable replacement-price range/);
  assert.doesNotMatch(client, /Aim4price provides an indicative estimate only\. It is not a certified valuation or inspection report\. Final value should still be checked against asset condition, documents, location and current market demand\./);
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
  assert.match(valuationStyles, /\.basicFamilyContextStage[^\{]*\{[\s\S]*?position: relative;/);
  assert.match(valuationStyles, /\.basicIdentityIntro[^\{]*\{[\s\S]*?max-width: none;[\s\S]*?white-space: nowrap;/);
  assert.match(valuationStyles, /@media \(max-width: 1020px\) \{[\s\S]*?\.basicIdentityIntro[^\{]*\{[\s\S]*?white-space: normal;/);
  assert.match(valuationStyles, /\.sectorWizardShell[^\{]*\{[\s\S]*?width: min\(100%, 1088px\);/);
  assert.match(valuationStyles, /\.estimateModeSectorLabel \.selectedSummaryPill,\s*\.equipmentStageTopSolo \.selectedSummaryPill \{[\s\S]*?font-size: 0\.82rem;[\s\S]*?font-weight: 850;[\s\S]*?letter-spacing: 0\.11em;[\s\S]*?line-height: 1\.15;/);
  assert.match(valuationStyles, /@media \(max-width: 900px\) \{[\s\S]*?\.equipmentStageTopSolo \{[\s\S]*?justify-content: flex-end;/);
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
