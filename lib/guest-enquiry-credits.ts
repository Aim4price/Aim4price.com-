import { getDb } from './db';
import { ensureGuestLeadSchema } from './guest-lead-schema';
import { getGuestViewer } from './guest-business-access';

export function guestCreditLimit(): number | null {
  const value = process.env.AIM4PRICE_GUEST_ENQUIRY_CREDITS;
  if (!value) return null; // Display x until the allowance is agreed; record usage now.
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid guest credit configuration.');
  return Number(value);
}
export async function guestEnquiryAccess(token: string, recipientEmail: string, recipientUserId?: string) {
  const guest = await getGuestViewer();
  if (!guest) return { access: 'sign-in' as const };
  if (!recipientEmail || recipientUserId || guest.email !== recipientEmail.toLowerCase()) return { access: 'wrong-recipient' as const };
  if (guest.suspended) return { access: 'suspended' as const };
  await ensureGuestLeadSchema();
  const db = await getDb().connect();
  try {
    await db.query('BEGIN');
    const row = (await db.query('SELECT suspended FROM guest_businesses WHERE email=$1 FOR UPDATE', [guest.email])).rows[0];
    if (!row || row.suspended) { await db.query('ROLLBACK'); return {access:'suspended' as const}; }
    // Guest sessions must not bypass a suspension on a registered account.
    const blocked = await db.query(`SELECT 1 FROM account_profiles p JOIN "user" u ON u.id=p.user_id WHERE lower(u.email)=$1 AND p.account_status='suspended'`, [guest.email]);
    if (blocked.rows.length) { await db.query('ROLLBACK'); return {access:'suspended' as const}; }
    const valid = await db.query(`SELECT token FROM asset_share_links s WHERE token=$1 AND revoked_at IS NULL AND lower(lead_details->>'recipientEmail')=$2 AND coalesce(lead_details->>'recipientUserId','')='' AND NOT EXISTS(SELECT 1 FROM unnest(s.asset_ids) a(id) WHERE NOT EXISTS(SELECT 1 FROM asset_register_items i WHERE i.id=a.id AND i.user_id=s.user_id))`, [token,guest.email]);
    if (!valid.rows.length) { await db.query('ROLLBACK'); return {access:'wrong-recipient' as const}; }
    const used = Number((await db.query('SELECT count(*) AS count FROM guest_enquiry_usage WHERE email=$1',[guest.email])).rows[0].count);
    const seen = (await db.query('SELECT 1 FROM guest_enquiry_usage WHERE email=$1 AND token=$2',[guest.email,token])).rows.length > 0;
    const limit = guestCreditLimit();
    if (!seen && limit !== null && used >= limit) { await db.query('COMMIT'); return {access:'signup-required' as const,used,limit}; }
    if (!seen) await db.query('INSERT INTO guest_enquiry_usage(email,token) VALUES($1,$2) ON CONFLICT DO NOTHING',[guest.email,token]);
    await db.query('COMMIT');
    return {access:'guest' as const,used:used+(seen?0:1),limit};
  } catch(e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
