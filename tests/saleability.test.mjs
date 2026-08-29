import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateGeneralSaleability,
  calculateRefinedSaleability,
  getSaleabilityBand,
  resolveLifeRemainingPercent,
} from '../lib/saleability.ts';

test('general Saleability uses popularity, useful life and condition only', () => {
  const result = calculateGeneralSaleability({
    usageAmount: 9_000,
    maxLifetimeUsage: 14_000,
    condition: 'fair',
    conditionFactorPercent: 86,
    popularityStars: 5,
  });

  assert.equal(result.lifeRemainingPercent, 36);
  assert.equal(result.conditionScore, 86);
  assert.equal(result.popularityStars, 5);
  assert.equal(result.score, 70);
  const totalInfluence = result.components.popularity.contribution
    + result.components.usefulLife.contribution
    + result.components.condition.contribution;
  assert.ok(Math.abs(totalInfluence - result.score) <= 0.2);
  assert.equal(result.grade, 'B');
  assert.equal(result.naturalSellingWindow, '30–90 days');
  assert.equal(result.confidence, 'High');
});

test('percentage-based equipment uses its remaining useful-life percentage', () => {
  assert.equal(resolveLifeRemainingPercent({ lifeWorkedPercent: 62 }), 38);

  const result = calculateGeneralSaleability({
    lifeWorkedPercent: 62,
    condition: 'good',
    popularityStars: 4,
  });

  assert.equal(result.lifeRemainingPercent, 38);
  assert.equal(result.components.usefulLife.score, 38);
});

test('empty optional fields fall back to the available usage and broad condition data', () => {
  const result = calculateGeneralSaleability({
    lifeRemainingPercent: null,
    usageAmount: 9_000,
    maxLifetimeUsage: 14_000,
    condition: 'good',
    conditionFactorPercent: null,
    popularityStars: null,
  });

  assert.equal(result.lifeRemainingPercent, 36);
  assert.equal(result.conditionScore, 90);
  assert.equal(result.popularityStars, 3);
  assert.equal(result.components.popularity.score, 55);
});

test('detailed condition takes precedence over the broad condition label', () => {
  const detailed = calculateGeneralSaleability({
    lifeRemainingPercent: 50,
    condition: 'serious',
    conditionFactorPercent: 90,
    popularityStars: 3,
  });
  const broad = calculateGeneralSaleability({
    lifeRemainingPercent: 50,
    condition: 'serious',
    popularityStars: 3,
  });

  assert.equal(detailed.conditionScore, 90);
  assert.equal(broad.conditionScore, 25);
  assert.ok(detailed.score > broad.score);
});

test('popularity and condition create materially separated Saleability outcomes', () => {
  const unpopularGood = calculateGeneralSaleability({
    lifeRemainingPercent: 80,
    condition: 'good',
    popularityStars: 1,
  });
  const popularGood = calculateGeneralSaleability({
    lifeRemainingPercent: 80,
    condition: 'good',
    popularityStars: 5,
  });
  const popularSerious = calculateGeneralSaleability({
    lifeRemainingPercent: 80,
    condition: 'serious',
    popularityStars: 5,
  });

  assert.equal(unpopularGood.score, 21);
  assert.equal(unpopularGood.grade, 'E');
  assert.equal(popularGood.score, 91);
  assert.equal(popularGood.grade, 'A');
  assert.equal(popularSerious.score, 44);
  assert.equal(popularSerious.grade, 'D');
});

test('an exhausted or seriously conditioned asset cannot be averaged into a strong grade', () => {
  const exhausted = calculateGeneralSaleability({
    lifeRemainingPercent: 0,
    condition: 'excellent',
    popularityStars: 5,
  });
  const serious = calculateGeneralSaleability({
    lifeRemainingPercent: 100,
    condition: 'serious',
    popularityStars: 5,
  });

  assert.equal(exhausted.score, 0);
  assert.equal(exhausted.grade, 'E');
  assert.equal(serious.score, 45);
  assert.equal(serious.grade, 'D');
  assert.ok(serious.components.condition.contribution > serious.components.popularity.contribution);
});

test('near-zero useful life never creates a negative component influence', () => {
  const result = calculateGeneralSaleability({
    lifeRemainingPercent: 0.0101,
    condition: 'excellent',
    popularityStars: 5,
  });

  assert.equal(result.score, 0);
  for (const saleabilityComponent of Object.values(result.components)) {
    assert.ok(saleabilityComponent.contribution >= 0);
  }
});

test('the confirmed South Africa example refines Saleability without changing the valuation', () => {
  const valuationExVat = 300_300;
  const general = calculateGeneralSaleability({
    usageAmount: 9_000,
    maxLifetimeUsage: 14_000,
    conditionFactorPercent: 86,
    popularityStars: 5,
  });
  const plan = calculateRefinedSaleability(general, {
    saleArea: 'south_africa',
    similarAssetsAvailable: 'four_to_ten',
    realisticBuyerPool: 'moderate',
    currentDemand: 'normal',
    modelFamiliarity: 'common',
    desiredTimeline: '30',
    sellingPriority: 'balanced',
  }, valuationExVat);

  assert.equal(general.score, 70);
  assert.equal(plan.marketScore, 66);
  assert.equal(plan.refinedScore, 68);
  assert.equal(plan.grade, 'C');
  assert.equal(plan.recommendedAskingPriceExVat, 265_000);
  assert.equal(plan.likelySellingRangeLowExVat, 235_000);
  assert.equal(plan.likelySellingRangeHighExVat, 255_000);
  assert.equal(plan.expectedTimelineWithPlan, 'About 75–150 days');
  assert.equal(valuationExVat, 300_300);
});

