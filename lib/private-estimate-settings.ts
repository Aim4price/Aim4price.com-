export const FACTOR_SETTING_GROUPS = [
  { label: "Basic condition", help: "Retained value (%)", fields: [
    {"key": "basic_excellent", "label": "Excellent", "defaultValue": 100, "min": 1, "max": 110, "help": "Retained value (%)"},
    {"key": "basic_good", "label": "Good", "defaultValue": 90, "min": 1, "max": 110, "help": "Retained value (%)"},
    {"key": "basic_fair", "label": "Fair", "defaultValue": 70, "min": 1, "max": 110, "help": "Retained value (%)"},
    {"key": "basic_used", "label": "Used", "defaultValue": 45, "min": 1, "max": 110, "help": "Retained value (%)"},
    {"key": "basic_serious", "label": "Serious wear", "defaultValue": 25, "min": 1, "max": 110, "help": "Retained value (%)"},
  ] },
  { label: "Popularity", help: "Multiplier (%). 100 leaves value unchanged.", fields: [
    {"key": "popularity_1", "label": "1 star", "defaultValue": 70, "min": 10, "max": 150, "help": "Multiplier (%). 100 leaves value unchanged."},
    {"key": "popularity_2", "label": "2 stars", "defaultValue": 85, "min": 10, "max": 150, "help": "Multiplier (%). 100 leaves value unchanged."},
    {"key": "popularity_3", "label": "3 stars", "defaultValue": 100, "min": 10, "max": 150, "help": "Multiplier (%). 100 leaves value unchanged."},
    {"key": "popularity_4", "label": "4 stars", "defaultValue": 108, "min": 10, "max": 150, "help": "Multiplier (%). 100 leaves value unchanged."},
    {"key": "popularity_5", "label": "5 stars", "defaultValue": 115, "min": 10, "max": 150, "help": "Multiplier (%). 100 leaves value unchanged."},
  ] },
  { label: "Advanced: mechanical / working condition", help: "Retained value (%). Contributes 50% of detailed condition.", fields: [
    {"key": "mechanical_excellent", "label": "Excellent", "defaultValue": 100, "min": 0, "max": 100, "help": "Retained value (%). Contributes 50% of detailed condition."},
    {"key": "mechanical_good", "label": "Good", "defaultValue": 90, "min": 0, "max": 100, "help": "Retained value (%). Contributes 50% of detailed condition."},
    {"key": "mechanical_average", "label": "Average", "defaultValue": 70, "min": 0, "max": 100, "help": "Retained value (%). Contributes 50% of detailed condition."},
    {"key": "mechanical_below_average", "label": "Below average", "defaultValue": 45, "min": 0, "max": 100, "help": "Retained value (%). Contributes 50% of detailed condition."},
    {"key": "mechanical_poor", "label": "Poor", "defaultValue": 20, "min": 0, "max": 100, "help": "Retained value (%). Contributes 50% of detailed condition."},
  ] },
  { label: "Advanced: body / frame / structure", help: "Retained value (%). Contributes 30% of detailed condition.", fields: [
    {"key": "body_excellent", "label": "Excellent", "defaultValue": 100, "min": 0, "max": 100, "help": "Retained value (%). Contributes 30% of detailed condition."},
    {"key": "body_good", "label": "Good", "defaultValue": 90, "min": 0, "max": 100, "help": "Retained value (%). Contributes 30% of detailed condition."},
    {"key": "body_average", "label": "Average", "defaultValue": 70, "min": 0, "max": 100, "help": "Retained value (%). Contributes 30% of detailed condition."},
    {"key": "body_poor", "label": "Poor", "defaultValue": 45, "min": 0, "max": 100, "help": "Retained value (%). Contributes 30% of detailed condition."},
    {"key": "body_damaged", "label": "Damaged", "defaultValue": 20, "min": 0, "max": 100, "help": "Retained value (%). Contributes 30% of detailed condition."},
  ] },
  { label: "Advanced: tyres / wear components", help: "Retained value (%). Contributes 20% of detailed condition.", fields: [
    {"key": "tyre_75_100", "label": "75 to 100% remaining", "defaultValue": 100, "min": 0, "max": 100, "help": "Retained value (%). Contributes 20% of detailed condition."},
    {"key": "tyre_50_75", "label": "50 to 75% remaining", "defaultValue": 90, "min": 0, "max": 100, "help": "Retained value (%). Contributes 20% of detailed condition."},
    {"key": "tyre_25_50", "label": "25 to 50% remaining", "defaultValue": 70, "min": 0, "max": 100, "help": "Retained value (%). Contributes 20% of detailed condition."},
    {"key": "tyre_below_25", "label": "Below 25%", "defaultValue": 50, "min": 0, "max": 100, "help": "Retained value (%). Contributes 20% of detailed condition."},
    {"key": "tyre_replacement_required", "label": "Replacement required", "defaultValue": 25, "min": 0, "max": 100, "help": "Retained value (%). Contributes 20% of detailed condition."},
  ] },
  { label: "Advanced: service history", help: "Percentage points added to detailed condition. Negative values deduct.", fields: [
    {"key": "service_complete_verified", "label": "Complete and verified", "defaultValue": 2, "min": -100, "max": 100, "help": "Percentage points added to detailed condition. Negative values deduct."},
    {"key": "service_partial", "label": "Partial", "defaultValue": 0, "min": -100, "max": 100, "help": "Percentage points added to detailed condition. Negative values deduct."},
    {"key": "service_owner_recorded", "label": "Owner recorded", "defaultValue": -2, "min": -100, "max": 100, "help": "Percentage points added to detailed condition. Negative values deduct."},
    {"key": "service_none", "label": "None", "defaultValue": -5, "min": -100, "max": 100, "help": "Percentage points added to detailed condition. Negative values deduct."},
    {"key": "service_unknown", "label": "Unknown", "defaultValue": -3, "min": -100, "max": 100, "help": "Percentage points added to detailed condition. Negative values deduct."},
  ] },
  { label: "Advanced: work required", help: "Percentage points added to detailed condition. Negative values deduct.", fields: [
    {"key": "work_ready", "label": "Ready", "defaultValue": 0, "min": -100, "max": 100, "help": "Percentage points added to detailed condition. Negative values deduct."},
    {"key": "work_minor", "label": "Minor", "defaultValue": 0, "min": -100, "max": 100, "help": "Percentage points added to detailed condition. Negative values deduct."},
    {"key": "work_moderate", "label": "Moderate", "defaultValue": -4, "min": -100, "max": 100, "help": "Percentage points added to detailed condition. Negative values deduct."},
    {"key": "work_significant", "label": "Significant", "defaultValue": -8, "min": -100, "max": 100, "help": "Percentage points added to detailed condition. Negative values deduct."},
    {"key": "work_major", "label": "Major", "defaultValue": -12, "min": -100, "max": 100, "help": "Percentage points added to detailed condition. Negative values deduct."},
  ] },
] as const;

