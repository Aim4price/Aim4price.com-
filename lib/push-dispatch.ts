import { notificationDeliveryPlan } from './notification-delivery-plan';
import { getDb } from './db';
import { ensurePushTables, sendPhonePush, pushPreferences, type PushIdentity } from './push-store';
import { resolvePushAccess } from './push-access';
import { listPushEvents } from './push-events';
import { PUSH_APPS, safePushHref } from './push-policy';
export async function dispatchPhoneNotifications() {
  await ensurePushTables();
  const client = await getDb().connect();
  try {
    const lock = await client.query('select pg_try_advisory_lock(417209,1) as acquired');
    if (!lock.rows[0].acquired) return;
    try {
      // Keep valid subscriptions until disabled, revoked or rejected by the provider.
      const devices = await client.query(`select * from app_push_devices where enabled=true order by checked_at,id limit 20`);
      for (const device of devices.rows) {
        await client.query('update app_push_devices set checked_at=now() where id=$1', [device.id]);
        const who: PushIdentity = { app: device.app, accountId: device.account_id, memberId: device.member_id, version: device.version };
        try {
          const access = await resolvePushAccess(who);
          if (!access) { await client.query('delete from app_push_devices where id=$1', [device.id]); continue; }
          const preferences = await pushPreferences(who);
          const events = await listPushEvents(who,access);
          const delivered = await client.query('select event_id from app_push_deliveries where device_id=$1', [device.id]);
          const sent = new Set<string>(delivered.rows.map(row => String(row.event_id)));
          const batches = notificationDeliveryPlan(events,sent,preferences,new Date(device.created_at),who.app);
          for (const {event,ids} of batches) {
            // Re-check the device after event computation so a disabled phone is not sent another alert.
            const active = await client.query('select id from app_push_devices where id=$1 and enabled=true', [device.id]);
            if (!active.rowCount) break;
            const latest = await pushPreferences(who);
            if (!latest[event.category]) continue;
            try {
              await sendPhonePush(device.subscription, { deviceId: device.id, category: event.category, title: event.title, body: event.body,
                href: safePushHref(who.app,event.href), icon: PUSH_APPS[who.app].icon, tag: `${who.app}:${event.id}` });
              for (const id of ids) await client.query('insert into app_push_deliveries(device_id,event_id) values($1,$2) on conflict do nothing', [device.id,id]);
            } catch(error) {
              const status = (error as { statusCode?: number }).statusCode;
              if (status === 404 || status === 410) await client.query('delete from app_push_devices where id=$1', [device.id]);
              // Transient failures retry on a later tick. Never log subscription URLs or keys.
              break;
            }
          }
        } catch { console.warn('Phone notification check failed; will retry.'); }
      }
    } finally { await client.query('select pg_advisory_unlock(417209,1)'); }
  } finally { client.release(); }
}

