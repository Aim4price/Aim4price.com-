'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { DealerMaintenanceNotification } from '../../../lib/dealer-maintenance-tracker';
import styles from '../../owner-app/owner-app.module.css';

function formatNotificationTime(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';

  const difference = Date.now() - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (difference < minute) return 'Just now';
  if (difference < hour) return `${Math.max(1, Math.round(difference / minute))} min ago`;
  if (difference < day) return `${Math.max(1, Math.round(difference / hour))} hr ago`;
  if (difference < 7 * day) return `${Math.max(1, Math.round(difference / day))} days ago`;

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

async function markNotificationsChecked(): Promise<void> {
  const response = await fetch('/api/dealer/maintenance/notifications', {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Could not mark notifications checked.');
  }
}

export default function DealerMaintenanceNotificationsClient({
  notifications,
}: {
  notifications: DealerMaintenanceNotification[];
}) {
  const [items, setItems] = useState<DealerMaintenanceNotification[]>(notifications);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');

  const newItems = useMemo(
    () => items.filter((notification) => !notification.isRead),
    [items],
  );
  const newCountLabel = `${newItems.length} new notification${newItems.length === 1 ? '' : 's'}`;

  async function handleMarkChecked() {
    if (!newItems.length || marking) return;
    setMarking(true);
    setError('');

    try {
      await markNotificationsChecked();
      setItems((current) => current.map((notification) => ({ ...notification, isRead: true })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark notifications checked.');
    } finally {
      setMarking(false);
    }
  }

  function handleNotificationOpen() {
    setItems((current) => current.map((notification) => ({ ...notification, isRead: true })));
    void markNotificationsChecked().catch(() => undefined);
  }

  return (
    <div className={`${styles.content} ${styles.notificationContent}`}>
      <section className={styles.notificationIntro}>
        <div className={styles.ownerPageIntro}>
          <h1 className={styles.ownerPageTitle}>Notifications</h1>
          <p className={styles.ownerPageSubtitle}>View all new messages.</p>
        </div>
        <button
          type="button"
          className={`${styles.markCheckedButton} ${newItems.length ? styles.markCheckedButtonNew : ''}`}
          onClick={() => void handleMarkChecked()}
          disabled={marking || newItems.length === 0}
          aria-label={newItems.length ? `Mark all ${newCountLabel} checked` : 'All notifications checked'}
        >
          <span aria-hidden="true">✓</span>
          {marking ? 'Marking…' : newItems.length ? 'Mark checked' : 'All checked'}
        </button>
      </section>

      {error ? (
        <div className={`${styles.errorNotice} ${styles.notificationError}`} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void handleMarkChecked()}>
            Try again
          </button>
        </div>
      ) : null}

      <section className={styles.notificationSection} aria-labelledby="dealer-new-notifications-title">
        <div className={`${styles.notificationSectionHeading} ${styles.ownerSectionHeading}`}>
          <h2 id="dealer-new-notifications-title">New</h2>
          <span aria-label={newCountLabel}>{newItems.length}</span>
        </div>

        {newItems.length ? (
          <div className={styles.notificationList} aria-live="polite">
            {newItems.map((notification) => (
              <Link
                key={notification.id}
                href={`/dealer/maintenance/${encodeURIComponent(notification.accessId)}`}
                className={`${styles.notificationCard} ${styles.notificationCardNew}`}
                prefetch={false}
                onClick={handleNotificationOpen}
              >
                <div className={styles.notificationCardLabels}>
                  <span className={styles.notificationKind}>
                    <i className={styles.notificationDot} aria-hidden="true" />
                    New
                  </span>
                  <time dateTime={notification.createdAtIso}>
                    {formatNotificationTime(notification.createdAtIso)}
                  </time>
                </div>
                <h3>{notification.title}</h3>
                <p>{notification.body}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className={styles.notificationEmpty} aria-live="polite">
            You’re all caught up. New notifications will appear here.
          </p>
        )}
      </section>
    </div>
  );
}
