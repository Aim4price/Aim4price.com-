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

async function markNotificationsChecked(): Promise<void> {
  const response = await fetch('/api/dealer/maintenance/notifications', {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Could not mark notifications checked.');
}

export default function DealerMaintenanceNotificationsClient({
  notifications,
}: {
  notifications: DealerMaintenanceNotification[];
}) {
  const [items, setItems] = useState<DealerMaintenanceNotification[]>(notifications);
  const [activeView, setActiveView] = useState<'new' | 'history'>(
    notifications.some((notification) => !notification.isRead) ? 'new' : 'history',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');

  const newItems = useMemo(() => items.filter((notification) => !notification.isRead), [items]);
  const historyItems = useMemo(() => items.filter((notification) => notification.isRead), [items]);
  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const source = query ? items : activeView === 'new' ? newItems : historyItems;
    if (!query) return source;

    return source.filter((notification) => (
      [notification.title, notification.body, notification.status]
        .join(' ')
        .toLowerCase()
        .includes(query)
    ));
  }, [activeView, historyItems, items, newItems, searchQuery]);

  async function handleMarkChecked() {
    if (!newItems.length || marking) return;
    setMarking(true);
    setError('');

    try {
      await markNotificationsChecked();
      setItems((current) => current.map((notification) => ({ ...notification, isRead: true })));
      setActiveView('history');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark notifications checked.');
    } finally {
      setMarking(false);
    }
  }

  function handleNotificationOpen(notification: DealerMaintenanceNotification) {
    if (notification.isRead) return;
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    void markNotificationsChecked().catch(() => undefined);
  }

  return (
    <div className={`${styles.content} ${styles.notificationContent}`}>
      <section className={styles.notificationIntro}>
        <div className={styles.ownerPageIntro}>
          <h1 className={styles.ownerPageTitle}>Notifications</h1>
          <p className={styles.ownerPageSubtitle}>Maintenance alerts and checked history.</p>
        </div>
      </section>

      <section className={styles.notificationWorkspace} aria-label="Notification controls">
        <label className={styles.notificationSearch}>
          <span className="sr-only">Search maintenance notifications</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search assets or maintenance alerts…"
          />
          {searchQuery ? (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear notification search">×</button>
          ) : null}
        </label>

        <div className={`${styles.notificationTabs} ${styles.notificationTabsTwo}`} role="tablist" aria-label="Notification sections">
          <button
            type="button"
            role="tab"
            aria-selected={!searchQuery && activeView === 'new'}
            className={!searchQuery && activeView === 'new' ? styles.notificationTabActive : ''}
            onClick={() => {
              setSearchQuery('');
              setActiveView('new');
            }}
          >
            <span>New</span>
            <strong>{newItems.length}</strong>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!searchQuery && activeView === 'history'}
            className={!searchQuery && activeView === 'history' ? styles.notificationTabActive : ''}
            onClick={() => {
              setSearchQuery('');
              setActiveView('history');
            }}
          >
            <span>History</span>
            <strong>{historyItems.length}</strong>
          </button>
        </div>

        <div className={styles.notificationBulkActions}>
          <p>Checked maintenance alerts remain searchable in History.</p>
          {!searchQuery && activeView === 'new' ? (
            <div>
              <button
                type="button"
                onClick={() => void handleMarkChecked()}
                disabled={marking || newItems.length === 0}
              >
                {marking ? 'Marking…' : 'Mark checked'}
              </button>
            </div>
          ) : null}
        </div>
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
            {searchQuery ? 'Search results' : activeView === 'new' ? 'New' : 'History'}
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
                <div className={styles.notificationCardLabels}>
                  <span className={styles.notificationKind}>
                    <i className={styles.notificationDot} aria-hidden="true" />
                    {notification.isRead ? 'Checked' : 'New'}
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
            {searchQuery
              ? 'No maintenance notifications match your search.'
              : activeView === 'new'
                ? 'You’re all caught up. New notifications will appear here.'
                : 'Checked maintenance notifications will appear here.'}
          </p>
        )}
      </section>
    </div>
  );
}
