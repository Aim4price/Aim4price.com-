import { getDb } from './db';
import { ensureBillingSchema } from './billing';
import { money, billingDate, dateKey } from './billing-shared';
import type { HeaderNotificationItem } from './notifications';

export async function listBillingNotifications(userId: string): Promise<HeaderNotificationItem[]> {
  await ensureBillingSchema();
  const rows = (await getDb().query(`select id,number,total_cents,paid_cents,due_date,issued_at
    from aim4price_billing_invoices where user_id=$1 and status='issued'
    order by issued_at desc limit 100`, [userId])).rows;
  const today = dateKey();
  return rows.map(row => {
    const total = Number(row.total_cents);
    const paid = Number(row.paid_cents || 0);
    const balance = Math.max(0, total - paid);
    const dueDate = typeof row.due_date === 'string' ? row.due_date.slice(0, 10) : dateKey(row.due_date);
    const overdue = balance > 0 && dueDate < today;
    const dueToday = balance > 0 && dueDate === today;
    return {
      id: `billing-invoice:${row.id}`, category: 'billing',
      tone: balance === 0 ? 'success' : overdue || dueToday ? 'warning' : 'info',
      title: balance === 0 ? 'Invoice paid' : overdue ? 'Invoice overdue' : dueToday ? 'Invoice payment due today' : 'Invoice issued',
      body: balance === 0
        ? `${row.number} · ${money(total)} · Paid in full.`
        : `${row.number} · ${money(balance)} outstanding${paid > 0 ? ` of ${money(total)}` : ''} · ${overdue ? 'Was due' : 'Due'} ${billingDate(dueDate)}. Open Billing to view the invoice.`,
      href: '/billing', createdAtIso: new Date(row.issued_at).toISOString(), actionRequired: false,
    } satisfies HeaderNotificationItem;
  });
}
