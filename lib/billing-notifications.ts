import { getDb } from './db';
import { ensureBillingSchema } from './billing';
import { money, billingDate } from './billing-shared';
import type { HeaderNotificationItem } from './notifications';

export async function listBillingNotifications(userId:string):Promise<HeaderNotificationItem[]> {
 await ensureBillingSchema();
 const rows=(await getDb().query(`select id,number,total_cents,due_date,issued_at from aim4price_billing_invoices where user_id=$1 and status='issued' order by issued_at desc limit 100`,[userId])).rows;
 return rows.map(row=>({id:`billing-invoice:${row.id}`,category:'billing',tone:'info',title:'New Aim4price.com invoice',body:`${row.number} · ${money(Number(row.total_cents))} · Due ${billingDate(typeof row.due_date==='string'?row.due_date:row.due_date.toISOString())}`,href:'/billing',createdAtIso:new Date(row.issued_at).toISOString(),actionRequired:false}));
}
