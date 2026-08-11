export type DealerMechanicalCondition = 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
export type DealerBodyCondition = 'excellent' | 'good' | 'average' | 'poor' | 'damaged';
export type DealerTyreCondition = '75_100' | '50_75' | '25_50' | 'below_25' | 'replacement_required';
export type DealerServiceHistory = 'complete_verified' | 'partial' | 'owner_recorded' | 'none' | 'unknown';
export type DealerRequiredWork = 'ready' | 'minor' | 'moderate' | 'significant' | 'major';
export type PopularityStars = 1 | 2 | 3 | 4 | 5;

export type DealerAssessmentInput = {
  mechanicalCondition?: unknown;
  bodyCondition?: unknown;
  tyreCondition?: unknown;
  serviceHistory?: unknown;
  requiredWork?: unknown;
} | null | undefined;

export type NormalizedDealerAssessment = {
  mechanicalCondition: DealerMechanicalCondition;
  bodyCondition: DealerBodyCondition;
  tyreCondition: DealerTyreCondition;
  serviceHistory: DealerServiceHistory;
  requiredWork: DealerRequiredWork;
  conditionFactorPercent: number;
};

const MECHANICAL_FACTORS: Record<DealerMechanicalCondition, number> = {
  excellent: 0.95,
  good: 0.85,
  average: 0.75,
  below_average: 0.65,
  poor: 0.5,
};

const BODY_FACTORS: Record<DealerBodyCondition, number> = {
  excellent: 0.95,
  good: 0.85,
  average: 0.75,
  poor: 0.6,
  damaged: 0.45,
};

const TYRE_FACTORS: Record<DealerTyreCondition, number> = {
  '75_100': 0.95,
  '50_75': 0.85,
  '25_50': 0.75,
  below_25: 0.65,
  replacement_required: 0.55,
};

const SERVICE_ADJUSTMENTS: Record<DealerServiceHistory, number> = {
  complete_verified: 0.02,
  partial: 0,
  owner_recorded: -0.01,
  none: -0.03,
  unknown: -0.02,
};

// Work required is deliberately capped. Mechanical, body and tyre selections
// already capture most defects, so this is a market-readiness adjustment rather
// than a second full repair-cost deduction.
const WORK_ADJUSTMENTS: Record<DealerRequiredWork, number> = {
  ready: 0.01,
  minor: 0,
  moderate: -0.02,
  significant: -0.05,
  major: -0.08,
};

const POPULARITY_ADJUSTMENTS: Record<PopularityStars, number> = {
  1: -0.08,
  2: -0.04,
  3: 0,
  4: 0.025,
  5: 0.05,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  const normalized = String(value ?? '').trim().toLowerCase();
  if ((allowed as readonly string[]).includes(normalized)) return normalized as T;
  throw new Error(`${label} is required for a detailed asset assessment.`);
}

export function dealerAssessmentWasRequested(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length > 0;
}

export function calculateDealerConditionFactor(input: Omit<NormalizedDealerAssessment, 'conditionFactorPercent'>): number {
  const componentFactor =
    MECHANICAL_FACTORS[input.mechanicalCondition] * 0.5
    + BODY_FACTORS[input.bodyCondition] * 0.3
    + TYRE_FACTORS[input.tyreCondition] * 0.2;
  const adjusted = componentFactor
    + SERVICE_ADJUSTMENTS[input.serviceHistory]
    + WORK_ADJUSTMENTS[input.requiredWork];

  return Math.min(0.98, Math.max(0.4, adjusted));
}

export function normalizeDealerAssessment(value: DealerAssessmentInput): NormalizedDealerAssessment | null {
  if (!dealerAssessmentWasRequested(value)) return null;
  const source = value as Record<string, unknown>;

  const normalized = {
    mechanicalCondition: normalizeEnum(source.mechanicalCondition, ['excellent', 'good', 'average', 'below_average', 'poor'] as const, 'Mechanical condition'),
    bodyCondition: normalizeEnum(source.bodyCondition, ['excellent', 'good', 'average', 'poor', 'damaged'] as const, 'Body condition'),
    tyreCondition: normalizeEnum(source.tyreCondition, ['75_100', '50_75', '25_50', 'below_25', 'replacement_required'] as const, 'Tyre or wear-component condition'),
    serviceHistory: normalizeEnum(source.serviceHistory, ['complete_verified', 'partial', 'owner_recorded', 'none', 'unknown'] as const, 'Service history'),
    requiredWork: normalizeEnum(source.requiredWork, ['ready', 'minor', 'moderate', 'significant', 'major'] as const, 'Required work'),
  };

  return {
    ...normalized,
    conditionFactorPercent: Math.round(calculateDealerConditionFactor(normalized) * 1000) / 10,
  };
}

export function getDealerConditionFactor(value: NormalizedDealerAssessment | null | undefined): number | null {
  if (!value) return null;
  return value.conditionFactorPercent / 100;
}

export function normalizePopularityStars(value: unknown): PopularityStars | null {
  if (value === null || typeof value === 'undefined' || String(value).trim() === '') return null;
  const popularity = Number(value);
  if (!Number.isInteger(popularity) || popularity < 1 || popularity > 5) {
    throw new Error('Popularity must be selected from 1 to 5 stars.');
  }
  return popularity as PopularityStars;
}

export function applyPopularityToConditionFactor(
  baseConditionFactor: number,
  popularityStars: PopularityStars | null | undefined,
  bounds: { min: number; max: number } = { min: 0.4, max: 0.98 },
): number {
  const normalizedPopularity = popularityStars ?? 3;
  const adjusted = baseConditionFactor + POPULARITY_ADJUSTMENTS[normalizedPopularity];
  return Math.min(bounds.max, Math.max(bounds.min, adjusted));
}
