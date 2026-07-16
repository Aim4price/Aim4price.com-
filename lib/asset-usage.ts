export type AssetUsageMetric = 'hours' | 'km' | 'percentage';

export type ResolvedAssetUsage = {
  value: number | null;
  metric: AssetUsageMetric;
};

type AssetUsageInput = {
  kind?: unknown;
  hours?: unknown;
  lifeWorkedPercent?: unknown;
  specsJson?: unknown;
};

type ExplicitUsageBasis = {
  basis: 'reading' | 'percentage';
  metric?: 'hours' | 'km';
};

const PERCENTAGE_TOKENS = new Set([
  'percent',
  'percentage',
  'percent_used',
  'percentage_used',
  'percentage_depreciation',
  'life_worked_percent',
  'worked_percent',
  'lifetime_percent',
  'wear_class',
]);

const HOURS_TOKENS = new Set(['hour', 'hours', 'hr', 'hrs', 'engine_hours']);
const KM_TOKENS = new Set(['km', 'kms', 'kilometre', 'kilometres', 'kilometer', 'kilometers']);

const PERCENTAGE_VALUE_KEYS = [
  'lifeWorkedPercent',
  'life_worked_percent',
  'workedPercent',
  'worked_percent',
  'percentWorked',
  'percent_worked',
  'lifetimeWorkedPercent',
  'lifetime_worked_percent',
  'lifetimeUsedPercent',
  'lifetime_used_percent',
] as const;

const READING_VALUE_KEYS = [
  'usageAmount',
  'usage_amount',
  'hours',
  'engine_hours',
  'km',
  'kilometres',
  'kilometers',
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asNonNegativeNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function basisFromValue(value: unknown): ExplicitUsageBasis | null {
  const normalized = normalizeToken(value);
  if (!normalized) return null;
  if (PERCENTAGE_TOKENS.has(normalized) || normalized.includes('percent')) {
    return { basis: 'percentage' };
  }
  if (normalized === 'reading') return { basis: 'reading' };
  if (KM_TOKENS.has(normalized)) return { basis: 'reading', metric: 'km' };
  if (HOURS_TOKENS.has(normalized)) return { basis: 'reading', metric: 'hours' };
  return null;
}

function firstExplicitBasis(
  specs: Record<string, unknown>,
  keys: readonly string[],
): ExplicitUsageBasis | null {
  for (const key of keys) {
    const basis = basisFromValue(specs[key]);
    if (basis) return basis;
  }
  return null;
}

function firstExplicitPercentage(
  specs: Record<string, unknown>,
  keys: readonly string[],
): ExplicitUsageBasis | null {
  for (const key of keys) {
    const basis = basisFromValue(specs[key]);
    if (basis?.basis === 'percentage') return basis;
  }
  return null;
}

function explicitUsageBasis(specs: Record<string, unknown>): ExplicitUsageBasis | null {
  // A saved basis is the strongest signal. Generic valuations intentionally keep
  // their underlying hour/km metric while saving usageBasis/usageMode as percent.
  return (
    firstExplicitBasis(specs, [
      'usageBasis',
      'usage_basis',
      'selectedUsageBasis',
      'selected_usage_basis',
    ]) ??
    firstExplicitBasis(specs, [
      'usageMode',
      'usage_mode',
      'selectedUsageMode',
      'selected_usage_mode',
      'valuationMode',
      'valuation_mode',
    ]) ??
    firstExplicitPercentage(specs, [
      'usageMetric',
      'usage_metric',
      'usageUnit',
      'usage_unit',
      'usageMetricType',
      'usage_metric_type',
    ]) ??
    firstExplicitPercentage(specs, [
      'depreciationMethodUsed',
      'depreciation_method_used',
      'selectedDepreciationMethod',
      'selected_depreciation_method',
    ])
  );
}

function readingMetric(specs: Record<string, unknown>, kind: unknown): 'hours' | 'km' {
  for (const key of [
    'usageMode',
    'usage_mode',
    'selectedUsageMode',
    'selected_usage_mode',
    'usageMetric',
    'usage_metric',
    'usageUnit',
    'usage_unit',
    'usageMetricType',
    'usage_metric_type',
  ]) {
    const basis = basisFromValue(specs[key]);
    if (basis?.metric) return basis.metric;
  }

  return normalizeToken(kind) === 'vehicle' ? 'km' : 'hours';
}

function percentageReading(input: AssetUsageInput, specs: Record<string, unknown>): number | null {
  const direct = asNonNegativeNumber(input.lifeWorkedPercent);
  if (direct !== null) return Math.min(100, direct);

  for (const key of PERCENTAGE_VALUE_KEYS) {
    const value = asNonNegativeNumber(specs[key]);
    if (value !== null) return Math.min(100, value);
  }

  return null;
}

function meterReading(input: AssetUsageInput, specs: Record<string, unknown>): number | null {
  const candidates = [input.hours, ...READING_VALUE_KEYS.map((key) => specs[key])]
    .map(asNonNegativeNumber)
    .filter((value): value is number => value !== null);

  // Prefer a real positive reading over a legacy zero placeholder that may still
  // exist in the hours column while the saved reading lives in specs_json.
  return candidates.find((value) => value > 0) ?? candidates[0] ?? null;
}

export function resolveAssetUsage(input: AssetUsageInput): ResolvedAssetUsage {
  const specs = asRecord(input.specsJson);
  const explicitBasis = explicitUsageBasis(specs);
  const percent = percentageReading(input, specs);
  const reading = meterReading(input, specs);
  const metric = explicitBasis?.metric ?? readingMetric(specs, input.kind);

  if (explicitBasis?.basis === 'percentage') {
    return { value: percent, metric: 'percentage' };
  }

  if (explicitBasis?.basis === 'reading') {
    return { value: reading, metric };
  }

  // Legacy percentage valuations may not have an explicit basis. A saved
  // percentage takes priority over an absent or placeholder zero-hour reading.
  if (percent !== null && (reading === null || reading === 0)) {
    return { value: percent, metric: 'percentage' };
  }

  if (reading !== null && reading > 0) {
    return { value: reading, metric };
  }

  if (percent !== null) {
    return { value: percent, metric: 'percentage' };
  }

  // Never present an unqualified legacy zero as if zero hours had been captured.
  return { value: null, metric };
}

export function formatResolvedAssetUsage(
  usage: ResolvedAssetUsage,
  emptyLabel = 'Not captured',
): string {
  if (usage.value === null || !Number.isFinite(usage.value)) return emptyLabel;

  const value = usage.value.toLocaleString('en-ZA', {
    maximumFractionDigits: 2,
  });

  if (usage.metric === 'percentage') return `${value}%`;
  return `${value} ${usage.metric}`;
}