test('a very weak market cannot be averaged into a healthy Saleability grade', () => {
  const perfectGeneral = calculateGeneralSaleability({
    lifeRemainingPercent: 100,
    condition: 'excellent',
    popularityStars: 5,
  });
  const plan = calculateRefinedSaleability(perfectGeneral, {
    saleArea: 'local',
    similarAssetsAvailable: 'more_than_ten',
    realisticBuyerPool: 'specialist',
    currentDemand: 'weak',
    modelFamiliarity: 'rare',
    desiredTimeline: '14',
    sellingPriority: 'fast_cashflow',
  }, 300_300);

  assert.equal(perfectGeneral.score, 100);
  assert.equal(plan.marketScore, 11);
  assert.equal(plan.refinedScore, 22);
  assert.equal(plan.grade, 'E');
  assert.equal(plan.expectedTimelineWithPlan, 'About 270–365+ days / specialist buyer');
});

test('different target-price plans produce distinct realistic selling windows', () => {
  const general = calculateGeneralSaleability({
    lifeRemainingPercent: 36,
    conditionFactorPercent: 86,
    popularityStars: 5,
  });
  const answers = {
    saleArea: 'south_africa',
    similarAssetsAvailable: 'four_to_ten',
    realisticBuyerPool: 'moderate',
    currentDemand: 'normal',
    modelFamiliarity: 'common',
    sellingPriority: 'balanced',
  };
  const fourteenDayPlan = calculateRefinedSaleability(general, {
    ...answers,
    desiredTimeline: '14',
  }, 300_300);
  const thirtyDayPlan = calculateRefinedSaleability(general, {
    ...answers,
    desiredTimeline: '30',
  }, 300_300);

  assert.equal(fourteenDayPlan.expectedTimelineWithPlan, 'About 60–120 days');
  assert.equal(thirtyDayPlan.expectedTimelineWithPlan, 'About 75–150 days');
  assert.ok(fourteenDayPlan.recommendedAskingPriceExVat < thirtyDayPlan.recommendedAskingPriceExVat);
});

test('priority shifts use the same price adjustment as their displayed window', () => {
  const general = calculateGeneralSaleability({
    lifeRemainingPercent: 80,
    condition: 'good',
    popularityStars: 4,
  });
  const answers = {
    saleArea: 'province',
    similarAssetsAvailable: 'one_to_three',
    realisticBuyerPool: 'many',
    currentDemand: 'strong',
    modelFamiliarity: 'common',
  };
  const balancedFourteen = calculateRefinedSaleability(general, {
    ...answers,
    desiredTimeline: '14',
    sellingPriority: 'balanced',
  }, 300_000);
  const fastThirty = calculateRefinedSaleability(general, {
    ...answers,
    desiredTimeline: '30',
    sellingPriority: 'fast_cashflow',
  }, 300_000);

  assert.equal(fastThirty.expectedTimelineWithPlan, balancedFourteen.expectedTimelineWithPlan);
  assert.equal(fastThirty.recommendedAskingPriceExVat, balancedFourteen.recommendedAskingPriceExVat);
});

test('selling price does not deduct saved condition and popularity a second time', () => {
  const answers = {
    saleArea: 'province',
    similarAssetsAvailable: 'four_to_ten',
    realisticBuyerPool: 'moderate',
    currentDemand: 'normal',
    modelFamiliarity: 'less_common',
    desiredTimeline: '60',
    sellingPriority: 'balanced',
  };
  const difficultAsset = calculateGeneralSaleability({
    lifeRemainingPercent: 20,
    condition: 'serious',
    popularityStars: 1,
  });
  const strongAsset = calculateGeneralSaleability({
    lifeRemainingPercent: 90,
    condition: 'excellent',
    popularityStars: 5,
  });

  const difficultPlan = calculateRefinedSaleability(difficultAsset, answers, 300_000);
  const strongPlan = calculateRefinedSaleability(strongAsset, answers, 300_000);

  assert.notEqual(difficultPlan.refinedScore, strongPlan.refinedScore);
  assert.equal(difficultPlan.marketScore, strongPlan.marketScore);
  assert.equal(difficultPlan.recommendedAskingPriceExVat, strongPlan.recommendedAskingPriceExVat);
});

test('Saleability grade boundaries remain simple and predictable', () => {
  assert.equal(getSaleabilityBand(85).grade, 'A');
  assert.equal(getSaleabilityBand(84).grade, 'B');
  assert.equal(getSaleabilityBand(70).grade, 'B');
  assert.equal(getSaleabilityBand(69).grade, 'C');
  assert.equal(getSaleabilityBand(50).grade, 'C');
  assert.equal(getSaleabilityBand(49).grade, 'D');
  assert.equal(getSaleabilityBand(30).grade, 'D');
  assert.equal(getSaleabilityBand(29).grade, 'E');
});
