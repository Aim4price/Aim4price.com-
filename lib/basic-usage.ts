import type { BasicUsageProfile } from './basic-usage-profiles';

export const BASIC_USAGE_MODE_KEYS = [
  'usageMode', 'usage_mode', 'usageBasis', 'usage_basis', 'valuationMode', 'valuation_mode',
  'depreciationMethodUsed', 'depreciation_method_used', 'selectedDepreciationMethod',
  'selected_depreciation_method', 'selectedUsageMode', 'selected_usage_mode',
] as const;

function nonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Explicit choice wins over derived percentages carried by saved reading-based valuations. */
export function resolveBasicUsage(input: {
  profile: BasicUsageProfile;
  usageAmount: unknown;
  lifeWorkedPercent: unknown;
  specs: Record<string, unknown>;
}) {
  const { profile, specs } = input;
  const requested = specs.basic_usage_basis;
  if (requested != null && requested !== 'reading' && requested !== 'percent') {
    throw new Error('Choose a usage reading or percentage of useful life worked.');
  }
  if (specs.basic_usage_profile_version != null && specs.basic_usage_profile_version !== profile.version) {
    throw new Error('This Basic usage profile version is unavailable.');
  }
  // Preserve valuations saved before meter profiles were introduced.
  const legacyPercent = specs.basic_calculation_profile === 'user_life_worked_v1' ||
    BASIC_USAGE_MODE_KEYS.some((key) => ['percent', 'percentage', 'percent_used', 'percentage_depreciation', 'worked_percent', 'lifetime_percent', 'wear_class']
      .includes(String(specs[key] ?? '').toLowerCase()));
  const basis = requested ?? (profile.primaryMetric === 'percent' || legacyPercent || input.usageAmount == null ? 'percent' : 'reading');
  if (basis === 'reading') {
    if (profile.primaryMetric === 'percent') throw new Error('This family uses percentage of useful life worked.');
    const reading = nonNegativeNumber(input.usageAmount);
    if (reading === null) throw new Error('Enter a non-negative usage reading, or choose percentage of useful life worked.');
    return { basis: 'reading' as const, usageAmount: Math.round(reading), lifeWorkedPercent: null };
  }
  const percent = nonNegativeNumber(input.lifeWorkedPercent);
  if (percent === null || percent > 100) throw new Error('Enter the percentage of useful life worked between 0 and 100.');
  return { basis: 'percent' as const, usageAmount: null, lifeWorkedPercent: percent };
}
