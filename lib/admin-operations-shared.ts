export const ADMIN_ACCOUNT_STATUSES = ['all', 'pending_payment', 'active', 'suspended'] as const;
export type AdminAccountStatusFilter = (typeof ADMIN_ACCOUNT_STATUSES)[number];
export function adminAccountStatusFilter(value: unknown): AdminAccountStatusFilter {
  return ADMIN_ACCOUNT_STATUSES.includes(value as AdminAccountStatusFilter) ? value as AdminAccountStatusFilter : 'all';
}
export const ADMIN_QUEUE_FILTERS = ['open', 'all', 'unassigned', 'submitted', 'needs_matching', 'in_progress', 'needs_information', 'awaiting_owner', 'overdue', 'due_today', 'completed_today', 'completed', 'declined', 'rejected', 'cancelled'] as const;
export function adminQueueFilter(value: unknown): string {
  return ADMIN_QUEUE_FILTERS.includes(value as typeof ADMIN_QUEUE_FILTERS[number]) ? String(value) : 'open';
}
export const ADMIN_CAPTURE_PAGE_SIZE = 50;
export function johannesburgDayBounds(now = new Date()): { start: string; end: string } {
  const offset = 2 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offset);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset;
  return { start: new Date(start).toISOString(), end: new Date(start + 86400000).toISOString() };
}

// South Africa uses UTC+02:00 throughout the year. Use UTC calendar arithmetic
// on the shifted instant so browser/server timezones cannot change the period.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
export function adminSignupDateRange(filter: 'all' | 'week' | 'month' | 'year', now = new Date()): { start: Date; end: Date } | null {
  if (filter === 'all') return null;
  const local = new Date(now.getTime() + SAST_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  const midnight = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) - SAST_OFFSET_MS);
  if (filter === 'week') {
    const monday = day - (local.getUTCDay() + 6) % 7;
    return { start: midnight(year, month, monday), end: midnight(year, month, monday + 7) };
  }
  if (filter === 'month') return { start: midnight(year, month, 1), end: midnight(year, month + 1, 1) };
  return { start: midnight(year, 0, 1), end: midnight(year + 1, 0, 1) };
}

export function formatAdminAccountDate(value: string | null): string {
  const parsed = value ? new Date(value) : null;
  if (!parsed || !Number.isFinite(parsed.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg',
  }).format(parsed);
}

export function formatAdminLastActive(value: string | null, now = new Date()): string {
  const parsed = value ? new Date(value) : null;
  if (!parsed || !Number.isFinite(parsed.getTime())) return 'Never';
  const today = Date.parse(johannesburgDayBounds(now).start);
  const activeDay = Date.parse(johannesburgDayBounds(parsed).start);
  const days = (today - activeDay) / 86_400_000;
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return formatAdminAccountDate(value);
}
