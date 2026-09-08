import {
  BASIC_REPLACEMENT_GUIDE_ROUNDING,
  BASIC_REPLACEMENT_SLIDER_STEP,
  roundBasicReplacementGuideValue,
  type BasicReplacementGuide,
  type BasicSpecificationLevel,
} from './basic-estimate';
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

/**
 * Split the researched family interval into Entry / Standard / Quality thirds,
 * then deliberately round the public guide anchors to the nearest R10,000.
 * The three rounded windows still share boundaries, while the replacement-price
 * slider fine-tunes within the selected window in R5,000 increments.
 */
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

  const rawSpan = max - min;
  const roundedMin = Math.max(0, roundBasicReplacementGuideValue(min));
  const roundedMax = Math.max(
    roundedMin + BASIC_REPLACEMENT_GUIDE_ROUNDING * 3,
    roundBasicReplacementGuideValue(max),
  );

  const firstBreak = Math.min(
    roundedMax - BASIC_REPLACEMENT_GUIDE_ROUNDING * 2,
    Math.max(
      roundedMin + BASIC_REPLACEMENT_GUIDE_ROUNDING,
      roundBasicReplacementGuideValue(min + rawSpan / 3),
    ),
  );
  const secondBreak = Math.min(
    roundedMax - BASIC_REPLACEMENT_GUIDE_ROUNDING,
    Math.max(
      firstBreak + BASIC_REPLACEMENT_GUIDE_ROUNDING,
      roundBasicReplacementGuideValue(min + rawSpan * 2 / 3),
    ),
  );

  const boundaries = [roundedMin, firstBreak, secondBreak, roundedMax] as const;
  const index = { entry: 0, standard: 1, premium: 2 }[level];
  const lower = boundaries[index];
  const upper = boundaries[index + 1];
  const suggestedExVat = Math.min(
    upper,
    Math.max(lower, roundBasicReplacementGuideValue((lower + upper) / 2)),
  );

  return {
    minExVat: lower,
    maxExVat: upper,
    suggestedExVat,
    sliderStep: BASIC_REPLACEMENT_SLIDER_STEP,
    source: 'family',
    sourceBandIds: [],
  };
}
