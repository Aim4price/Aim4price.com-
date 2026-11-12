import { getDb } from './db';

let ready: Promise<void> | undefined;
export function ensureBillingPreferences(): Promise<void> {
  if (!ready) ready = (async () => {
    await getDb().query(`create table if not exists aim4price_billing_preferences (
      user_id text primary key references "user"(id) on delete cascade,
      receive_emails boolean not null default true,
      updated_at timestamptz not null default now()
    )`);
    await getDb().query(`alter table aim4price_billing_preferences add column if not exists use_business_email boolean not null default false`);
  })().catch(error => { ready = undefined; throw error; });
  return ready;
}
export async function getBillingEmailPreference(userId: string) {
  await ensureBillingPreferences();
  const result = await getDb().query(`select u.email as account_email, p.marketplace_email as business_email, b.use_business_email
    from "user" u left join account_profiles p on p.user_id=u.id
    left join aim4price_billing_preferences b on b.user_id=u.id where u.id=$1`, [userId]);
  const row = result.rows[0];
  const accountEmail = String(row?.account_email || '').trim();
  const businessEmail = String(row?.business_email || '').trim();
  const useBusinessEmail = row?.use_business_email === true;
  return { useBusinessEmail, accountEmail, businessEmail, billingEmail: useBusinessEmail && businessEmail ? businessEmail : accountEmail };
}
export async function saveBillingEmailPreference(userId: string, useBusinessEmail: boolean): Promise<void> {
  await ensureBillingPreferences();
  await getDb().query(`insert into aim4price_billing_preferences(user_id,use_business_email) values($1,$2)
    on conflict(user_id) do update set use_business_email=$2,receive_emails=true,updated_at=now()`, [userId, useBusinessEmail]);
}
