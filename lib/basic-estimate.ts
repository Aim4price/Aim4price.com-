import type { UsageMetricType } from './equipment-types';

export type BasicSpecificationLevel = 'entry' | 'standard' | 'premium';
export type BasicExtraChoice = 'none' | 'family' | 'other' | '';

export type BasicReplacementBandInput = {
  id: number;
  brandId: number | null;
  bandKey: string;
  bandLabel: string;
  specMatchJson: Record<string, unknown>;
  replacementMinExVat: number;
  replacementMaxExVat: number;
  replacementPriceYear: number;
  confidence: number;
};

export type BasicReplacementGuide = {
  minExVat: number;
  maxExVat: number;
  suggestedExVat: number;
  sliderStep: number;
  source: 'tier' | 'family';
  sourceBandIds: number[];
};

export type BasicConditionTemplate = {
  mechanical: string;
  body: string;
  wear: string;
  service: string;
  requiredWork: string;
};

export type BasicFamilyExtra = {
  key: string;
  label: string;
};

export const BASIC_SPECIFICATION_LEVELS: Array<{
  key: BasicSpecificationLevel;
  label: string;
  description: string;
}> = [
  { key: 'entry', label: 'Entry', description: 'Lower-cost / simpler specification.' },
  { key: 'standard', label: 'Standard', description: 'Typical mainstream specification.' },
  { key: 'premium', label: 'Quality', description: 'Higher specification / quality asset.' },
];

function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function roundToGuideStep(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

function chooseMoneyStep(maxValue: number): number {
  if (maxValue >= 10_000_000) return 100_000;
  if (maxValue >= 2_000_000) return 50_000;
  if (maxValue >= 500_000) return 25_000;
  if (maxValue >= 100_000) return 10_000;
  if (maxValue >= 25_000) return 5_000;
  return 1_000;
}

function levelTokens(level: BasicSpecificationLevel): string[] {
  if (level === 'entry') return ['entry', 'basic', 'lower', 'economy', 'budget', 'base'];
  if (level === 'premium') return ['premium', 'luxury', 'high', 'upper', 'flagship', 'top'];
  return ['standard', 'mid', 'middle', 'mainstream', 'typical', 'medium'];
}

function bandLooksLikeLevel(band: BasicReplacementBandInput, level: BasicSpecificationLevel): boolean {
  const searchable = [
    band.bandKey,
    band.bandLabel,
    ...Object.entries(band.specMatchJson ?? {}).flatMap(([key, value]) => [key, String(value ?? '')]),
  ]
    .map(normalizeText)
    .join(' ');

  return levelTokens(level).some((token) => searchable.includes(token));
}

function validBand(band: BasicReplacementBandInput): boolean {
  return Number.isFinite(band.replacementMinExVat)
    && Number.isFinite(band.replacementMaxExVat)
    && band.replacementMinExVat > 0
    && band.replacementMaxExVat > band.replacementMinExVat;
}

function buildGuideFromBands(
  bands: BasicReplacementBandInput[],
  source: BasicReplacementGuide['source'],
): BasicReplacementGuide | null {
  if (!bands.length) return null;

  const rawMin = Math.min(...bands.map((band) => band.replacementMinExVat));
  const rawMax = Math.max(...bands.map((band) => band.replacementMaxExVat));
  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax) || rawMin <= 0 || rawMax <= rawMin) return null;

  const sliderStep = chooseMoneyStep(rawMax);
  const minExVat = roundToGuideStep(rawMin, sliderStep);
  const maxExVat = Math.max(minExVat + sliderStep, roundToGuideStep(rawMax, sliderStep));
  const suggestedExVat = roundToGuideStep((minExVat + maxExVat) / 2, sliderStep);

  return {
    minExVat,
    maxExVat,
    suggestedExVat: Math.min(maxExVat, Math.max(minExVat, suggestedExVat)),
    sliderStep,
    source,
    sourceBandIds: bands.map((band) => band.id),
  };
}

/**
 * Builds the broad Basic Estimate replacement-price guide from the existing
 * replacement_price_bands dataset. Only family-level bands are used here: Basic
 * Estimate must not infer a family range by combining brand/model bands. Tier-
 * labelled family bands are preferred. Where a family only has a broad family
 * range, the range is split into deliberately overlapping windows so Entry /
 * Standard / Quality position the user without claiming exact model precision.
 */
