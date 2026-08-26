export type ReportUsageMetric = 'hours' | 'km' | 'percentage' | 'none' | '';

export type MaintenanceUsageEvent = {
  hours: number | null;
  assetUsageReading: number | null;
  assetUsageMetric: ReportUsageMetric;
};

export type MaintenanceMeterReading = {
  value: number;
  unit: 'hours' | 'km';
};

export function toFiniteNumberOrNull(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value === 'string' && !value.trim()) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveMaintenanceMeterReading(
  event: MaintenanceUsageEvent,
  fallbackUnit: 'hours' | 'km',
): MaintenanceMeterReading | null {
  if (event.assetUsageMetric === 'none' || event.assetUsageMetric === 'percentage') {
    return null;
  }

  // QR maintenance updates store the meter reading on the scan event itself.
  // Fuel-ledger usage is only a compatibility fallback and must not replace an
  // explicitly entered maintenance reading with a synthetic zero.
  const scanReading = toFiniteNumberOrNull(event.hours);
  const ledgerReading = toFiniteNumberOrNull(event.assetUsageReading);
  const value = scanReading ?? ledgerReading;

  if (value === null || value < 0) return null;

  return {
    value,
    unit: event.assetUsageMetric === 'km'
      ? 'km'
      : event.assetUsageMetric === 'hours'
        ? 'hours'
        : fallbackUnit,
  };
}
