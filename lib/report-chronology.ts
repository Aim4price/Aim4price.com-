export type ReportChronologicalEntry = {
  id: string;
  capturedAtIso: string;
  createdAtIso?: string | null;
};

function reportEntryTimestamp(entry: ReportChronologicalEntry): number {
  const capturedAt = new Date(entry.capturedAtIso).getTime();
  if (Number.isFinite(capturedAt)) return capturedAt;

  const createdAt = new Date(entry.createdAtIso ?? '').getTime();
  return Number.isFinite(createdAt) ? createdAt : Number.MAX_SAFE_INTEGER;
}

export function sortReportEntriesChronologically<T extends ReportChronologicalEntry>(entries: T[]): T[] {
  return entries.slice().sort((left, right) => {
    const timestampDifference = reportEntryTimestamp(left) - reportEntryTimestamp(right);
    if (timestampDifference) return timestampDifference;

    const createdAtDifference = String(left.createdAtIso ?? '').localeCompare(String(right.createdAtIso ?? ''));
    return createdAtDifference || String(left.id).localeCompare(String(right.id));
  });
}

export function reportYearInTimeZone(value: string, timeZone = 'Africa/Johannesburg'): number | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = Number(new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    timeZone,
  }).format(parsed));

  return Number.isInteger(year) ? year : null;
}
