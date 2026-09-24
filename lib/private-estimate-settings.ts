export type PrivateEstimateSettings = {
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
      .flatMap(({ key, label }) => settings[key] == null ? [] : [`${label}: ${settings[key]}`]),
  ];
}
