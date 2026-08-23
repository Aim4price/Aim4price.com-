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
  assert.equal(result.score, 74);
  assert.equal(result.grade, 'B');
  assert.equal(result.naturalSellingWindow, '30–60 days');
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
  assert.equal(result.conditionScore, 85);
  assert.equal(result.popularityStars, 3);
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
  assert.equal(broad.conditionScore, 55);
  assert.ok(detailed.score > broad.score);
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

  assert.equal(general.score, 74);
  assert.equal(plan.marketScore, 72);
  assert.equal(plan.refinedScore, 73);
  assert.equal(plan.grade, 'B');
  assert.equal(plan.recommendedAskingPriceExVat, 290_000);
  assert.equal(plan.likelySellingRangeLowExVat, 275_000);
  assert.equal(plan.likelySellingRangeHighExVat, 285_000);
  assert.equal(valuationExVat, 300_300);
});

test('Saleability grade boundaries remain simple and predictable', () => {
  assert.equal(getSaleabilityBand(80).grade, 'A');
  assert.equal(getSaleabilityBand(65).grade, 'B');
  assert.equal(getSaleabilityBand(50).grade, 'C');
  assert.equal(getSaleabilityBand(35).grade, 'D');
  assert.equal(getSaleabilityBand(34).grade, 'E');
});
