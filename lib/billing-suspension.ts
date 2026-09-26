import { getDb } from './db';
import { ensureAccountProfileColumns } from './account-profile';
import { isAim4priceAdminEmail } from './account-constants';
import { BillingError, billingId, ensureBillingSchema, mapInvoice } from './billing';

export async function suspendBillingAccount(input: Record<string, unknown>, actor: string) {
  const id = billingId(input.id);
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 5 || reason.length > 500) throw new BillingError('Enter a clear suspension reason between 5 and 500 characters.');
  await Promise.all([ensureBillingSchema(), ensureAccountProfileColumns()]);
  const db = await getDb().connect();
  try {
    await db.query('begin');
    const invoice = (await db.query('select * from aim4price_billing_invoices where id=$1 for update', [id])).rows[0];
    if (!invoice || invoice.status !== 'issued' || !invoice.user_id || Number(invoice.paid_cents) >= Number(invoice.total_cents)) throw new BillingError('Select an issued invoice with an outstanding balance.');
    if (input.version !== invoice.version) throw new BillingError('This invoice changed. Refresh before suspending the account.');
    const user = (await db.query('select id,email from "user" where id=$1', [invoice.user_id])).rows[0];
    if (!user || user.id === actor || isAim4priceAdminEmail(user.email)) throw new BillingError('Admin accounts and your own account cannot be suspended from billing.');
    const profile = (await db.query('select account_status from account_profiles where user_id=$1 for update', [user.id])).rows[0];
    if (!profile) throw new BillingError('Complete the account profile before changing access.');
    if (input.accountStatus !== profile.account_status) throw new BillingError('Account access changed. Refresh before updating the suspension.');
    await db.query("update account_profiles set account_status='suspended',suspension_reason=$2,billing_suspension_invoice_id=$3,updated_at=now() where user_id=$1", [user.id, reason, id]);
    await db.query('insert into aim4price_billing_events(invoice_id,actor_id,action,detail) values($1,$2,$3,$4)', [id, actor, profile.account_status === 'suspended' ? 'account_suspension_updated' : 'account_suspended', reason]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
  finally { db.release(); }
}

/** Only called with the authenticated user's ID. Never exposes another account's invoice. */
export async function getBillingSuspension(userId: string) {
  await Promise.all([ensureBillingSchema(), ensureAccountProfileColumns()]);
  const row = (await getDb().query(`select i.*,p.suspension_reason from account_profiles p
    join aim4price_billing_invoices i on i.id=p.billing_suspension_invoice_id and i.user_id=p.user_id
    where p.user_id=$1 and p.account_status='suspended' and i.status<>'draft'`, [userId])).rows[0];
  return row ? { reason: String(row.suspension_reason || 'Please contact Aim4price to review your account access.'), invoice: mapInvoice(row) } : null;
}
