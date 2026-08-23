export type SaleabilityGrade = 'A' | 'B' | 'C' | 'D' | 'E';
export type SaleabilityConfidence = 'High' | 'Medium' | 'Low';

export type GeneralSaleabilityInput = {
  lifeRemainingPercent?: number | null;
  usageAmount?: number | null;
  maxLifetimeUsage?: number | null;
  lifeWorkedPercent?: number | null;
  condition?: string | null;
  conditionFactorPercent?: number | null;
  popularityStars?: number | null;
};

export type SaleabilityComponent = {
  score: number;
  weight: number;
  contribution: number;
};

export type GeneralSaleabilityResult = {
  score: number;
  grade: SaleabilityGrade;
  gradeLabel: string;
  naturalSellingWindow: string;
  confidence: SaleabilityConfidence;
  lifeRemainingPercent: number;
  conditionScore: number;
  popularityStars: number;
  components: {
    popularity: SaleabilityComponent;
    usefulLife: SaleabilityComponent;
    condition: SaleabilityComponent;
  };
  reasons: string[];
};

export type SaleArea = 'local' | 'province' | 'south_africa';
export type SimilarAssetsAvailable = 'none' | 'one_to_three' | 'four_to_ten' | 'more_than_ten' | 'unknown';
export type RealisticBuyerPool = 'many' | 'moderate' | 'few' | 'specialist' | 'unknown';
export type CurrentDemand = 'strong' | 'normal' | 'weak' | 'unknown';
export type ModelFamiliarity = 'common' | 'less_common' | 'rare' | 'unknown';
export type DesiredSellingTimeline = '14' | '30' | '60' | '90' | 'flexible';
export type SellingPriority = 'best_price' | 'balanced' | 'fast_cashflow';

export type SaleabilityRefinementAnswers = {
  saleArea: SaleArea;
  similarAssetsAvailable: SimilarAssetsAvailable;
  realisticBuyerPool: RealisticBuyerPool;
  currentDemand: CurrentDemand;
  modelFamiliarity: ModelFamiliarity;
  desiredTimeline: DesiredSellingTimeline;
  sellingPriority: SellingPriority;
};

export type SaleabilityPlan = {
  general: GeneralSaleabilityResult;
  refinedScore: number;
  grade: SaleabilityGrade;
  gradeLabel: string;
  naturalSellingWindow: string;
  marketScore: number;
  recommendedAskingPriceExVat: number;
  likelySellingRangeLowExVat: number;
  likelySellingRangeHighExVat: number;
  expectedTimelineWithPlan: string;
  priceDifferenceFromValuationExVat: number;
  note: string;
};

export const GENERAL_SALEABILITY_WEIGHTS = {
  popularity: 0.40,
  usefulLife: 0.35,
  condition: 0.25,
} as const;

const CONDITION_SCORES: Record<string, number> = {
  excellent: 95,
  good: 85,
  fair: 75,
  used: 65,
  serious: 55,
};

const MARKET_SCORES = {
  saleArea: { local: 55, province: 75, south_africa: 100 },
  similarAssetsAvailable: { none: 100, one_to_three: 80, four_to_ten: 60, more_than_ten: 30, unknown: 50 },
  realisticBuyerPool: { many: 95, moderate: 65, few: 35, specialist: 20, unknown: 50 },
  currentDemand: { strong: 95, normal: 65, weak: 30, unknown: 50 },
  modelFamiliarity: { common: 95, less_common: 60, rare: 30, unknown: 50 },
} as const;

const MARKET_WEIGHTS = {
  saleArea: 0.10,
  similarAssetsAvailable: 0.20,
  realisticBuyerPool: 0.30,
  currentDemand: 0.25,
  modelFamiliarity: 0.15,
} as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function rounded(value: number): number {
  return Math.round(value);
}

function component(score: number, weight: number): SaleabilityComponent {
  return {
    score: rounded(score),
    weight,
    contribution: Math.round(score * weight * 10) / 10,
  };
}

export function resolveLifeRemainingPercent(input: GeneralSaleabilityInput): number | null {
  const explicit = finiteNumber(input.lifeRemainingPercent);
  if (explicit !== null) return clamp(explicit);

  const worked = finiteNumber(input.lifeWorkedPercent);
  if (worked !== null) return clamp(100 - worked);

  const usage = finiteNumber(input.usageAmount);
  const lifetime = finiteNumber(input.maxLifetimeUsage);
  if (usage !== null && lifetime !== null && lifetime > 0) {
    return clamp(100 - (Math.max(0, usage) / lifetime) * 100);
  }

  return null;
}

export function getSaleabilityBand(scoreInput: number): Pick<GeneralSaleabilityResult, 'grade' | 'gradeLabel' | 'naturalSellingWindow'> {
  const score = clamp(scoreInput);
  if (score >= 80) return { grade: 'A', gradeLabel: 'Strong', naturalSellingWindow: '0–30 days' };
  if (score >= 65) return { grade: 'B', gradeLabel: 'Good', naturalSellingWindow: '30–60 days' };
  if (score >= 50) return { grade: 'C', gradeLabel: 'Moderate', naturalSellingWindow: '60–120 days' };
  if (score >= 35) return { grade: 'D', gradeLabel: 'Limited', naturalSellingWindow: '120–180 days' };
  return { grade: 'E', gradeLabel: 'Specialist', naturalSellingWindow: '180+ days / specialist buyer' };
}

