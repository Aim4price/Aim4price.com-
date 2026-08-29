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
  /** Harmonic influence on the final score; weaker inputs have more influence. */
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
  usefulLife: 0.20,
  condition: 0.40,
} as const;

const CONDITION_SCORES: Record<string, number> = {
  excellent: 100,
  good: 90,
  fair: 70,
  used: 45,
  serious: 25,
};

const POPULARITY_SCORES: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 10,
  2: 30,
  3: 55,
  4: 75,
  5: 100,
};

const MARKET_SCORES = {
  saleArea: { local: 35, province: 65, south_africa: 100 },
  similarAssetsAvailable: { none: 100, one_to_three: 75, four_to_ten: 45, more_than_ten: 10, unknown: 45 },
  realisticBuyerPool: { many: 100, moderate: 60, few: 25, specialist: 5, unknown: 45 },
  currentDemand: { strong: 100, normal: 55, weak: 10, unknown: 45 },
  modelFamiliarity: { common: 100, less_common: 55, rare: 10, unknown: 45 },
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

function component(score: number, weight: number, contribution: number): SaleabilityComponent {
  return {
    score: rounded(score),
    weight,
    contribution,
  };
}

function weightedHarmonicScore(values: ReadonlyArray<{ score: number; weight: number }>): number {
  if (values.some(({ score }) => score <= 0)) return 0;
  return 1 / values.reduce((denominator, value) => denominator + value.weight / value.score, 0);
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
  if (score >= 85) return { grade: 'A', gradeLabel: 'Very strong', naturalSellingWindow: '0–30 days' };
  if (score >= 70) return { grade: 'B', gradeLabel: 'Strong', naturalSellingWindow: '30–90 days' };
  if (score >= 50) return { grade: 'C', gradeLabel: 'Moderate', naturalSellingWindow: '90–180 days' };
  if (score >= 30) return { grade: 'D', gradeLabel: 'Difficult', naturalSellingWindow: '180–365 days' };
  return { grade: 'E', gradeLabel: 'Very difficult', naturalSellingWindow: '365+ days / specialist buyer' };
}

export function calculateGeneralSaleability(input: GeneralSaleabilityInput): GeneralSaleabilityResult {
  const resolvedLifeRemaining = resolveLifeRemainingPercent(input);
  const lifeRemainingPercent = resolvedLifeRemaining ?? 50;
  const detailedCondition = finiteNumber(input.conditionFactorPercent);
  const normalizedCondition = String(input.condition ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const conditionScore = detailedCondition === null
    ? CONDITION_SCORES[normalizedCondition] ?? 50
    : clamp(detailedCondition);
  const suppliedPopularity = finiteNumber(input.popularityStars);
  const popularityStars = suppliedPopularity === null ? 3 : clamp(Math.round(suppliedPopularity), 1, 5);
  const popularityScore = POPULARITY_SCORES[popularityStars as 1 | 2 | 3 | 4 | 5];

  // Saleability is constrained by its weakest fundamental. A weighted
  // harmonic mean keeps an exhausted, badly conditioned or unpopular asset
  // from being averaged into a healthy grade by the other two inputs.
  const rawScore = weightedHarmonicScore([
    { score: popularityScore, weight: GENERAL_SALEABILITY_WEIGHTS.popularity },
    { score: lifeRemainingPercent, weight: GENERAL_SALEABILITY_WEIGHTS.usefulLife },
    { score: conditionScore, weight: GENERAL_SALEABILITY_WEIGHTS.condition },
  ]);
  const score = rounded(rawScore);
  const popularityContribution = score <= 0
    ? 0
    : Math.round(rawScore ** 2 * GENERAL_SALEABILITY_WEIGHTS.popularity / popularityScore * 10) / 10;
  const usefulLifeContribution = score <= 0
    ? 0
    : Math.round(rawScore ** 2 * GENERAL_SALEABILITY_WEIGHTS.usefulLife / lifeRemainingPercent * 10) / 10;
  const conditionContribution = score <= 0
    ? 0
    : Math.round(rawScore ** 2 * GENERAL_SALEABILITY_WEIGHTS.condition / conditionScore * 10) / 10;
  const components = {
    popularity: component(popularityScore, GENERAL_SALEABILITY_WEIGHTS.popularity, popularityContribution),
    usefulLife: component(lifeRemainingPercent, GENERAL_SALEABILITY_WEIGHTS.usefulLife, usefulLifeContribution),
    condition: component(conditionScore, GENERAL_SALEABILITY_WEIGHTS.condition, conditionContribution),
  };
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

const PLAN_TIMELINE_ORDER: readonly DesiredSellingTimeline[] = ['14', '30', '60', '90', 'flexible'];

function resolveEffectiveTimeline(
  timeline: DesiredSellingTimeline,
  priority: SellingPriority,
): DesiredSellingTimeline {
  const selectedIndex = PLAN_TIMELINE_ORDER.indexOf(timeline);
  const priorityShift = priority === 'fast_cashflow' ? -1 : priority === 'best_price' ? 1 : 0;
  return PLAN_TIMELINE_ORDER[clamp(selectedIndex + priorityShift, 0, PLAN_TIMELINE_ORDER.length - 1)];
}

function expectedTimelineWithPlan(
  grade: SaleabilityGrade,
  timeline: DesiredSellingTimeline,
  priority: SellingPriority,
): string {
  const effectiveTimeline = resolveEffectiveTimeline(timeline, priority);
  const windows: Record<SaleabilityGrade, Record<DesiredSellingTimeline, string>> = {
    A: {
      '14': 'About 14–30 days',
      '30': 'About 30–45 days',
      '60': 'About 45–75 days',
      '90': 'About 60–120 days',
      flexible: 'About 90–180 days',
    },
    B: {
      '14': 'About 30–60 days',
      '30': 'About 45–75 days',
      '60': 'About 60–90 days',
      '90': 'About 75–120 days',
      flexible: 'About 120–180 days',
    },
    C: {
      '14': 'About 60–120 days',
      '30': 'About 75–150 days',
      '60': 'About 90–180 days',
      '90': 'About 120–210 days',
      flexible: 'About 180–270 days',
    },
    D: {
      '14': 'About 120–240 days',
      '30': 'About 150–270 days',
      '60': 'About 180–300 days',
      '90': 'About 210–365 days',
      flexible: 'About 270–365+ days',
    },
    E: {
      '14': 'About 270–365+ days / specialist buyer',
      '30': 'About 300–420+ days / specialist buyer',
      '60': 'About 365–540+ days / specialist buyer',
      '90': 'About 450–630+ days / specialist buyer',
      flexible: 'About 540+ days / specialist buyer',
    },
  };

  return windows[grade][effectiveTimeline];
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
  // A weak market cannot be averaged away by strong asset fundamentals (or
  // vice versa). The harmonic mean makes the weaker side materially visible.
  const refinedScore = general.score <= 0 || marketScore <= 0
    ? 0
    : rounded(1 / (0.55 / general.score + 0.45 / marketScore));
  const band = getSaleabilityBand(refinedScore);

  const timelineAdjustment: Record<DesiredSellingTimeline, number> = {
    '14': -0.12,
    '30': -0.07,
    '60': -0.03,
    '90': 0,
    flexible: 0.03,
  };
  const effectiveTimeline = resolveEffectiveTimeline(answers.desiredTimeline, answers.sellingPriority);
  // The saved Aim4price valuation already reflects age, usage, condition and
  // popularity. Only the additional current-market answers adjust price here,
  // preventing the same asset factors from being deducted a second time.
  const marketAdjustment = marketScore >= 85 ? 0.02 : marketScore >= 70 ? 0 : marketScore >= 50 ? -0.05 : marketScore >= 30 ? -0.10 : -0.16;
  const askingFactor = clamp(
    1 + timelineAdjustment[effectiveTimeline] + marketAdjustment,
    0.65,
    1.05,
  );
  const safeValuation = Math.max(0, finiteNumber(valuationExVat) ?? 0);
  const recommendedAskingPriceExVat = roundSellingPrice(safeValuation * askingFactor);
  const sellingRangeFactors: Record<SaleabilityGrade, { low: number; high: number }> = {
    A: { low: 0.97, high: 1 },
    B: { low: 0.93, high: 0.99 },
    C: { low: 0.88, high: 0.97 },
    D: { low: 0.82, high: 0.95 },
    E: { low: 0.75, high: 0.92 },
  };
  const rangeFactors = sellingRangeFactors[band.grade];
  const likelySellingRangeLowExVat = roundSellingPrice(recommendedAskingPriceExVat * rangeFactors.low);
  const likelySellingRangeHighExVat = roundSellingPrice(recommendedAskingPriceExVat * rangeFactors.high);
  const specialistWarning = band.grade === 'E'
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
    expectedTimelineWithPlan: expectedTimelineWithPlan(
      band.grade,
      answers.desiredTimeline,
      answers.sellingPriority,
    ),
    priceDifferenceFromValuationExVat: recommendedAskingPriceExVat - safeValuation,
    note: `The Aim4price valuation remains ${roundSellingPrice(safeValuation).toLocaleString('en-ZA')} excl. VAT. This is a separate selling-price guide, not a new valuation.${specialistWarning}`,
  };
}
