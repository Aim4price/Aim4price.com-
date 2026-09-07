import type { BasicReplacementGuide, BasicSpecificationLevel } from './basic-estimate';

export type BasicCatalogueIdentity = {
  releaseKey: string;
  familyKey: string;
  familyLabel: string;
  groupKey: string;
  groupLabel: string;
  minimumExVat: number;
  maximumExVat: number;
  pricingAsOf: string;
  confidence: string;
};

/** Equal thirds of the interval, including the researched minimum and maximum. */
export function resolveCatalogueGuide(
  catalogue: Pick<BasicCatalogueIdentity, 'minimumExVat' | 'maximumExVat'>,
  level: BasicSpecificationLevel,
): BasicReplacementGuide {
  const { minimumExVat: min, maximumExVat: max } = catalogue;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= min) {
    throw new Error('Invalid Basic catalogue price range.');
  }
  if (level !== 'entry' && level !== 'standard' && level !== 'premium') {
    throw new Error('Choose Entry, Standard or Quality.');
  }
  const index = { entry: 0, standard: 1, premium: 2 }[level];
  const span = max - min;
  const lower = min + span * index / 3;
  const upper = index === 2 ? max : min + span * (index + 1) / 3;
  const step = span >= 3_000_000 ? 50_000 : span >= 300_000 ? 5_000 : span >= 30_000 ? 1_000 : 100;
  return {
    minExVat: lower,
    maxExVat: upper,
    suggestedExVat: Math.min(upper, Math.max(lower, Math.round((lower + upper) / 2 / step) * step)),
    sliderStep: step,
    source: 'family',
    sourceBandIds: [],
  };
}
