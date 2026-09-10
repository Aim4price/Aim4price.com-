import { randomUUID } from 'node:crypto';
import webpush from 'web-push';
import { getDb } from './db';
import { DEFAULT_PUSH_PREFERENCES, type PushApp, type PushPreferences, type BrowserPushSubscription } from './push-policy';
export type PushIdentity = { app: PushApp; accountId: string; memberId: string; version: number };
export type PushDevice = PushIdentity & { id: string; subscription: BrowserPushSubscription; preferences: PushPreferences; enabled: boolean; created_at: Date; last_test_at: Date | null };
let ready: Promise<void> | undefined;
export function ensurePushTables() {
  if (!ready) ready = (async () => {
    await getDb().query(`
      create table if not exists app_push_keys (id integer primary key check(id=1), public_key text not null, private_key text not null);
      create table if not exists app_push_preferences (
        app text not null, account_id text not null, member_id text not null, preferences jsonb not null,
        primary key(app, account_id, member_id));
      create table if not exists app_push_devices (
        id uuid primary key, app text not null check(app in ('owner','dealer','middleman')),
        account_id text not null, member_id text not null, version integer not null,
        endpoint text not null unique, subscription jsonb not null, enabled boolean not null default true,
        created_at timestamptz not null default now(), checked_at timestamptz not null default now(), last_test_at timestamptz);
      create index if not exists app_push_devices_recipient on app_push_devices(app,account_id,member_id);
      create table if not exists app_push_deliveries (
        device_id uuid not null references app_push_devices(id) on delete cascade,
        event_id text not null, sent_at timestamptz not null default now(), primary key(device_id,event_id));
    `);
    const keys = webpush.generateVAPIDKeys();
    await getDb().query('insert into app_push_keys(id,public_key,private_key) values(1,$1,$2) on conflict do nothing', [keys.publicKey, keys.privateKey]);
  })().catch(error => { ready = undefined; throw error; });
  return ready;
}
export async function pushKeys() {
  await ensurePushTables();
  const r = await getDb().query<{ public_key: string; private_key: string }>('select public_key,private_key from app_push_keys where id=1');
  return r.rows[0];
}
export async function pushPreferences(who: PushIdentity): Promise<PushPreferences> {
  await ensurePushTables();
  const r = await getDb().query('select preferences from app_push_preferences where app=$1 and account_id=$2 and member_id=$3', [who.app, who.accountId, who.memberId]);
  return r.rows[0]?.preferences ?? { ...DEFAULT_PUSH_PREFERENCES };
}
export async function savePushPreferences(who: PushIdentity, preferences: PushPreferences) {
  await ensurePushTables();
  await getDb().query(`insert into app_push_preferences values($1,$2,$3,$4::jsonb)
    on conflict(app,account_id,member_id) do update set preferences=excluded.preferences`, [who.app,who.accountId,who.memberId,JSON.stringify(preferences)]);
}
export async function getPushDevice(who: PushIdentity, id: string | undefined) {
  await ensurePushTables();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await getDb().query(`select * from app_push_devices where id=$1 and app=$2 and account_id=$3 and member_id=$4 and version=$5`, [id,who.app,who.accountId,who.memberId,who.version]);
  return r.rows[0] ?? null;
}
export async function registerPushDevice(who: PushIdentity, subscription: BrowserPushSubscription): Promise<string> {
  await ensurePushTables();
  const id = randomUUID();
  // Rebinding replaces the old device and its delivery history atomically; never shares an endpoint across accounts.
  const client = await getDb().connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [subscription.endpoint]);
    await client.query('delete from app_push_devices where endpoint=$1', [subscription.endpoint]);
    const count = await client.query('select count(*)::int as n from app_push_devices where app=$1 and account_id=$2 and member_id=$3', [who.app,who.accountId,who.memberId]);
    if (count.rows[0].n >= 10) throw new Error('Remove an old phone before adding another.');
    await client.query(`insert into app_push_devices(id,app,account_id,member_id,version,endpoint,subscription)
      values($1,$2,$3,$4,$5,$6,$7::jsonb)`, [id,who.app,who.accountId,who.memberId,who.version,subscription.endpoint,JSON.stringify(subscription)]);
    await client.query('commit');
    return id;
  } catch(error) { await client.query('rollback'); throw error; } finally { client.release(); }
}
export async function removePushDevice(app: PushApp, id: string | undefined) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
  await ensurePushTables();
  await getDb().query('delete from app_push_devices where id=$1 and app=$2', [id,app]);
}
export async function sendPhonePush(subscription: BrowserPushSubscription, payload: object) {
  const keys = await pushKeys();
  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    vapidDetails: { subject: 'https://www.aim4price.com', publicKey: keys.public_key, privateKey: keys.private_key },
    TTL: 300, timeout: 8000, urgency: 'normal',
  });
}
