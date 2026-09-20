import { AIM4PRICE_ADMIN_EMAIL } from './account-constants';
import { ensureAccountProfileColumns } from './account-profile';
import { getCaptureQueueCounts } from './capture-requests';
import { getDb } from './db';

export type AdminAttentionItem = { label: string; count: number | null; href: string; description: string; urgent?: boolean };
async function pendingAccounts(): Promise<number> {
  await ensureAccountProfileColumns();
  const result = await getDb().query<{ count: string }>(`
    select count(*)::text as count from "user" u
    left join account_profiles ap on ap.user_id = u.id
    where lower(trim(coalesce(u.email, ''))) <> $1
      and coalesce(ap.account_status, 'pending_payment') = 'pending_payment'
  `, [AIM4PRICE_ADMIN_EMAIL]);
  return Number(result.rows[0]?.count ?? 0);
}
export async function getAdminAttention(): Promise<AdminAttentionItem[]> {
  const [accounts, queue] = await Promise.allSettled([pendingAccounts(), getCaptureQueueCounts()]);
  // A failed source is unavailable, never a misleading zero or an all-clear.
  if (accounts.status === 'rejected') console.error('Admin attention accounts unavailable', accounts.reason);
  if (queue.status === 'rejected') console.error('Admin attention queue unavailable', queue.reason);
  const counts = queue.status === 'fulfilled' ? queue.value : null;
  return [
    { label: 'Pending accounts', count: accounts.status === 'fulfilled' ? accounts.value : null, href: '/admin?status=pending_payment', description: 'Review access before activating.' },
    { label: 'Overdue capture', count: counts?.overdue ?? null, href: '/admin/capture-queue?status=overdue', description: 'Open requests past their deadline.', urgent: true },
    { label: 'Unclaimed capture', count: counts?.unassigned ?? null, href: '/admin/capture-queue?status=unassigned', description: 'Open requests without an assigned admin.' },
    { label: 'Needs matching', count: counts?.needsMatching ?? null, href: '/admin/capture-queue?status=needs_matching', description: 'Confirm the customer and destination.' },
    { label: 'Needs information', count: counts?.needsInformation ?? null, href: '/admin/capture-queue?status=needs_information', description: 'Follow up on missing document details.' },
    { label: 'Awaiting owner', count: counts?.awaitingOwner ?? null, href: '/admin/capture-queue?status=awaiting_owner', description: 'Captured documents awaiting owner review.' },
  ];
}
