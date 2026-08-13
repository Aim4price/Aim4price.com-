'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../../owner-app/owner-app.module.css';
import FieldManagerNavLink from '../field-manager-nav-link';

type NotificationView = 'active' | 'history';
type NotificationCategoryFilter = 'all' | 'maintenance';

type FieldManagerNotification = {
  id: string;
  maintenanceRecordId: string;
  assetId: string;
  title: string;
  body: string;
  href: string;
  createdAtIso: string;
  isRead: boolean;
  assignedToViewer: boolean;
};

type NotificationsResponse = {
  ok?: boolean;
  notifications?: FieldManagerNotification[];
  error?: string;
};

const CATEGORY_FILTERS: Array<{ value: NotificationCategoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'maintenance', label: 'Maintenance' },
];

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

export default function FieldManagerNotificationsClient() {
  const [items, setItems] = useState<FieldManagerNotification[]>([]);
  const [activeView, setActiveView] = useState<NotificationView>('active');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [updatingInbox, setUpdatingInbox] = useState(false);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const hasLoadedRef = useRef(false);
  const initialViewAppliedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      if (!hasLoadedRef.current) setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/field-manager/notifications', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as NotificationsResponse | null;

        if (response.status === 401) {
          window.location.replace('/field-manager/login');
          return;
        }
        if (!response.ok || !payload?.ok || !Array.isArray(payload.notifications)) {
          throw new Error(payload?.error || 'Failed to load notifications.');
        }

        setItems(payload.notifications);
        if (!initialViewAppliedRef.current) {
          setActiveView(payload.notifications.some((item) => !item.isRead) ? 'active' : 'history');
          initialViewAppliedRef.current = true;
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Failed to load notifications.');
        }
      } finally {
        if (!controller.signal.aborted) {
          hasLoadedRef.current = true;
          setLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [reloadToken]);

  const counts = useMemo(() => ({
    active: items.filter((item) => !item.isRead).length,
    new: items.filter((item) => !item.isRead).length,
    history: items.filter((item) => item.isRead).length,
  }), [items]);

  const visibleItems = useMemo(() => items.filter((item) => (
    activeView === 'active' ? !item.isRead : item.isRead
  )), [activeView, categoryFilter, items]);

  async function changeNotificationState(notificationIds: string[]) {
    if (!notificationIds.length || updatingInbox) return;
    setUpdatingInbox(true);
    setError('');

    try {
      const response = await fetch('/api/field-manager/notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds }),
      });
      const payload = await response.json().catch(() => null) as NotificationsResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Could not update notifications.');
      }

      const updatedIds = new Set(notificationIds);
      setItems((current) => current.map((item) => (
        updatedIds.has(item.id) ? { ...item, isRead: true } : item
      )));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update notifications.');
    } finally {
      setUpdatingInbox(false);
    }
  }

  function handleNotificationOpen(item: FieldManagerNotification) {
    if (item.isRead) return;
    void changeNotificationState([item.id]);
  }

  const viewTitle = activeView === 'active' ? 'Active' : 'History';

  return (
    <main className={styles.page}>
      <div className={`${styles.content} ${styles.notificationContent}`}>
        <FieldManagerNavLink href="/field-manager" label="Home" />

        <section className={styles.notificationIntro}>
          <div className={styles.ownerPageIntro}>
            <h1 className={styles.ownerPageTitle}>Notifications</h1>
            <p className={styles.ownerPageSubtitle}>Updates that need your attention.</p>
          </div>
        </section>

        <section className={styles.notificationWorkspace} aria-label="Notification controls">
          <div className={`${styles.notificationTabs} ${styles.notificationTabsTwo}`} role="tablist" aria-label="Notification sections">
            {([
              ['active', 'Active'],
              ['history', 'History'],
            ] as Array<[NotificationView, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeView === value}
                className={activeView === value ? styles.notificationTabActive : ''}
                onClick={() => setActiveView(value)}
              >
                <span>{label}</span>
                <strong>{counts[value]}</strong>
              </button>
            ))}
          </div>

          <label className={styles.notificationFilterSelect}>
            <span>Show</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as NotificationCategoryFilter)}
              aria-label="Filter notifications by type"
            >
              {CATEGORY_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>{filter.label}</option>
              ))}
            </select>
          </label>

          {activeView === 'active' && counts.new > 0 ? (
            <div className={styles.notificationBulkActions} aria-label="Notification actions">
              <button
                type="button"
                onClick={() => void changeNotificationState(items.filter((item) => !item.isRead).map((item) => item.id))}
                disabled={updatingInbox || counts.new === 0}
              >
                Mark all checked
              </button>
              <button
                type="button"
                className={styles.notificationClearAction}
                onClick={() => void changeNotificationState(items.filter((item) => !item.isRead).map((item) => item.id))}
                disabled={updatingInbox || counts.new === 0}
              >
                Clear all
              </button>
            </div>
          ) : null}
        </section>

        {error ? (
          <div className={`${styles.errorNotice} ${styles.notificationError}`} role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setReloadToken((current) => current + 1)}>Try again</button>
          </div>
        ) : null}

        {!error && !loading ? (
          <section className={styles.notificationSection} aria-labelledby="notification-results-title">
            <div className={`${styles.notificationSectionHeading} ${styles.ownerSectionHeading}`}>
              <h2 id="notification-results-title">{viewTitle}</h2>
              <span aria-label={`${visibleItems.length} notifications`}>{visibleItems.length}</span>
            </div>

            {visibleItems.length ? (
              <div className={styles.notificationList} aria-live="polite">
                {visibleItems.map((item) => (
                  <Link
                    key={item.id}
                    className={[
                      styles.notificationCard,
                      item.assignedToViewer && !item.isRead ? styles.notificationCardPriority : '',
                      !item.assignedToViewer && !item.isRead ? styles.notificationCardNew : '',
                      item.isRead ? styles.notificationCardHistory : '',
                    ].filter(Boolean).join(' ')}
                    href={item.href}
                    prefetch={false}
                    onClick={() => handleNotificationOpen(item)}
                  >
                    <time className={styles.notificationCardTime} dateTime={item.createdAtIso}>
                      {formatNotificationTime(item.createdAtIso)}
                    </time>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.notificationEmpty} aria-live="polite">
                {activeView === 'active'
                  ? 'You’re all caught up. Active notifications will appear here.'
                  : 'Your checked and cleared notifications will appear here.'}
              </p>
            )}
          </section>
        ) : null}

        {!error && loading ? (
          <p className={styles.notificationEmpty} role="status">Loading notifications…</p>
        ) : null}
      </div>
    </main>
  );
}
