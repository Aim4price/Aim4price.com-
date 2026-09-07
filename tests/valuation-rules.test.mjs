import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MAX_SALVAGE_PERCENT,
  calculateInstalledExtraValue,
  calculateOlderPassengerCarMarketability,
  calculateSalvagePercent,
  calculateSalvageValue,
  resolveSalvageValue,
} from '../lib/valuation/valuation-rules.ts';
import {
  applyPopularityToConditionFactor,
  calculateDealerConditionFactor,
  normalizeDealerAssessment,
} from '../lib/valuation/dealer-assessment.ts';

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `expected ${expected}, received ${actual}`);
}

function ageDepreciationPercent(yearModel, baseYear = 2026) {
  const age = Math.max(0, baseYear - yearModel);
  let depreciation = 0;
  if (age >= 1) depreciation += 20;
  if (age >= 2) depreciation += 15;
  if (age >= 3) depreciation += 10;
  if (age >= 4) depreciation += (age - 3) * 2.5;
  return Math.min(100, depreciation);
}

function simulatePassengerCarValue({
  replacementPrice,
  yearModel,
  kilometres,
  conditionFactor,
  bodyType,
}) {
  const marketability = calculateOlderPassengerCarMarketability({
    sectorKey: 'motor',
    familyKey: 'cars_suvs',
    bodyType,
    yearModel,
    baseYear: 2026,
  });
  const ageDepreciation = ageDepreciationPercent(yearModel);
  const usageDepreciation = Math.min(100, (kilometres / 300_000) * 100);
  const averageDepreciation = Math.round((ageDepreciation + usageDepreciation) / 2);
  const rawValue = replacementPrice
    * (1 - averageDepreciation / 100)
    * conditionFactor
    * marketability.factor;
  return {
    value: resolveSalvageValue(rawValue, replacementPrice).finalValueExVat,
    marketability,
  };
}

test('R800,000 uses the agreed 2.25% / R18,000 salvage reference', () => {
  assert.equal(calculateSalvagePercent(800_000), 2.25);
  assert.equal(calculateSalvageValue(800_000), 18_000);
});
test('salvage percentage never exceeds 3% and salvage value never falls at a price boundary', () => {
  let previousValue = 0;
  for (let replacementPrice = 0; replacementPrice <= 12_000_000; replacementPrice += 10_000) {
    const percent = calculateSalvagePercent(replacementPrice);
    const value = calculateSalvageValue(replacementPrice);
    assert.ok(percent <= MAX_SALVAGE_PERCENT);
    assert.ok(percent >= 0);
    assert.ok(value >= previousValue, `salvage fell at ${replacementPrice.toLocaleString('en-ZA')}`);
    previousValue = value;
  }
});

test('depreciation only switches to salvage when the calculated value reaches the reference', () => {
  assert.deepEqual(resolveSalvageValue(0, 800_000), {
    rawValueExVat: 0,
    finalValueExVat: 18_000,
    salvagePercent: 2.25,
    salvageValueExVat: 18_000,
    isSalvageEstimate: true,
  });
  assert.equal(resolveSalvageValue(50_000, 800_000).finalValueExVat, 50_000);
  assert.equal(resolveSalvageValue(50_000, 800_000).isSalvageEstimate, false);
});

test('front loaders depreciate from their own year with a legacy tractor-year fallback', () => {
  const currentYear = new Date().getFullYear();
  const calculateLoader = (yearAdded) => calculateInstalledExtraValue({
    replacementPriceExVat: 225_000,
    yearAdded,
    fallbackYear: 2012,
    baseYear: currentYear,
    annualDepreciationPercent: 10,
  });
  const recentLoader = calculateLoader(currentYear - 2);
  const legacyFallback = calculateLoader(null);

  assert.equal(recentLoader, 180_000);
  assert.ok(recentLoader > legacyFallback);
  assert.equal(calculateLoader('not-a-year'), legacyFallback);
  assert.equal(calculateLoader(currentYear), 225_000);
});

test('the 2001 BMW example lands close to R50,000 from an R800,000 replacement price', () => {
  const scenario = simulatePassengerCarValue({
    replacementPrice: 800_000,
    yearModel: 2001,
    kilometres: 220_000,
    conditionFactor: 0.85,
    bodyType: 'sedan',
  });

  assert.equal(scenario.marketability.applies, true);
  assert.equal(scenario.marketability.yearsAfterThreshold, 10);
  assert.ok(scenario.value >= 49_000 && scenario.value <= 51_000, `received R${scenario.value}`);
});

