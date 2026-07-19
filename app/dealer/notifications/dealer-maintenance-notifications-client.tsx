'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { DealerMaintenanceNotification } from '../../../lib/dealer-maintenance-tracker';
import styles from '../maintenance/maintenance-tracker.module.css';

function dateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

export default function DealerMaintenanceNotificationsClient({ notifications }: { notifications: DealerMaintenanceNotification[] }) {
  useEffect(() => { void fetch('/api/dealer/maintenance/notifications', { method: 'POST', credentials: 'include' }); }, []);
  return (
    <main className={styles.notificationPage}>
      <header className={styles.pageIntro}><h1>Notifications</h1><p>Maintenance alerts for assets tracked by your dealership.</p></header>
      {!notifications.length ? <div className={styles.emptyState}><strong>No maintenance notifications.</strong><span>New alerts will appear when a tracked asset enters its saved maintenance range.</span></div> : (
        <section className={styles.notificationList}>
          {notifications.map((notification) => (
            <Link key={notification.id} href={`/dealer/maintenance/${encodeURIComponent(notification.accessId)}`} className={`${styles.notificationCard} ${notification.isRead ? '' : styles.notificationUnread}`} prefetch={false}>
              <span className={styles.notificationMark} aria-hidden="true" />
              <div><strong>{notification.title}</strong><p>{notification.body}</p><time>{dateTime(notification.createdAtIso)}</time></div>
              <span className={styles.notificationArrow} aria-hidden="true">›</span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
