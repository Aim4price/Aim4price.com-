import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentPushIdentity, resolvePushAccess } from '../../../lib/push-access';
import { listPushEvents } from '../../../lib/push-events';
import styles from '../../owner-app/owner-app.module.css';
import appStyles from '../../dealer/dealer.module.css';
export const dynamic = 'force-dynamic';
export default async function MiddlemanNotificationsPage() {
  const who = await currentPushIdentity();
  if (!who || who.app !== 'middleman') redirect('/middleman/login');
  const access = await resolvePushAccess(who);
  if (!access) redirect('/middleman/login');
  const events = await listPushEvents(who,access);
  return (
    <main className={`${appStyles.module} ${appStyles.notificationOwnerPage}`}>
      <div className={`${styles.content} ${styles.notificationContent}`}>
        <section className={styles.notificationIntro}>
          <div className={styles.ownerPageIntro}>
            <h1 className={styles.ownerPageTitle}>Notifications</h1>
            <p className={styles.ownerPageSubtitle}>Updates that need your attention.</p>
          </div>
        </section>
        <section className={styles.notificationSection} aria-label="Notifications">
          {events.length ? <div className={styles.notificationList}>
            {events.map(event => (
              <Link key={event.id} className={`${styles.notificationCard} ${styles.notificationCardNew}`}
                href={event.href} prefetch={false}>
                <h3>{event.title}</h3>
                <p>{event.body}</p>
              </Link>
            ))}
          </div> : <p className={styles.notificationEmpty}>No notifications yet.</p>}
        </section>
      </div>
    </main>
  );
}