test('passenger-car scenarios remain sensible around the 15-year marketability threshold', () => {
  const recentSedan = simulatePassengerCarValue({
    replacementPrice: 500_000,
    yearModel: 2018,
    kilometres: 150_000,
    conditionFactor: 0.85,
    bodyType: 'sedan',
  });
  const olderSedan = simulatePassengerCarValue({
    replacementPrice: 500_000,
    yearModel: 2010,
    kilometres: 180_000,
    conditionFactor: 0.85,
    bodyType: 'sedan',
  });
  const olderSuv = simulatePassengerCarValue({
    replacementPrice: 500_000,
    yearModel: 2010,
    kilometres: 180_000,
    conditionFactor: 0.85,
    bodyType: 'suv',
  });

  assert.equal(recentSedan.marketability.applies, false);
  assert.equal(recentSedan.value, 195_500);
  assert.equal(olderSedan.marketability.applies, true);
  assert.ok(olderSedan.value >= 124_000 && olderSedan.value <= 125_000);
  assert.equal(olderSuv.marketability.applies, false);
  assert.equal(olderSuv.value, 131_750);
});

test('fully depreciated assets use the sliding salvage scale across price ranges', () => {
  const scenarios = [
    { replacementPrice: 100_000, expectedPercent: 3, expectedValue: 3_000 },
    { replacementPrice: 250_000, expectedPercent: 2.85, expectedValue: 7_125 },
    { replacementPrice: 800_000, expectedPercent: 2.25, expectedValue: 18_000 },
    { replacementPrice: 2_000_000, expectedPercent: 1.7, expectedValue: 34_000 },
    { replacementPrice: 5_000_000, expectedPercent: 1.25, expectedValue: 62_500 },
    { replacementPrice: 10_000_000, expectedPercent: 1, expectedValue: 100_000 },
  ];

  for (const scenario of scenarios) {
    const result = resolveSalvageValue(0, scenario.replacementPrice);
    assert.equal(result.salvagePercent, scenario.expectedPercent);
    assert.equal(result.finalValueExVat, scenario.expectedValue);
    assert.equal(result.isSalvageEstimate, true);
  }
});

test('older-car marketability excludes SUVs and specialist body styles', () => {
  for (const bodyType of ['suv', 'coupe', 'cabriolet', 'sportback']) {
    const result = calculateOlderPassengerCarMarketability({
      sectorKey: 'motor',
      familyKey: 'cars_suvs',
      bodyType,
      yearModel: 2001,
      baseYear: 2026,
    });
    assert.equal(result.applies, false, bodyType);
    assert.equal(result.factor, 1, bodyType);
  }
});

test('a normal detailed assessment uses the stronger Good condition factor', () => {
  const assessment = normalizeDealerAssessment({
    mechanicalCondition: 'good',
    bodyCondition: 'good',
    tyreCondition: '50_75',
    serviceHistory: 'partial',
    requiredWork: 'minor',
  });
  assert.equal(assessment?.conditionFactorPercent, 90);
});

test('detailed physical-condition outcomes use the full controlled 20%-100% range', () => {
  const excellent = calculateDealerConditionFactor({
    mechanicalCondition: 'excellent',
    bodyCondition: 'excellent',
    tyreCondition: '75_100',
    serviceHistory: 'complete_verified',
    requiredWork: 'ready',
  });
  const poor = calculateDealerConditionFactor({
    mechanicalCondition: 'poor',
    bodyCondition: 'damaged',
    tyreCondition: 'replacement_required',
    serviceHistory: 'none',
    requiredWork: 'major',
  });
  assert.equal(excellent, 1);
  assert.equal(poor, 0.2);
});