export function calculateGeneralSaleability(input: GeneralSaleabilityInput): GeneralSaleabilityResult {
  const resolvedLifeRemaining = resolveLifeRemainingPercent(input);
  const lifeRemainingPercent = resolvedLifeRemaining ?? 50;
  const detailedCondition = finiteNumber(input.conditionFactorPercent);
  const normalizedCondition = String(input.condition ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const conditionScore = detailedCondition === null
    ? CONDITION_SCORES[normalizedCondition] ?? 75
    : clamp(detailedCondition);
  const suppliedPopularity = finiteNumber(input.popularityStars);
  const popularityStars = suppliedPopularity === null ? 3 : clamp(Math.round(suppliedPopularity), 1, 5);
  const popularityScore = popularityStars * 20;

  const components = {
    popularity: component(popularityScore, GENERAL_SALEABILITY_WEIGHTS.popularity),
    usefulLife: component(lifeRemainingPercent, GENERAL_SALEABILITY_WEIGHTS.usefulLife),
    condition: component(conditionScore, GENERAL_SALEABILITY_WEIGHTS.condition),
  };
  const score = rounded(
    popularityScore * GENERAL_SALEABILITY_WEIGHTS.popularity
      + lifeRemainingPercent * GENERAL_SALEABILITY_WEIGHTS.usefulLife
      + conditionScore * GENERAL_SALEABILITY_WEIGHTS.condition,
  );
  const band = getSaleabilityBand(score);
  const knownInputs = [resolvedLifeRemaining !== null, Boolean(normalizedCondition) || detailedCondition !== null, suppliedPopularity !== null]
    .filter(Boolean).length;
  const confidence: SaleabilityConfidence = knownInputs === 3 && detailedCondition !== null
    ? 'High'
    : knownInputs >= 2
      ? 'Medium'
      : 'Low';

  return {
    score,
    ...band,
    confidence,
    lifeRemainingPercent: rounded(lifeRemainingPercent),
    conditionScore: rounded(conditionScore),
    popularityStars,
    components,
    reasons: [
      `${rounded(lifeRemainingPercent)}% useful life remains`,
      `condition scores ${rounded(conditionScore)} / 100`,
      `popularity is ${popularityStars} / 5 stars`,
    ],
  };
}

function roundSellingPrice(value: number): number {
  const absolute = Math.abs(value);
  const increment = absolute >= 100_000 ? 5_000 : absolute >= 10_000 ? 1_000 : 100;
  return Math.max(0, Math.round(value / increment) * increment);
}

function desiredTimelineLabel(timeline: DesiredSellingTimeline, fallback: string): string {
  if (timeline === '14') return 'About 14–30 days';
  if (timeline === '30') return 'About 30–45 days';
  if (timeline === '60') return 'About 45–75 days';
  if (timeline === '90') return 'About 60–120 days';
  return fallback;
}

export function calculateRefinedSaleability(
  general: GeneralSaleabilityResult,
  answers: SaleabilityRefinementAnswers,
  valuationExVat: number,
): SaleabilityPlan {
  const marketScore = rounded(
    MARKET_SCORES.saleArea[answers.saleArea] * MARKET_WEIGHTS.saleArea
      + MARKET_SCORES.similarAssetsAvailable[answers.similarAssetsAvailable] * MARKET_WEIGHTS.similarAssetsAvailable
      + MARKET_SCORES.realisticBuyerPool[answers.realisticBuyerPool] * MARKET_WEIGHTS.realisticBuyerPool
      + MARKET_SCORES.currentDemand[answers.currentDemand] * MARKET_WEIGHTS.currentDemand
      + MARKET_SCORES.modelFamiliarity[answers.modelFamiliarity] * MARKET_WEIGHTS.modelFamiliarity,
  );
  const refinedScore = rounded(general.score * 0.60 + marketScore * 0.40);
  const band = getSaleabilityBand(refinedScore);

  const timelineAdjustment: Record<DesiredSellingTimeline, number> = {
    '14': -0.08,
    '30': -0.04,
    '60': 0,
    '90': 0.02,
    flexible: 0.04,
  };
  const priorityAdjustment: Record<SellingPriority, number> = {
    best_price: 0.03,
    balanced: 0,
    fast_cashflow: -0.05,
  };
  const scoreAdjustment = refinedScore >= 80 ? 0.01 : refinedScore >= 65 ? 0 : refinedScore >= 50 ? -0.03 : refinedScore >= 35 ? -0.06 : -0.10;
  const askingFactor = clamp(
    1 + timelineAdjustment[answers.desiredTimeline] + priorityAdjustment[answers.sellingPriority] + scoreAdjustment,
    0.75,
    1.07,
  );
  const safeValuation = Math.max(0, finiteNumber(valuationExVat) ?? 0);
  const recommendedAskingPriceExVat = roundSellingPrice(safeValuation * askingFactor);
  const likelySellingRangeLowExVat = roundSellingPrice(recommendedAskingPriceExVat * 0.95);
  const likelySellingRangeHighExVat = roundSellingPrice(recommendedAskingPriceExVat * 0.99);
  const specialistWarning = refinedScore < 35
    ? ' This asset may still need a specialist buyer, even with sharper pricing.'
    : '';

  return {
    general,
    refinedScore,
    ...band,
    marketScore,
    recommendedAskingPriceExVat,
    likelySellingRangeLowExVat,
    likelySellingRangeHighExVat,
    expectedTimelineWithPlan: desiredTimelineLabel(answers.desiredTimeline, band.naturalSellingWindow),
    priceDifferenceFromValuationExVat: recommendedAskingPriceExVat - safeValuation,
    note: `The Aim4price valuation remains ${roundSellingPrice(safeValuation).toLocaleString('en-ZA')} excl. VAT. This is a separate selling-price guide, not a new valuation.${specialistWarning}`,
  };
}
