import { getDb } from './db';

let ready: Promise<void> | undefined;
export function ensureBillingPreferences(): Promise<void> {
  if (!ready) ready = getDb().query(`
    create table if not exists aim4price_billing_preferences (
      user_id text primary key references "user"(id) on delete cascade,
      receive_emails boolean not null default true,
      updated_at timestamptz not null default now()
    )
  `).then(() => undefined).catch(error => { ready = undefined; throw error; });
  return ready;
}
export async function receivesBillingEmails(userId: string): Promise<boolean> {
  await ensureBillingPreferences();
  const result = await getDb().query('select receive_emails from aim4price_billing_preferences where user_id=$1', [userId]);
  return result.rows[0]?.receive_emails !== false;
}
export async function saveBillingEmailPreference(userId: string, enabled: boolean): Promise<void> {
  await ensureBillingPreferences();
  await getDb().query(`insert into aim4price_billing_preferences(user_id,receive_emails) values($1,$2)
    on conflict(user_id) do update set receive_emails=$2,updated_at=now()`, [userId, enabled]);
}
