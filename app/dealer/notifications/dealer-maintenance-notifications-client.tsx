'use client';
import NotificationSettingsModal from '../../../components/NotificationSettingsModal';
import notificationSettingsStyles from '../../../components/PhoneNotificationSettings.module.css';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { DealerMaintenanceViewerNotification } from '../../../lib/dealer-maintenance-notification-inbox';
import styles from '../../owner-app/owner-app.module.css';
import dealerNotificationStyles from './dealer-notifications.module.css';

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

type ClearRequest = {
  ids: string[];
  bulk: boolean;
};

export default function DealerMaintenanceNotificationsClient({
  notifications,
}: {
  notifications: DealerMaintenanceViewerNotification[];
}) {
  const [items, setItems] = useState<DealerMaintenanceViewerNotification[]>(notifications);
  const [activeView, setActiveView] = useState<'active' | 'history'>(
    notifications.some((notification) => !notification.isRead) ? 'active' : 'history',
  );
  const [marking, setMarking] = useState(false);
  const [clearRequest, setClearRequest] = useState<ClearRequest | null>(null);
  const [error, setError] = useState('');

  const newItems = useMemo(() => items.filter((notification) => !notification.isRead), [items]);
  const historyItems = useMemo(() => items.filter((notification) => notification.isRead), [items]);
  const visibleItems = useMemo(
    () => activeView === 'active' ? newItems : historyItems,
    [activeView, historyItems, newItems],
  );

  async function clearNotifications(notificationIds: string[], moveToHistory = false) {
    if (!notificationIds.length || marking) return;
    setMarking(true);
    setError('');

    try {
      await markNotificationsChecked(notificationIds);
      const clearedIds = new Set(notificationIds);
      setItems((current) => current.map((notification) => (
        clearedIds.has(notification.id)
          ? { ...notification, isRead: true }
          : notification
      )));
      if (moveToHistory) setActiveView('history');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark notifications checked.');
    } finally {
      setMarking(false);
    }
  }

  function handleMarkChecked() {
    if (!newItems.length || marking) return;
    const notificationIds = newItems.map((notification) => notification.id);
    if (newItems.some((notification) => notification.assignedToViewer)) {
      setClearRequest({ ids: notificationIds, bulk: true });
      return;
    }
    void clearNotifications(notificationIds, true);
  }

  function handleNotificationOpen(notification: DealerMaintenanceViewerNotification) {
    if (notification.isRead || notification.assignedToViewer) return;
    setItems((current) => current.map((item) => (
      item.id === notification.id ? { ...item, isRead: true } : item
    )));
    void markNotificationsChecked([notification.id]).catch(() => undefined);
  }

  function requestAssignedClear(notification: DealerMaintenanceViewerNotification) {
    if (notification.isRead || !notification.assignedToViewer || marking) return;
    setClearRequest({ ids: [notification.id], bulk: false });
  }

  async function confirmAssignedClear() {
    if (!clearRequest || marking) return;
    const request = clearRequest;
    setClearRequest(null);
    await clearNotifications(request.ids, request.bulk);
  }

  return (
    <div className={`${styles.content} ${styles.notificationContent}`}>
      <section className={styles.notificationIntro}>
        <div className={styles.ownerPageIntro}>
          <div className={notificationSettingsStyles.titleRow}><h1 className={styles.ownerPageTitle}>Notifications</h1><NotificationSettingsModal app="dealer" /></div>
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
              onClick={handleMarkChecked}
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
          <button type="button" onClick={handleMarkChecked}>Try again</button>
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
              <article key={notification.id} className={dealerNotificationStyles.assignedCardWrap}>
                <Link
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
                  {notification.assignedToViewer ? (
                    <span className={dealerNotificationStyles.assignedBadge}>Assigned to you</span>
                  ) : null}
                </Link>
                {notification.assignedToViewer && !notification.isRead ? (
                  <button
                    type="button"
                    className={dealerNotificationStyles.assignedClearButton}
                    onClick={() => requestAssignedClear(notification)}
                    disabled={marking}
                  >
                    Clear
                  </button>
                ) : null}
              </article>
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

      {clearRequest ? (
        <div className={dealerNotificationStyles.modalOverlay} role="presentation">
          <button
            type="button"
            className={dealerNotificationStyles.modalBackdrop}
            onClick={() => !marking && setClearRequest(null)}
            aria-label="Close assigned notification confirmation"
          />
          <section
            className={dealerNotificationStyles.modal}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dealer-assigned-clear-title"
          >
            <h2 id="dealer-assigned-clear-title">Assigned to you</h2>
            <p>
              {clearRequest.bulk
                ? 'Some of these notifications were specifically assigned to you. Are you sure you want to clear them?'
                : 'This notification was specifically assigned to you. Are you sure you want to clear it?'}
            </p>
            <div className={dealerNotificationStyles.modalActions}>
              <button type="button" onClick={() => setClearRequest(null)} disabled={marking}>
                Cancel
              </button>
              <button
                type="button"
                className={dealerNotificationStyles.modalConfirm}
                onClick={() => void confirmAssignedClear()}
                disabled={marking}
              >
                {marking ? 'Clearing…' : clearRequest.bulk ? 'Clear notifications' : 'Clear notification'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