test('detailed assessments produce an ordered physical range without assuming a gearbox', () => {
  const ready = calculateDealerConditionFactor({
    mechanicalCondition: 'excellent',
    bodyCondition: 'good',
    tyreCondition: '75_100',
    serviceHistory: 'complete_verified',
    requiredWork: 'ready',
  });
  const working = calculateDealerConditionFactor({
    mechanicalCondition: 'average',
    bodyCondition: 'average',
    tyreCondition: '25_50',
    serviceHistory: 'owner_recorded',
    requiredWork: 'moderate',
  });
  const project = calculateDealerConditionFactor({
    mechanicalCondition: 'poor',
    bodyCondition: 'damaged',
    tyreCondition: 'replacement_required',
    serviceHistory: 'none',
    requiredWork: 'major',
  });

  assert.ok(Math.abs(ready - 0.99) < Number.EPSILON * 2);
  assertClose(working, 0.64);
  assert.equal(project, 0.2);
  assert.ok(ready > working && working > project);
});

test('popularity is proportional while standard factors stay at or below baseline', () => {
  assertClose(applyPopularityToConditionFactor(0.9, 1), 0.63);
  assertClose(applyPopularityToConditionFactor(0.9, 2), 0.765);
  assertClose(applyPopularityToConditionFactor(0.9, 3), 0.9);
  assertClose(applyPopularityToConditionFactor(0.9, 4), 0.972);
  assertClose(applyPopularityToConditionFactor(0.9, 5), 1);
  assertClose(applyPopularityToConditionFactor(1, 3), 1);
  assertClose(applyPopularityToConditionFactor(1, 5), 1);
  assertClose(applyPopularityToConditionFactor(0.99, 5), 1);
  assertClose(applyPopularityToConditionFactor(0.2, 1), 0.14);
  assertClose(applyPopularityToConditionFactor(0.2, 5), 0.23);
});

test('required work is deliberately limited to avoid deducting the same physical fault twice', () => {
  const averageMinor = calculateDealerConditionFactor({
    mechanicalCondition: 'average',
    bodyCondition: 'average',
    tyreCondition: '25_50',
    serviceHistory: 'partial',
    requiredWork: 'minor',
  });
  const averageModerate = calculateDealerConditionFactor({
    mechanicalCondition: 'average',
    bodyCondition: 'average',
    tyreCondition: '25_50',
    serviceHistory: 'partial',
    requiredWork: 'moderate',
  });
  const averageMajor = calculateDealerConditionFactor({
    mechanicalCondition: 'average',
    bodyCondition: 'average',
    tyreCondition: '25_50',
    serviceHistory: 'partial',
    requiredWork: 'major',
  });

  assert.equal(averageMinor, 0.7);
  assertClose(averageModerate, 0.66);
  assert.equal(averageMajor, 0.58);
});

test('detailed assessment price outcomes remain proportionate on a R200,000 pre-condition value', () => {
  const readyPhysical = calculateDealerConditionFactor({
    mechanicalCondition: 'excellent',
    bodyCondition: 'good',
    tyreCondition: '75_100',
    serviceHistory: 'complete_verified',
    requiredWork: 'ready',
  });
  const workingPhysical = calculateDealerConditionFactor({
    mechanicalCondition: 'average',
    bodyCondition: 'average',
    tyreCondition: '25_50',
    serviceHistory: 'owner_recorded',
    requiredWork: 'moderate',
  });
  const projectPhysical = calculateDealerConditionFactor({
    mechanicalCondition: 'poor',
    bodyCondition: 'damaged',
    tyreCondition: 'replacement_required',
    serviceHistory: 'none',
    requiredWork: 'major',
  });

  assert.equal(Math.round(200_000 * applyPopularityToConditionFactor(readyPhysical, 5)), 200_000);
  assert.equal(Math.round(200_000 * applyPopularityToConditionFactor(0.9, 3)), 180_000);
  assert.equal(Math.round(200_000 * applyPopularityToConditionFactor(workingPhysical, 2)), 108_800);
  assert.equal(Math.round(200_000 * applyPopularityToConditionFactor(projectPhysical, 1)), 28_000);
});

test('broad condition uses the stronger scale and custom condition stays popularity-sensitive', async () => {
  const sharedSource = await readFile(new URL('../lib/valuation/shared.ts', import.meta.url), 'utf8');

  assert.match(sharedSource, /excellent:\s*1,[\s\S]*good:\s*0\.9,[\s\S]*fair:\s*0\.7,[\s\S]*used:\s*0\.45,[\s\S]*serious:\s*0\.25,/);
  assert.doesNotMatch(
    sharedSource,
    /customConditionPercent[\s\S]*ADVANCED_CONDITION_FACTOR_MIN_PERCENT \/ 100,[\s\S]*ADVANCED_CONDITION_FACTOR_MAX_PERCENT \/ 100/,
  );
});

