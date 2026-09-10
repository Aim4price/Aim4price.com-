import Link from 'next/link';
import NotificationSettingsModal from '../../../components/NotificationSettingsModal';
import { redirect } from 'next/navigation';
import { currentPushIdentity, resolvePushAccess } from '../../../lib/push-access';
import { listPushEvents } from '../../../lib/push-events';
import styles from '../../../components/PhoneNotificationSettings.module.css';
export const dynamic = 'force-dynamic';
export default async function MiddlemanNotificationsPage() {
  const who = await currentPushIdentity();
  if (!who || who.app !== 'middleman') redirect('/middleman/login');
  const access = await resolvePushAccess(who);
  if (!access) redirect('/middleman/login');
  const events = await listPushEvents(who,access);
  return <main className={styles.panel}><div className={styles.titleRow}><h1>Notifications</h1><NotificationSettingsModal app="middleman" /></div>
    {events.length ? events.map(event=><article key={event.id}><h2>{event.title}</h2><p>{event.body}</p>
      <Link className={styles.button} href={event.href}>View</Link></article>) : <p>No notifications yet.</p>}
  </main>;
}
