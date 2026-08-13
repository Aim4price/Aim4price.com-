'use client';

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

type NotificationsResponse = {
  ok?: boolean;
  notifications?: DealerMaintenanceViewerNotification[];
  error?: string;
};

async function markNotificationsChecked(
  notificationIds: string[],
  completed = false,
): Promise<NotificationsResponse> {
  if (!notificationIds.length) return { ok: true, notifications: [] };
  const response = await fetch('/api/dealer/maintenance/notifications', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notificationIds, completed }),
  });
  const payload = await response.json().catch(() => null) as NotificationsResponse | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Could not mark notifications checked.');
  }
  return payload;
}

type ClearRequest = {
  ids: string[];
  bulk: boolean;
  step: 'confirm' | 'completion';
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

  async function clearNotifications(
    notificationIds: string[],
    moveToHistory = false,
    completed = false,
  ): Promise<boolean> {
    if (!notificationIds.length || marking) return false;
    setMarking(true);
    setError('');

    try {
      const payload = await markNotificationsChecked(notificationIds, completed);
      if (Array.isArray(payload.notifications)) {
        setItems(payload.notifications);
      } else {
        const clearedIds = new Set(notificationIds);
        setItems((current) => current.map((notification) => (
          clearedIds.has(notification.id)
            ? { ...notification, isRead: true }
            : notification
        )));
      }
      if (moveToHistory) setActiveView('history');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark notifications checked.');
      return false;
    } finally {
      setMarking(false);
    }
  }

  function handleMarkChecked() {
    if (!newItems.length || marking) return;
    const notificationIds = newItems.map((notification) => notification.id);
    if (newItems.some((notification) => notification.assignedToViewer)) {
      setClearRequest({ ids: notificationIds, bulk: true, step: 'confirm' });
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
    setClearRequest({ ids: [notification.id], bulk: false, step: 'confirm' });
  }

  function confirmAssignedClear() {
    if (!clearRequest || marking) return;
    setClearRequest((current) => current ? { ...current, step: 'completion' } : null);
  }

  async function finishAssignedClear(completed: boolean) {
    if (!clearRequest || marking) return;
    const request = clearRequest;
    const cleared = await clearNotifications(request.ids, request.bulk, completed);
    if (cleared) setClearRequest(null);
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
            {clearRequest.step === 'confirm' ? (
              <>
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
                    onClick={confirmAssignedClear}
                    disabled={marking}
                  >
                    {clearRequest.bulk ? 'Clear notifications' : 'Clear notification'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="dealer-assigned-clear-title">
                  {clearRequest.bulk ? 'Were they completed?' : 'Was it completed?'}
                </h2>
                <p>Save a basic maintenance record?</p>
                <div className={dealerNotificationStyles.modalActions}>
                  <button type="button" onClick={() => void finishAssignedClear(false)} disabled={marking}>
                    {marking ? 'Clearing…' : 'Not sure'}
                  </button>
                  <button
                    type="button"
                    className={dealerNotificationStyles.modalConfirm}
                    onClick={() => void finishAssignedClear(true)}
                    disabled={marking}
                  >
                    {marking ? 'Saving…' : 'Yes'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
