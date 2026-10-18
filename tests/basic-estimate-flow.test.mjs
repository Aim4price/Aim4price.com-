import assert from 'node:assert/strict';
import { readFile } from './helpers/light-theme-source.mjs';
import test from 'node:test';
import { resolveCatalogueGuide } from '../lib/basic-catalogue-guide.ts';
import { getBasicFamilyGuidance, getBasicFamilyGuideNote } from '../lib/basic-family-guidance.ts';
import { BASIC_USAGE_FAMILIES } from '../lib/basic-usage-profiles.ts';

test('family selection help covers the catalogue without changing family identities', () => {
  const snapshot = JSON.stringify(BASIC_USAGE_FAMILIES);
  for (const [sectorKey, familyKey, familyLabel] of BASIC_USAGE_FAMILIES) {
    const guidance = getBasicFamilyGuidance({ sectorKey, familyKey, familyLabel });
    assert.ok(guidance.length > 20 && guidance.length < 180, familyKey);
    assert.doesNotMatch(guidance, /for an equivalent (asset|machine)/, `Generic fallback: ${familyKey}`);
    const note = getBasicFamilyGuideNote({ sectorKey, familyKey, familyLabel });
    assert.ok(note.length < 80, familyKey);
    assert.match(note, /[Aa]djust/, familyKey);
  }
  assert.equal(JSON.stringify(BASIC_USAGE_FAMILIES), snapshot);
});

test('selection help distinguishes similar names without cross-sector keyword collisions', () => {
  const help = (sectorKey, familyKey, familyLabel = familyKey) => getBasicFamilyGuidance({ sectorKey, familyKey, familyLabel });
  assert.match(help('agricultural', 'big_field_tractor'), /engine kW\/hp/);
  assert.match(help('agricultural', 'small_field_tractor'), /lighter fieldwork/);
  assert.match(help('construction', 'mini_excavator'), /operating weight/);
  assert.match(help('industrial', 'electric_counterbalance_forklift'), /battery specification/);
  assert.match(help('motor', 'double_cab_bakkie'), /Two full seating rows/);
  assert.doesNotMatch(help('industrial', 'press_brake'), /tractor power/);
  assert.doesNotMatch(help('industrial', 'flow_wrapper'), /bale/);
  assert.doesNotMatch(help('industrial', 'industrial_bucket_elevator'), /Attachment only/);
  assert.doesNotMatch(help('industrial', 'nitrogen_generator'), /kVA/);
  assert.doesNotMatch(help('motor', 'bush_fire_vehicle'), /passenger capacity/);
  assert.doesNotMatch(help('industrial', 'truck_tyre_changer'), /truck body/);
  assert.doesNotMatch(help('industrial', 'powered_roller_conveyor'), /compacts/);
  assert.doesNotMatch(help('construction', 'trailer_boom_lift'), /Trailer only/);
  assert.doesNotMatch(help('construction', 'skid_mounted_site_compressor'), /host is separate/);
  assert.match(help('construction', 'survey_gnss_rover'), /measurement function/);
  assert.match(help('industrial', 'vehicle_diagnostic_scanner'), /vehicle coverage/);
  assert.match(help('motor', 'fuel_tanker_trailer'), /Trailer only/);
  assert.match(help('motor', 'ambulance'), /medical equipment/);
  assert.match(help('industrial', 'air_receiver'), /pressure rating/);
  assert.match(getBasicFamilyGuideNote({ familyKey: 'small_field_tractor', familyLabel: 'Small Field Tractor' }), /Sizes overlap/);
  assert.doesNotMatch(getBasicFamilyGuideNote({ familyKey: 'unknown_future_family', familyLabel: 'New family' }), /Sizes overlap/);
});

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

