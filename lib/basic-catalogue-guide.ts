import type { BasicReplacementGuide, BasicSpecificationLevel } from './basic-estimate';
import type { BasicUsageProfile } from './basic-usage-profiles';

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
  usageProfile?: BasicUsageProfile;
};

// Keep these values aligned with the Basic replacement guide contract in
// basic-estimate.ts. This module intentionally keeps the runtime constants local
// because the repository's direct Node TypeScript tests cannot resolve a new
// extensionless runtime import here; the behaviour is cross-checked in tests.
const BASIC_CATALOGUE_GUIDE_ROUNDING = 10_000;
const BASIC_CATALOGUE_SLIDER_STEP = 5_000;

function roundCatalogueGuideValue(value: number): number {
  return Math.round(value / BASIC_CATALOGUE_GUIDE_ROUNDING) * BASIC_CATALOGUE_GUIDE_ROUNDING;
}

/**
 * Split the researched family interval into Entry / Standard / Quality thirds,
 * then deliberately round the public guide anchors to the nearest R10,000.
 * The three rounded windows still share boundaries, while the replacement-price
 * slider fine-tunes within the selected window in R5,000 increments.
 */
export function resolveCatalogueGuide(
  catalogue: Pick<BasicCatalogueIdentity, 'minimumExVat' | 'maximumExVat'> & Partial<Pick<BasicCatalogueIdentity, 'familyKey'>>,
  level: BasicSpecificationLevel,
): BasicReplacementGuide {
  const { minimumExVat: min, maximumExVat: max } = catalogue;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= min) {
    throw new Error('Invalid Basic catalogue price range.');
  }
  if (level !== 'entry' && level !== 'standard' && level !== 'premium') {
    throw new Error('Choose Entry, Standard or Quality.');
  }

  // Sedan entry/mainstream prices cannot be inferred as thirds of a family
  // interval containing exotic luxury cars. These are adjustable ballpark
  // guides, defined VAT-inclusive to keep the default Motor display rounded.
  if (catalogue.familyKey === 'sedan_fastback') {
    const ranges = { entry: [200_000, 400_000], standard: [400_000, 900_000], premium: [900_000, 2_500_000] } as const;
    const [lower, upper] = ranges[level];
    return {
      minExVat: lower / 1.15,
      maxExVat: upper / 1.15,
      suggestedExVat: ((lower + upper) / 2) / 1.15,
      sliderStep: 5_000 / 1.15,
      source: 'tier',
      sourceBandIds: [],
    };
  }

  const rawSpan = max - min;
  const roundedMin = Math.max(0, roundCatalogueGuideValue(min));
  const roundedMax = Math.max(
    roundedMin + BASIC_CATALOGUE_GUIDE_ROUNDING * 3,
    roundCatalogueGuideValue(max),
  );

  const firstBreak = Math.min(
    roundedMax - BASIC_CATALOGUE_GUIDE_ROUNDING * 2,
    Math.max(
      roundedMin + BASIC_CATALOGUE_GUIDE_ROUNDING,
      roundCatalogueGuideValue(min + rawSpan / 3),
    ),
  );
  const secondBreak = Math.min(
    roundedMax - BASIC_CATALOGUE_GUIDE_ROUNDING,
    Math.max(
      firstBreak + BASIC_CATALOGUE_GUIDE_ROUNDING,
      roundCatalogueGuideValue(min + rawSpan * 2 / 3),
    ),
  );

  const boundaries = [roundedMin, firstBreak, secondBreak, roundedMax] as const;
  const index = { entry: 0, standard: 1, premium: 2 }[level];
  const lower = boundaries[index];
  const upper = boundaries[index + 1];
  const suggestedExVat = Math.min(
    upper,
    Math.max(lower, roundCatalogueGuideValue((lower + upper) / 2)),
  );

  return {
    minExVat: lower,
    maxExVat: upper,
    suggestedExVat,
    sliderStep: BASIC_CATALOGUE_SLIDER_STEP,
    source: 'family',
    sourceBandIds: [],
  };
}
