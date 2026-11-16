/** Dates are calendar days in South Africa, independent of server timezone. */
export const usageToday = (now = new Date()) => new Date(now.getTime() + 7200000).toISOString().slice(0, 10);
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000;
export function validUsageDate(date: unknown, today = usageToday()): date is string {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= '1900-01-01' && date <= today &&
    Number.isFinite(dayNumber(date)) && new Date(dayNumber(date) * 86400000).toISOString().slice(0,10) === date;
}
export function validWorkingDays(days: unknown): days is number[] {
  return Array.isArray(days) && days.length > 0 && days.length <= 7 && new Set(days).size === days.length && days.every(d => Number.isInteger(d) && d >= 0 && d <= 6);
}
/** Count completed selected calendar days: [start, end). No daily increments to replay. */
export function workingDaysBetween(start: string, end: string, days: number[]): number {
  const count = Math.max(0, Math.floor(dayNumber(end) - dayNumber(start)));
  if (!Number.isFinite(count) || !validWorkingDays(days)) return 0;
  let total = Math.floor(count / 7) * days.length;
  const first = new Date(`${start}T00:00:00Z`).getUTCDay();
  for (let i = 0; i < count % 7; i++) if (days.includes((first + i) % 7)) total++;
  return total;
}
export function estimatedAverageUsage(baseline: number, baselineDate: string, dailyUsage: number, days: number[], today = usageToday()) {
  return Math.round((baseline + dailyUsage * workingDaysBetween(baselineDate, today, days)) * 100) / 100;
}
export function suggestedDailyUsage(reading: number, inService: string, readingDate: string, days: number[]) {
  const count = workingDaysBetween(inService, readingDate, days);
  return reading > 0 && count > 0 ? Math.round(reading / count * 100) / 100 : null;
}
export function estimatedServiceDate(reading: number, target: number, daily: number, days: number[], today = usageToday()): string | null {
  if (![reading,target,daily].every(Number.isFinite) || daily <= 0 || !validWorkingDays(days)) return null;
  if (target <= reading) return today;
  const needed = Math.ceil((target - reading) / daily);
  // Jump complete weeks, then at most one week. Cap forecasts at 100 years.
  let offset = Math.floor((needed - 1) / days.length) * 7, remaining = needed - Math.floor((needed - 1) / days.length) * days.length;
  if (offset > 36525) return null;
  const first = new Date(`${today}T00:00:00Z`).getUTCDay();
  while (remaining > 0) { if (days.includes((first + offset) % 7)) remaining--; offset++; }
  return new Date((dayNumber(today) + offset) * 86400000).toISOString().slice(0,10);
}