test('Basic, Standard and Quality position broad family pricing without changing valuation directly', () => {
  assert.deepEqual(BASIC_SPECIFICATION_LEVELS.map(({ key, label }) => [key, label]), [
    ['entry', 'Basic'],
    ['standard', 'Standard'],
    ['premium', 'Quality'],
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
  assert.match(client, /<strong className=\{styles\.sectorLabel\}>Basic<\/strong>/);
  const estimateChoices = client.slice(client.indexOf('if (!estimateExperience) {', client.indexOf('Choose sector')), client.indexOf('function renderBasicBrandModelStep'));
  assert.doesNotMatch(estimateChoices, /Start estimate/);
  assert.match(client, /renderEstimateChoiceIcon\('basic'\)/);
  const advancedCardStart = client.indexOf('estimateModeAdvancedCard');
  assert.notEqual(advancedCardStart, -1);
  const advancedCardChunk = client.slice(
    client.lastIndexOf('<button', advancedCardStart),
    client.indexOf('</button>', advancedCardStart) + '</button>'.length,
  );
  assert.match(advancedCardChunk, /estimateModeCardLocked/);
  assert.match(advancedCardChunk, /\bdisabled\b/);
  assert.match(advancedCardChunk, /aria-disabled=\{!breakdownAccess\}/);
  assert.match(advancedCardChunk, /disabled=\{!breakdownAccess\}/);
  assert.match(advancedCardChunk, /renderEstimateChoiceIcon\('advanced'\)/);
  assert.match(advancedCardChunk, /aria-hidden="true"/);
  assert.doesNotMatch(advancedCardChunk, /Start estimate/);
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
  assert.match(client, /<span className=\{styles\.fieldLabel\}>Brand<\/span>[\s\S]*?placeholder="Enter the manufacturer"/);
  assert.match(client, /<span className=\{styles\.fieldLabel\}>Model<\/span>[\s\S]*?placeholder="Model name or number"/);
  assert.match(client, /Name your asset\. The starting price guide comes from its equipment type and specification level\./);
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
  assert.match(client, /type ExtrasModalView = 'choose' \| 'options'/);
  assert.match(client, /extrasModalView === 'choose'/);
  assert.match(client, /<strong>No extras<\/strong>/);
  assert.match(client, /<strong>Extras<\/strong>/);
  assert.match(client, /setExtrasModalView\('options'\)/);
  assert.match(client, /function renderBasicConditionModal\(\)/);
  assert.match(client, /conditionModalView === 'choose'/);
  assert.match(client, /chooseConditionRoute\('basic'\)/);
  assert.match(client, /chooseConditionRoute\('advanced'\)/);
  assert.match(client, /<strong>Basic<\/strong>/);
  assert.match(client, /<strong>Advanced<\/strong>/);
  assert.match(client, /basicEstimateActive && usageStepComplete[\s\S]*?id="valuation-condition-step"[\s\S]*?renderDetailIcon\('condition', conditionReady\)/);
  assert.match(client, /basicEstimateActive && conditionReady[\s\S]*?id="valuation-popularity-step"[\s\S]*?renderDetailIcon\('popularity', popularityStepComplete\)/);
  assert.match(client, /basicEstimateActive && popularityStepComplete[\s\S]*?id="valuation-extras-step"[\s\S]*?renderDetailIcon\('extras', basicExtrasComplete\)/);
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
test('Condition modal explains both routes and shows Advanced questions one at a time', () => {
  const conditionStart = client.indexOf('function renderBasicConditionModal()');
  const popularityStart = client.indexOf('function renderBasicPopularityModal()', conditionStart);
  const conditionBlock = client.slice(conditionStart, popularityStart);
  const chooserStart = conditionBlock.indexOf("conditionModalView === 'choose'");
  const detailStart = conditionBlock.indexOf('const advancedCondition', chooserStart);
  const chooserBlock = conditionBlock.slice(chooserStart, detailStart);

  assert.ok(conditionStart >= 0 && popularityStart > conditionStart);
  assert.match(chooserBlock, /Rate overall condition/);
  assert.match(chooserBlock, /Review wear and repairs/);
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
  assert.match(genericValuation, /if \(input\.valuationMode === 'year_condition'\) \{[\s\S]*?const ageDepPct = input\.advancedAssumptions\?\.privateSettings\?\.ageDepreciationPercent \?\? \(input\.yearModelUnknown \? 0 : tractorAgeDepPct\(yearForDepreciation, undefined, input\.advancedAssumptions\?\.privateSettings\)\);[\s\S]*?const ageAdjustedValue/);
  assert.match(genericValuation, /method: 'semi_depreciation',[\s\S]*?lifeWorkedPercent: null,[\s\S]*?lifeRemainingPercent: null,[\s\S]*?estimatedHours: null,[\s\S]*?maxLifetimeHours: null,[\s\S]*?usageDepPct: null/);
  assert.match(genericValuation, /family\.valuationMode === 'year_condition' \? 'none'/);
});

test('popularity, explicit extras and replacement-price confirmation are mandatory before Basic calculation', () => {
  assert.match(client, /if \(!popularityStepComplete\) return 'Choose a popularity rating from 1 to 5 stars\.'/);
  assert.match(client, /if \(!basicExtraChoice\) return 'Confirm whether an extra is fitted\.'/);
  assert.match(client, /None fitted/);
  assert.match(client, /Other extra/);
  assert.match(client, /Asset replacement price/);
  assert.match(client, /Enter the asset replacement price/);
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
  assert.match(valuationStyles, /\.estimateModeAdvancedCard \.sectorCardTopRow[^\{]*\{[\s\S]*?position: absolute;[\s\S]*?top: 0\.55rem;[\s\S]*?right: 0\.55rem;[\s\S]*?justify-content: flex-end;/);
  assert.match(valuationStyles, /\.estimateModeAdvancedHint[^\{]*\{[\s\S]*?opacity: 0\.92;/);
  assert.doesNotMatch(valuationStyles, /\.estimateModeAdvancedSpacer/);
  assert.match(valuationStyles, /\.exclusiveBadge[^\{]*\{[\s\S]*?border: 1px solid rgba\(239, 193, 84, 0\.92\);[\s\S]*?white-space: nowrap;[\s\S]*?text-transform: uppercase;/);
  const estimateTypeCss = valuationStyles.split('/* === Estimate type: sector-card parity ===')[1] ?? '';
  assert.ok(estimateTypeCss, 'Estimate type parity styling block should be present');
  assert.doesNotMatch(estimateTypeCss, /\.estimateModeCard \.sectorLabel/);
  assert.doesNotMatch(estimateTypeCss, /\.estimateModeCard \.sectorBigCardContent/);
});

test('Basic catalogue sliders use researched bounds and retain the legacy fallback', () => {
  const replacementBlock = client.slice(client.indexOf('function renderBasicReplacementStep()'), client.indexOf('function renderMotorSubtypeSelection'));
  assert.match(replacementBlock, /catalogueGuide.minExVat/);
  assert.match(replacementBlock, /catalogueGuide.maxExVat/);
  assert.match(replacementBlock, /catalogueGuide.sliderStep/);
  assert.match(replacementBlock, /: 5_000_000/);
  assert.match(replacementBlock, /step=\{catalogueGuide \? 'any' : replacementSliderStep\}/);
  assert.match(replacementBlock, /− \{money\(replacementSliderStep\)\}/);
  assert.match(replacementBlock, /value=\{formatReplacementPriceInput\(basicReplacementPrice\)\}/);
});

test('Basic replacement slider keeps zero stable and preserves manual values above the temporary slider ceiling', () => {
  assert.match(client, /step !== 5 \|\| !basicReplacementGuide \|\| basicReplacementPrice !== null/);
  const replacementStart = client.indexOf('function renderBasicReplacementStep()');
  const replacementBlock = client.slice(replacementStart, replacementStart + 18000);
  assert.match(replacementBlock, /parsedReplacementInput >= 0/);
  assert.match(replacementBlock, /const selectedReplacementPrice = hasReplacementSliderInput[\s\S]*?\? parsedReplacementInput[\s\S]*?: replacementSliderDefault/);
  assert.match(replacementBlock, /<strong>\{basicReplacementPrice !== null && !hasReplacementSliderInput \? 'Not set' : money\(selectedReplacementPrice\)\}<\/strong>/);
  assert.match(replacementBlock, /value=\{sliderValue\}/);
});

test('Basic replacement VAT selector preserves an ex-VAT valuation basis and shows the asset/extras total', () => {
  assert.match(client, /const \[basicReplacementVatMode, setBasicReplacementVatMode\] = useState<VatDisplayMode>\('excl'\);/);
  assert.match(client, /const basicBaseReplacementPriceExVat = basicReplacementEnteredPrice === null[\s\S]*?basicReplacementVatMode === 'incl'[\s\S]*?basicReplacementEnteredPrice \/ \(1 \+ VAT_RATE\)/);

  const replacementStart = client.indexOf('function renderBasicReplacementStep()');
  const replacementEnd = client.indexOf('function renderMotorSubtypeSelection', replacementStart);
  const replacementBlock = client.slice(replacementStart, replacementEnd);
  assert.ok(replacementStart >= 0 && replacementEnd > replacementStart);
  assert.match(replacementBlock, /role="group" aria-label="Replacement price VAT basis"/);
  assert.match(replacementBlock, /styles\.replacementPriceStack[\s\S]*?styles\.replacementSliderReadout[\s\S]*?styles\.replacementVatToggle[\s\S]*?<label className=\{styles\.yearSliderControl\}>/);
  assert.match(valuationStyles, /\.replacementPriceStack/);
  assert.match(valuationStyles, /\.replacementPriceStack[^\{]*\{[\s\S]*?grid-row: 1 \/ span 2;[\s\S]*?grid-template-rows: minmax\(0, 1fr\) auto;[\s\S]*?align-self: stretch;/);
  assert.match(valuationStyles, /\.replacementSliderPanel[^\{]*\{[\s\S]*?grid-template-columns: minmax\(20rem, 21\.5rem\) minmax\(0, 1fr\);[\s\S]*?grid-template-rows: minmax\(9\.75rem, 1fr\) auto;[\s\S]*?align-items: stretch;/);
  assert.match(valuationStyles, /\.replacementSliderPanel \.yearFineTuneButton[^\{]*\{[\s\S]*?min-height: 3\.45rem;/);
  assert.match(valuationStyles, /@media \(max-width: 900px\) \{[\s\S]*?\.replacementSliderPanel[^\{]*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(replacementBlock, />\s*Excluding VAT\s*<\/button>/);
  assert.match(replacementBlock, />\s*Including VAT\s*<\/button>/);
  assert.match(replacementBlock, /setBasicReplacementVatModePreservingPrice\('excl'\)/);
  assert.match(replacementBlock, /setBasicReplacementVatModePreservingPrice\('incl'\)/);
  assert.match(replacementBlock, /currentDisplayPrice \* \(1 \+ VAT_RATE\)/);
  assert.match(replacementBlock, /currentDisplayPrice \/ \(1 \+ VAT_RATE\)/);
  assert.match(replacementBlock, /replacementVatLabel/);
  assert.match(replacementBlock, /Asset replacement/);
  assert.doesNotMatch(replacementBlock, /Configured asset replacement/);
  assert.match(replacementBlock, /renderReplacementBreakdown/);

  assert.match(valuationStyles, /\.replacementVatToggle/);
  assert.match(valuationStyles, /\.replacementVatToggle button\.replacementVatToggleActive/);
  assert.match(valuationStyles, /\.replacementSliderReadout strong[^\{]*\{[\s\S]*?font-size: clamp\(1\.6rem, calc\(var\(--website-design-vw(?:, 1vw)?\) \* 2\.2\), 2\.2rem\);[\s\S]*?white-space: nowrap;/);
});

test('the final result renderer and save destinations remain shared with the existing valuation flow', () => {
  assert.match(client, /if \(basicEstimateActive\) \{[\s\S]*?if \(step === 5\) return renderBasicReplacementStep\(\);[\s\S]*?return renderResultStep\(\);/);
  assert.match(client, /Save to Asset Register/);
  assert.match(client, /Save to My Assets/);
  assert.match(client, /Dealer Asset Register/);
  assert.match(client, /Marketplace/);
  assert.match(client, /downloadValuationPdf/);
});




// Execute the actual initialization callback to cover the clear-and-retype regression.
test('replacement initialization leaves deliberately cleared and edited prices alone', () => {
  const guard = client.indexOf('if (!basicEstimateActive || step !== 5 || !basicReplacementGuide || basicReplacementPrice !== null)');
  assert.ok(guard > 0);
  const callback = client.slice(guard, client.indexOf('}, [basicEstimateActive', guard));
  for (const initial of [null, '', '0', '12', '125000', '9000000']) {
    let price = initial;
    let vat = 'incl';
    const dependencies = {
      basicEstimateActive: true, step: 5,
      basicReplacementGuide: { suggestedExVat: 850000 },
      basicReplacementPrice: price, selectedSector: 'agricultural', selectedFamily: {},
      getDefaultVatDisplayMode: () => 'excl',
      getVatDisplayValue: (value) => value,
      setBasicReplacementVatMode: (value) => { vat = value; },
      setBasicReplacementPrice: (value) => { price = value; },
    };
    new Function(...Object.keys(dependencies), callback)(...Object.values(dependencies));
    assert.equal(price, initial === null ? '850000' : initial);
    assert.equal(vat, initial === null ? 'excl' : 'incl');
  }
});

test('specification shortcut updates all three ranges and preserves the VAT basis', () => {
  const start = client.indexOf('function applyReplacementSpecification(level: BasicSpecificationLevel) {');
  const end = client.indexOf('function renderBasicReplacementStep()', start);
  assert.ok(start > 0 && end > start);
  const source = client.slice(start, end);
  const body = source.slice(source.indexOf('{') + 1, source.lastIndexOf('}'));
  const catalogue = { minimumExVat: 100000, maximumExVat: 1000000 };
  for (const mode of ['excl', 'incl']) {
    for (const level of ['entry', 'standard', 'premium']) {
      let selected = level === 'entry' ? 'standard' : 'entry';
      let price = '123456';
      let resets = 0;
      let closes = 0;
      const dependencies = {
        level, basicSpecLevel: selected, selectedFamily: { basicCatalogue: catalogue },
        resolveCatalogueGuide, resolveBasicReplacementGuide, basicReplacementBands: [],
        basicReplacementVatMode: mode,
        getVatDisplayValue: (value, vat) => value * (vat === 'incl' ? 1.15 : 1),
        setBasicSpecLevel: (value) => { selected = value; },
        setBasicReplacementPrice: (value) => { price = value; },
        setMessage: () => {}, resetResult: () => { resets++; },
        specificationDialogRef: { current: { close: () => { closes++; } } },
      };
      const run = () => new Function(...Object.keys(dependencies), body)(...Object.values(dependencies));
      run();
      const guide = resolveCatalogueGuide(catalogue, selected);
      const index = ['entry', 'standard', 'premium'].indexOf(level);
      assert.equal(guide.minExVat, 100000 + index * 300000);
      assert.equal(guide.maxExVat, 400000 + index * 300000);
      assert.equal(price, String(Math.round(guide.suggestedExVat * (mode === 'incl' ? 1.15 : 1))));
      assert.equal(selected, level);
      assert.equal(resets, 1);
      assert.equal(closes, 1);
      dependencies.basicSpecLevel = level;
      price = '234567';
      run();
      assert.equal(price, '234567', 'reselecting the current tier preserves a manual price');
      assert.equal(resets, 1);
      assert.equal(closes, 2);
    }
  }
});



import { REPLACEMENT_SLIDER_STEP, replacementSliderAmount, replacementSliderMaximum } from '../lib/replacement-slider.ts';

test('replacement slider uses clean R5,000 amounts and reachable upper limits in either VAT basis', () => {
  assert.equal(REPLACEMENT_SLIDER_STEP, 5000);
  for (const multiplier of [1, 1.15]) {
    for (const price of [0, 1234, 9999, 145678.91, 2300000, 9123456.78]) {
      const displayed = price * multiplier;
      const selected = replacementSliderAmount(displayed);
      const maximum = replacementSliderMaximum(displayed);
      assert.equal(selected % 5000, 0);
      assert.equal(maximum % 5000, 0);
      assert.ok(maximum >= displayed && maximum >= selected);
      assert.ok(Math.abs(selected - displayed) <= 2500);
      const nextExVat = (selected + REPLACEMENT_SLIDER_STEP) / multiplier;
      assert.ok(Math.abs(nextExVat * multiplier - selected - 5000) < 0.000001);
    }
  }
});