test('stronger condition and popularity deductions still respect the salvage floor', () => {
  const result = resolveSalvageValue(80_000 * 0.14, 800_000);

  assert.equal(result.rawValueExVat, 11_200);
  assert.equal(result.salvageValueExVat, 18_000);
  assert.equal(result.finalValueExVat, 18_000);
  assert.equal(result.isSalvageEstimate, true);
});

test('selected tractor extras always add a calculated value and are shown transparently', async () => {
  const tractorSource = await readFile(new URL('../lib/valuation/tractors.ts', import.meta.url), 'utf8');
  const serverSource = await readFile(new URL('../lib/server-valuation.ts', import.meta.url), 'utf8');
  const valuationSource = await readFile(new URL('../app/valuation/valuation-client.tsx', import.meta.url), 'utf8');
  const runsSource = await readFile(new URL('../lib/valuation-runs.ts', import.meta.url), 'utf8');
  const revaluationSource = await readFile(new URL('../lib/asset-register-revaluation.ts', import.meta.url), 'utf8');
  const projectionSource = await readFile(new URL('../lib/asset-register-projection.ts', import.meta.url), 'utf8');
  const tractorRouteSource = await readFile(new URL('../app/api/tractor-valuations/route.ts', import.meta.url), 'utf8');
  const valuationRunsRouteSource = await readFile(new URL('../app/api/valuation-runs/route.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(tractorSource, /!model\.(frontPtoSupported|frontLoaderSupported|gpsSupported)/);
  assert.match(tractorSource, /replacementPriceOverrideExVat/);
  assert.match(serverSource, /combinedBaseCalculation/);
  assert.match(serverSource, /combinedBaseCalculation\.finalValueExVat - baseAim4priceValueExVat/);
  assert.match(serverSource, /otherExtraReplacementPriceExVat/);
  assert.doesNotMatch(valuationSource, /Tractor extras value breakdown/);
  assert.match(valuationSource, /<strong>Extra&apos;s<\/strong>/);
  assert.match(valuationSource, /Add another extra/);
  assert.match(valuationSource, /Replacement price \(excl\. VAT\)/);
  assert.match(valuationSource, /Front PTO replacement/);
  assert.match(valuationSource, /frontLoaderValueExVat/);
  assert.match(valuationSource, /gpsValueExVat/);
  assert.match(valuationSource, /Front Loader year added/);
  assert.match(serverSource, /input\.frontLoaderYear/);
  assert.match(runsSource, /frontLoaderYear: input\.frontLoader \? parseExtraYear/);
  assert.match(tractorRouteSource, /frontLoaderYear/);
  assert.match(valuationRunsRouteSource, /frontLoaderYear/);
  assert.match(revaluationSource, /payloadInput\.frontLoaderYear/);
  assert.match(projectionSource, /input\.frontLoaderYear/);
  assert.match(projectionSource, /frontLoaderReplacementPriceExVat/);
  assert.doesNotMatch(valuationSource, /This is depreciated with the tractor before being added to the estimate/);
});

test('path availability is checked with one model before the full list is requested', async () => {
  const source = await readFile(new URL('../app/valuation/valuation-client.tsx', import.meta.url), 'utf8');
  assert.match(source, /limit: '1'/);
  assert.match(source, /const pathOptionsLoading/);
  assert.match(source, /Preparing estimate paths/);
  assert.match(source, /pathLoadingSpinner/);
  assert.match(source, /loadFullGenericCatalog/);
  assert.match(source, /limit: '500'/);
  assert.match(source, /Ready for your estimate\?/);
  assert.match(source, /I understand, get estimate/);
  assert.match(source, /indicative estimate only\. It is not a certified valuation/);
  assert.doesNotMatch(source, /Check the replacement price and usage/);
  assert.doesNotMatch(source, /Important: check both values/);
  assert.doesNotMatch(source, /replacementNoticePriceExVat|replacementNoticeUsage|Current usage/);
  assert.match(source, /replacementNoticeGoBackRef\.current\?\.focus\(\)/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /aria-describedby="replacement-notice-description replacement-notice-disclaimer"/);
  assert.match(source, /Add detailed condition/);
  assert.match(source, /<h3 className=\{styles\.currentTitle\}>Popularity<\/h3>/);
  assert.match(source, /<span className=\{styles\.currentEyebrow\}>Step 4<\/span>/);
});

test('detailed condition and popularity are standard inputs rather than dealer-only controls', async () => {
  const valuationSource = await readFile(new URL('../app/valuation/valuation-client.tsx', import.meta.url), 'utf8');
  const genericRoute = await readFile(new URL('../app/api/generic-valuations/route.ts', import.meta.url), 'utf8');
  const tractorRoute = await readFile(new URL('../app/api/tractor-valuations/route.ts', import.meta.url), 'utf8');

  assert.match(valuationSource, /Detailed Asset Assessment/);
  assert.doesNotMatch(valuationSource, /Dealer condition assessment/);
  assert.match(genericRoute, /advancedAssumptionsRequireActiveAccess/);
  assert.match(tractorRoute, /advancedAssumptionsRequireActiveAccess/);
  assert.doesNotMatch(genericRoute, /accountType !== 'dealer'/);
  assert.doesNotMatch(tractorRoute, /accountType !== 'dealer'/);
});

test('detailed assessment and extras keep a clear left-aligned hierarchy', async () => {
  const valuationSource = await readFile(new URL('../app/valuation/valuation-client.tsx', import.meta.url), 'utf8');
  const valuationStyles = await readFile(new URL('../app/valuation/page.module.css', import.meta.url), 'utf8');

  assert.match(valuationStyles, /\.detailedAssessmentHeader\s*\{[^}]*justify-items:\s*start;[^}]*text-align:\s*left;/s);
  assert.match(valuationStyles, /\.dealerAssessmentGroup legend\s*\{[^}]*text-align:\s*left;/s);
  assert.match(valuationStyles, /\.dealerAssessmentGroup \+ \.dealerAssessmentGroup\s*\{[^}]*margin-top:/s);
  assert.match(valuationStyles, /\.otherExtraCardNote\s*\{[^}]*white-space:\s*nowrap;/s);
  assert.match(valuationStyles, /\.replacementField\s*\{[^}]*grid-template-rows:/s);
  assert.match(valuationStyles, /\.replacementOtherFields\s*\{[^}]*grid-column:\s*1 \/ -1;/s);
  assert.match(valuationStyles, /\.replacementNoticeModal\s*\{[^}]*width:\s*min\(680px,\s*var\(--website-dialog-reference-width, 100%\)\)[^}]*background:\s*#fff4f2;/s);
  assert.match(valuationStyles, /\.replacementNoticeActions \.primaryButton\s*\{[^}]*background:\s*#b92f28;/s);
  assert.doesNotMatch(valuationStyles, /\.replacementNoticeModal \.replacementNoticeIntro\s*\{[^}]*max-width:/s);
  assert.doesNotMatch(valuationStyles, /\.replacementNoticeWarning\s*\{/);
  assert.doesNotMatch(valuationSource, /aria-label="Tractor extras value breakdown"/);
  assert.doesNotMatch(valuationSource, /Condition is controlled by the Detailed Asset Assessment/);
});

test('valuation flow supports accessible back-step navigation and concise actions', async () => {
  const valuationSource = await readFile(new URL('../app/valuation/valuation-client.tsx', import.meta.url), 'utf8');
  const valuationStyles = await readFile(new URL('../app/valuation/page.module.css', import.meta.url), 'utf8');

  assert.match(valuationSource, /function handleWizardStepJump\(targetStep: Step\)/);
  assert.match(valuationSource, /onClick=\{\(\) => handleWizardStepJump\(item\.step\)\}/);
  assert.match(valuationSource, /disabled=\{!canJumpBack\}/);
  assert.match(valuationSource, /aria-current=\{active \? 'step' : undefined\}/);
  assert.doesNotMatch(valuationSource, /Use this year|Save answer|Live now|Open estimate flow/);
  assert.match(valuationStyles, /font-family: var\(--font-body, 'Montserrat'\)/);
  assert.match(valuationStyles, /\.stepperItemClickable/);
  assert.match(valuationStyles, /August 2026 — valuation experience polish/);
});

