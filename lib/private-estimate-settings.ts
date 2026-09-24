export type PrivateEstimateSettings = {
  conditionPercent: number | null;
  popularityPercent: number | null;
  lifetimeUsage: number | null;
  ageDepreciationPercent: number | null;
  usageDepreciationPercent: number | null;
};

export const PRIVATE_ESTIMATE_FIELDS = [
  { key: 'conditionPercent', label: 'Condition retained (%)', min: 30, max: 110, help: '100% retains the value after depreciation. Overrides the condition assessment.' },
  { key: 'popularityPercent', label: 'Popularity multiplier (%)', min: 10, max: 150, help: '100% has no effect; 85% reduces value by 15%. Overrides the star rating.' },
  { key: 'lifetimeUsage', label: 'Expected lifetime usage', min: 1, max: 2000000, help: 'Hours or kilometres, as shown for this asset. Changes the calculated usage depreciation.' },
  { key: 'ageDepreciationPercent', label: 'Age depreciation (%)', min: 0, max: 100, help: 'Overrides the total age deduction. Blended with usage where both apply.' },
  { key: 'usageDepreciationPercent', label: 'Usage depreciation (%)', min: 0, max: 100, help: 'Overrides the total usage deduction, including any lifetime adjustment.' },
] as const;

export function hasPrivateEstimateSettingsRequest(assumptions: unknown): boolean {
  return !!assumptions && typeof assumptions === 'object'
    && (assumptions as Record<string, unknown>).privateSettings != null;
}

export function normalizePrivateEstimateSettings(value: unknown): PrivateEstimateSettings | null {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Estimate settings must be an object.');
  const source = value as Record<string, unknown>;
  const settings = {} as PrivateEstimateSettings;
  for (const field of PRIVATE_ESTIMATE_FIELDS) {
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
  return PRIVATE_ESTIMATE_FIELDS.flatMap(({ key, label }) => settings[key] == null ? [] : [`${label}: ${settings[key]}`]);
}
