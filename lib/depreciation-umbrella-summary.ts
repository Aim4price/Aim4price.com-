export type DepreciationUmbrellaEntry = {
  id: string;
  capturedAtIso: string;
  createdAtIso?: string | null;
  usageAmount: number | null;
  usageMetric: string;
  condition: string;
};

export type DepreciationUmbrellaLogSummary = {
  openingLogValueExVat: number | null;
  openingTimelineValueExVat: number | null;
  currentValueExVat: number | null;
  totalDifferenceExVat: number | null;
  totalMarketDepreciationExVat: number | null;
  totalMovementPercent: number | null;
  firstLogEntryDateIso: string | null;
  firstSnapshotDateIso: string | null;
  latestLogEntryDateIso: string | null;
  latestSnapshotDateIso: string | null;
  logEntryCount: number;
  snapshotCount: number;
  latestUsageAmount: number | null;
  latestUsageMetric: string;
  latestCondition: string;
  replacementPriceUsedExVat: number | null;
};

export type DepreciationUmbrellaAnnualSummary = {
  year: number;
  openingValueExVat: number | null;
  closingValueExVat: number | null;
  yearlyDifferenceExVat: number | null;
  yearlyDepreciationExVat: number | null;
  yearlyMovementPercent: number | null;
  logEntryCount: number;
  snapshotCount: number;
  latestUsageAmount: number | null;
  latestUsageMetric: string;
  latestCondition: string;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumRecordedValues(values: Array<number | null>): number | null {
  const recorded = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return recorded.length ? roundMoney(recorded.reduce((sum, value) => sum + value, 0)) : null;
}

function earliestDate(values: Array<string | null>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort()[0] ?? null;
}

function latestDate(values: Array<string | null>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function entryTimestamp(entry: DepreciationUmbrellaEntry): number {
  const captured = new Date(entry.capturedAtIso).getTime();
  if (Number.isFinite(captured)) return captured;
  const created = new Date(entry.createdAtIso ?? '').getTime();
  return Number.isFinite(created) ? created : Number.MIN_SAFE_INTEGER;
}

function latestEntry(entries: DepreciationUmbrellaEntry[]): DepreciationUmbrellaEntry | null {
  return entries.slice().sort((left, right) => {
    const timestampDifference = entryTimestamp(left) - entryTimestamp(right);
    return timestampDifference || String(left.id).localeCompare(String(right.id));
  }).at(-1) ?? null;
}

function reportYear(value: string): number | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const year = Number(new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  }).format(date));
  return Number.isInteger(year) ? year : null;
}

export function combineDepreciationUmbrellaLogSummaries(
  summaries: DepreciationUmbrellaLogSummary[],
  entries: DepreciationUmbrellaEntry[],
): DepreciationUmbrellaLogSummary {
  const openingValue = sumRecordedValues(summaries.map((summary) => summary.openingLogValueExVat));
  const currentValue = sumRecordedValues(summaries.map((summary) => summary.currentValueExVat));
  const totalDifference = openingValue !== null && currentValue !== null
    ? roundMoney(currentValue - openingValue)
    : sumRecordedValues(summaries.map((summary) => summary.totalDifferenceExVat));
  const totalMovementPercent = openingValue && openingValue > 0 && totalDifference !== null
    ? Math.round((totalDifference / openingValue) * 10000) / 100
    : null;
  const newest = latestEntry(entries);

  return {
    openingLogValueExVat: openingValue,
    openingTimelineValueExVat: openingValue,
    currentValueExVat: currentValue,
    totalDifferenceExVat: totalDifference,
    totalMarketDepreciationExVat: totalDifference,
    totalMovementPercent,
    firstLogEntryDateIso: earliestDate(summaries.map((summary) => summary.firstLogEntryDateIso)),
    firstSnapshotDateIso: earliestDate(summaries.map((summary) => summary.firstSnapshotDateIso)),
    latestLogEntryDateIso: latestDate(summaries.map((summary) => summary.latestLogEntryDateIso)),
    latestSnapshotDateIso: latestDate(summaries.map((summary) => summary.latestSnapshotDateIso)),
    logEntryCount: summaries.reduce((sum, summary) => sum + summary.logEntryCount, 0),
    snapshotCount: summaries.reduce((sum, summary) => sum + summary.snapshotCount, 0),
    latestUsageAmount: newest?.usageAmount ?? null,
    latestUsageMetric: newest?.usageMetric ?? '',
    latestCondition: newest?.condition ?? '',
    replacementPriceUsedExVat: sumRecordedValues(
      summaries.map((summary) => summary.replacementPriceUsedExVat),
    ),
  };
}

export function combineDepreciationUmbrellaAnnualSummaries(
  annualSummaries: DepreciationUmbrellaAnnualSummary[],
  entries: DepreciationUmbrellaEntry[],
): DepreciationUmbrellaAnnualSummary[] {
  const summariesByYear = new Map<number, DepreciationUmbrellaAnnualSummary[]>();
  annualSummaries.forEach((summary) => {
    const yearSummaries = summariesByYear.get(summary.year) ?? [];
    yearSummaries.push(summary);
    summariesByYear.set(summary.year, yearSummaries);
  });

  return Array.from(summariesByYear.entries())
    .sort(([leftYear], [rightYear]) => leftYear - rightYear)
    .map(([year, summaries]) => {
      const openingValue = sumRecordedValues(summaries.map((summary) => summary.openingValueExVat));
      const closingValue = sumRecordedValues(summaries.map((summary) => summary.closingValueExVat));
      const yearlyDifference = sumRecordedValues(summaries.map((summary) => summary.yearlyDifferenceExVat));
      const yearlyMovementPercent = openingValue && openingValue > 0 && yearlyDifference !== null
        ? Math.round((yearlyDifference / openingValue) * 10000) / 100
        : null;
      const newest = latestEntry(entries.filter((entry) => reportYear(entry.capturedAtIso) === year));

      return {
        year,
        openingValueExVat: openingValue,
        closingValueExVat: closingValue,
        yearlyDifferenceExVat: yearlyDifference,
        yearlyDepreciationExVat: yearlyDifference,
        yearlyMovementPercent,
        logEntryCount: summaries.reduce((sum, summary) => sum + summary.logEntryCount, 0),
        snapshotCount: summaries.reduce((sum, summary) => sum + summary.snapshotCount, 0),
        latestUsageAmount: newest?.usageAmount ?? null,
        latestUsageMetric: newest?.usageMetric ?? '',
        latestCondition: newest?.condition ?? '',
      };
    });
}