type FactorKey = typeof FACTOR_SETTING_GROUPS[number]["fields"][number]["key"];
export type PrivateEstimateSettings = Partial<Record<FactorKey, number | null>> & {
  year1Percent?: number | null;
  year2Percent?: number | null;
  year3Percent?: number | null;
  year4Percent?: number | null;
  year5Percent?: number | null;
  onwardPercent?: number | null;
  ageWeightPercent?: number | null;
  conditionPercent: number | null;
  popularityPercent: number | null;
  lifetimeUsage: number | null;
  ageDepreciationPercent: number | null;
  usageDepreciationPercent: number | null;
};

export const ANNUAL_DEPRECIATION_FIELDS = [
  { key: 'year1Percent', label: 'Year 1', defaultValue: 20 },
  { key: 'year2Percent', label: 'Year 2', defaultValue: 15 },
  { key: 'year3Percent', label: 'Year 3', defaultValue: 10 },
  { key: 'year4Percent', label: 'Year 4', defaultValue: 2.5 },
  { key: 'year5Percent', label: 'Year 5', defaultValue: 2.5 },
  { key: 'onwardPercent', label: 'Year 6 onward', defaultValue: 2.5 },
] as const;

export const PRIVATE_ESTIMATE_FIELDS = [
  ...FACTOR_SETTING_GROUPS.flatMap(group => [...group.fields]),
  ...ANNUAL_DEPRECIATION_FIELDS.map(field => ({ ...field, min: 0, max: 100, help: 'Percentage of the starting replacement price deducted for this year.' })),
  { key: 'ageWeightPercent', label: 'Age weight (%)', min: 0, max: 100, help: 'Usage receives the remaining weight.' },
  { key: 'conditionPercent', label: 'Condition retained (%)', min: 1, max: 110, help: '100% retains the value after depreciation. Overrides the condition assessment.' },
  { key: 'popularityPercent', label: 'Popularity multiplier (%)', min: 10, max: 150, help: '100% has no effect; 85% reduces value by 15%. Overrides the star rating.' },
] as const;

