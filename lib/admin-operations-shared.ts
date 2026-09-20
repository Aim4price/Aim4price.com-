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
