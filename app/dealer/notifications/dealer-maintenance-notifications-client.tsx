'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { DealerMaintenanceNotification } from '../../../lib/dealer-maintenance-tracker';
import styles from '../../owner-app/owner-app.module.css';

function formatNotificationTime(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

async function markNotificationsChecked(notificationIds: string[]): Promise<void> {
  if (!notificationIds.length) return;
  const response = await fetch('/api/dealer/maintenance/notifications', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notificationIds }),
  });
  if (!response.ok) throw new Error('Could not mark notifications checked.');
}

export default function DealerMaintenanceNotificationsClient({
  notifications,
}: {
  notifications: DealerMaintenanceNotification[];
}) {
  const [items, setItems] = useState<DealerMaintenanceNotification[]>(notifications);
  const [activeView, setActiveView] = useState<'active' | 'history'>(
    notifications.some((notification) => !notification.isRead) ? 'active' : 'history',
  );
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');

  const newItems = useMemo(() => items.filter((notification) => !notification.isRead), [items]);
  const historyItems = useMemo(() => items.filter((notification) => notification.isRead), [items]);
  const visibleItems = useMemo(
    () => activeView === 'active' ? newItems : historyItems,
    [activeView, historyItems, newItems],
  );

  async function handleMarkChecked() {
    if (!newItems.length || marking) return;
    setMarking(true);
    setError('');

    try {
      const notificationIds = newItems.map((notification) => notification.id);
      await markNotificationsChecked(notificationIds);
      setItems((current) => current.map((notification) => (
        notificationIds.includes(notification.id)
          ? { ...notification, isRead: true }
          : notification
      )));
      setActiveView('history');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark notifications checked.');
    } finally {
      setMarking(false);
    }
  }

  function handleNotificationOpen(notification: DealerMaintenanceNotification) {
    if (notification.isRead) return;
    setItems((current) => current.map((item) => (
      item.id === notification.id ? { ...item, isRead: true } : item
    )));
    void markNotificationsChecked([notification.id]).catch(() => undefined);
  }

  return (
    <div className={`${styles.content} ${styles.notificationContent}`}>
      <section className={styles.notificationIntro}>
        <div className={styles.ownerPageIntro}>
          <h1 className={styles.ownerPageTitle}>Notifications</h1>
          <p className={styles.ownerPageSubtitle}>Maintenance updates and history.</p>
        </div>
      </section>

      <section className={styles.notificationWorkspace} aria-label="Notification controls">
        <div className={`${styles.notificationTabs} ${styles.notificationTabsTwo}`} role="tablist" aria-label="Notification sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'active'}
            className={activeView === 'active' ? styles.notificationTabActive : ''}
            onClick={() => setActiveView('active')}
          >
            <span>Active</span>
            <strong>{newItems.length}</strong>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'history'}
            className={activeView === 'history' ? styles.notificationTabActive : ''}
            onClick={() => setActiveView('history')}
          >
            <span>History</span>
            <strong>{historyItems.length}</strong>
          </button>
        </div>

        {activeView === 'active' && newItems.length > 0 ? (
          <div className={styles.notificationBulkActions} aria-label="Notification actions">
            <button
              type="button"
              onClick={() => void handleMarkChecked()}
              disabled={marking || newItems.length === 0}
            >
              {marking ? 'Marking…' : 'Mark all checked'}
            </button>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className={`${styles.errorNotice} ${styles.notificationError}`} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void handleMarkChecked()}>Try again</button>
        </div>
      ) : null}

      <section className={styles.notificationSection} aria-labelledby="dealer-notifications-title">
        <div className={`${styles.notificationSectionHeading} ${styles.ownerSectionHeading}`}>
          <h2 id="dealer-notifications-title">
            {activeView === 'active' ? 'Active' : 'History'}
          </h2>
          <span aria-label={`${visibleItems.length} notifications`}>{visibleItems.length}</span>
        </div>

        {visibleItems.length ? (
          <div className={styles.notificationList} aria-live="polite">
            {visibleItems.map((notification) => (
              <Link
                key={notification.id}
                href={`/dealer/maintenance/${encodeURIComponent(notification.accessId)}`}
                className={[
                  styles.notificationCard,
                  notification.isRead ? styles.notificationCardHistory : styles.notificationCardNew,
                ].join(' ')}
                prefetch={false}
                onClick={() => handleNotificationOpen(notification)}
              >
                <time className={styles.notificationCardTime} dateTime={notification.createdAtIso}>
                  {formatNotificationTime(notification.createdAtIso)}
                </time>
                <h3>{notification.title}</h3>
                <p>{notification.body}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className={styles.notificationEmpty} aria-live="polite">
            {activeView === 'active'
              ? 'You’re all caught up. Active notifications will appear here.'
              : 'Checked maintenance notifications will appear here.'}
          </p>
        )}
      </section>
    </div>
  );
}