export function resolveBasicReplacementGuide(
  inputBands: BasicReplacementBandInput[],
  level: BasicSpecificationLevel,
): BasicReplacementGuide | null {
  const valid = inputBands.filter(validBand);
  if (!valid.length) return null;

  const familyBands = valid.filter((band) => band.brandId === null);
  if (!familyBands.length) return null;

  const tierMatches = familyBands.filter((band) => bandLooksLikeLevel(band, level));
  const exactTierGuide = buildGuideFromBands(tierMatches, 'tier');
  if (exactTierGuide) return exactTierGuide;

  const familyGuide = buildGuideFromBands(familyBands, 'family');
  if (!familyGuide) return null;

  const span = familyGuide.maxExVat - familyGuide.minExVat;
  const bounds: Record<BasicSpecificationLevel, [number, number, number]> = {
    entry: [0, 0.45, 0.25],
    standard: [0.25, 0.75, 0.5],
    premium: [0.55, 1, 0.75],
  };
  const [lowRatio, highRatio, suggestedRatio] = bounds[level];
  const step = familyGuide.sliderStep;
  const minExVat = roundToGuideStep(familyGuide.minExVat + span * lowRatio, step);
  const maxExVat = Math.max(minExVat + step, roundToGuideStep(familyGuide.minExVat + span * highRatio, step));
  const suggestedExVat = roundToGuideStep(familyGuide.minExVat + span * suggestedRatio, step);

  return {
    minExVat,
    maxExVat,
    suggestedExVat: Math.min(maxExVat, Math.max(minExVat, suggestedExVat)),
    sliderStep: step,
    source: 'family',
    sourceBandIds: familyGuide.sourceBandIds,
  };
}

export function getBasicConditionTemplate(input: {
  familyKey?: string | null;
  familyLabel?: string | null;
  isPropelled?: boolean | null;
  usageMetricType?: UsageMetricType | null;
}): BasicConditionTemplate {
  const haystack = `${normalizeText(input.familyKey)} ${normalizeText(input.familyLabel)}`;
  const trailerLike = /(trailer|implement|plough|plow|harrow|planter|seeder|spreader|baler|rake|mower|cultivator)/.test(haystack);
  const vehicleLike = input.usageMetricType === 'km' || /(car|suv|bakkie|ldv|truck|bus|motorcycle|quadbike|side by side)/.test(haystack);
  const heavyMobile = Boolean(input.isPropelled) || /(excavator|loader|dozer|grader|telehandler|forklift|harvester|sprayer|roller|compactor|tlb|backhoe)/.test(haystack);

  if (trailerLike) {
    return {
      mechanical: 'Structure / chassis',
      body: 'Working components',
      wear: 'Tyres / wear components',
      service: 'Maintenance history',
      requiredWork: 'Required repairs',
    };
  }

  if (vehicleLike) {
    return {
      mechanical: 'Mechanical / engine',
      body: 'Body / chassis / interior',
      wear: 'Tyres / wear components',
      service: 'Service history',
      requiredWork: 'Required work',
    };
  }

  if (heavyMobile) {
    return {
      mechanical: 'Mechanical / engine',
      body: 'Hydraulics / drivetrain / structure',
      wear: 'Wear components / tyres',
      service: 'Service history',
      requiredWork: 'Required work',
    };
  }

  return {
    mechanical: 'Mechanical / working condition',
    body: 'Body / frame / structure',
    wear: 'Wear components',
    service: 'Service / maintenance history',
    requiredWork: 'Required work',
  };
}

export function getBasicFamilyExtra(familyKey?: string | null, familyLabel?: string | null): BasicFamilyExtra | null {
  const haystack = `${normalizeText(familyKey)} ${normalizeText(familyLabel)}`;

  if (/tractor/.test(haystack)) return { key: 'front_loader', label: 'Front Loader' };
  if (/excavator/.test(haystack)) return { key: 'hammer_attachment', label: 'Hammer attachment' };
  if (/(tlb|backhoe)/.test(haystack)) return { key: 'hydraulic_hammer', label: 'Hydraulic hammer' };
  if (/telehandler/.test(haystack)) return { key: 'fork_carriage', label: 'Fork carriage' };
  if (/(skid steer|skid_steer|compact track|compact_track)/.test(haystack)) return { key: 'attachment', label: 'Main attachment' };
  if (/forklift/.test(haystack)) return { key: 'side_shift', label: 'Side shift' };
  if (/sprayer/.test(haystack)) return { key: 'guidance_system', label: 'GPS / guidance system' };
  if (/harvester/.test(haystack)) return { key: 'header_attachment', label: 'Header attachment' };
  if (/generator/.test(haystack)) return { key: 'automatic_transfer_switch', label: 'Automatic transfer switch' };

  return null;
}