// Retain old signed/saved estimates; these controls are no longer offered in the modal.
const LEGACY_FIELDS = [
  { key: 'lifetimeUsage', label: 'Expected lifetime usage', min: 1, max: 2000000, help: 'Hours or kilometres, as shown for this asset. Changes the calculated usage depreciation.' },
  { key: 'ageDepreciationPercent', label: 'Age depreciation (%)', min: 0, max: 100, help: 'Overrides the total age deduction. Blended with usage where both apply.' },
  { key: 'usageDepreciationPercent', label: 'Usage depreciation (%)', min: 0, max: 100, help: 'Overrides the total usage deduction, including any lifetime adjustment.' },
] as const;
const VALIDATED_FIELDS = [...PRIVATE_ESTIMATE_FIELDS, ...LEGACY_FIELDS];

export function annualDepreciationPercent(age: number, settings?: PrivateEstimateSettings | null): number {
  const years = Math.max(0, Math.floor(age));
  const total = ANNUAL_DEPRECIATION_FIELDS.reduce((sum, field, index) =>
    sum + (settings?.[field.key] ?? field.defaultValue) * (index === 5 ? Math.max(0, years - 5) : Number(years > index)), 0);
  return Math.min(100, total);
}

export function weightedDepreciationPercent(age: number | null, usage: number, settings?: PrivateEstimateSettings | null): number {
  if (age === null) return usage;
  const weight = (settings?.ageWeightPercent ?? 50) / 100;
  return Math.round(age * weight + usage * (1 - weight));
}

export function hasPrivateEstimateSettingsRequest(assumptions: unknown): boolean {
  return !!assumptions && typeof assumptions === 'object'
    && (assumptions as Record<string, unknown>).privateSettings != null;
}

export function normalizePrivateEstimateSettings(value: unknown): PrivateEstimateSettings | null {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Estimate settings must be an object.');
  const source = value as Record<string, unknown>;
  const settings = {} as PrivateEstimateSettings;
  for (const field of VALIDATED_FIELDS) {
    const raw = source[field.key];
    if (raw == null || raw === '') { settings[field.key] = null; continue; }
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < field.min || raw > field.max) {
      throw new Error(`Estimate settings: ${field.label} must be between ${field.min} and ${field.max}.`);
    }
    settings[field.key] = field.key === 'lifetimeUsage' ? Math.round(raw) : Math.round(raw * 100) / 100;
  }
  return Object.values(settings).some((value) => value !== null) ? settings : null;
}

export function privateEstimateSettingsNotes(settings: PrivateEstimateSettings | null | undefined): string[] {
  if (!settings) return [];
  const annual = ANNUAL_DEPRECIATION_FIELDS.filter(({ key }) => settings[key] != null);
  return [
    ...(annual.length ? [`Annual depreciation (% of replacement): ${annual.map(({ key, label }) => `${label} ${settings[key]}%`).join('; ')}`] : []),
    ...VALIDATED_FIELDS.filter(field => !ANNUAL_DEPRECIATION_FIELDS.some(annual => annual.key === field.key))
      .flatMap(({ key, label }) => settings[key] == null ? [] : [`${FACTOR_SETTING_GROUPS.find(group => group.fields.some(field => field.key === key))?.label ? FACTOR_SETTING_GROUPS.find(group => group.fields.some(field => field.key === key))!.label + ": " : ""}${label}: ${settings[key]}`]),
  ];
}

export function estimateFactor(settings: PrivateEstimateSettings | null | undefined, key: FactorKey): number {
  const field = FACTOR_SETTING_GROUPS.flatMap(group => [...group.fields]).find(field => field.key === key)!;
  return (settings?.[key] ?? field.defaultValue) / 100;
}
