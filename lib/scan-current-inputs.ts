/** Delayed offline events remain in history without replacing newer current details. */
export function isHistoricalScan(capturedAt: string | null, current: { updated_at?: string | Date | null; last_scanned_at?: string | Date | null; specs_json?: unknown }): boolean {
  if (!capturedAt) return false;
  const captured = new Date(capturedAt).getTime();
  const specs = current.specs_json && typeof current.specs_json === 'object' ? current.specs_json as Record<string, unknown> : {};
  // Upload time is not input time: consecutive offline events must retain their order.
  const changedAt = typeof specs.valuationInputsChangedAt === 'string' ? specs.valuationInputsChangedAt : current.updated_at;
  const latest = Math.max(...[changedAt, current.last_scanned_at].map(value => value ? new Date(value).getTime() || 0 : 0));
  return Number.isFinite(captured) && captured < latest;
}
