'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styles from './notifications.module.css';

type FieldManagerNotification = {
  id: string;
  maintenanceRecordId: string;
  assetId: string;
  title: string;
  body: string;
  href: string;
  createdAtIso: string;
  isRead: boolean;
  assignedToViewer: true;
};

type NotificationsResponse = {
  ok?: boolean;
  notifications?: FieldManagerNotification[];
  error?: string;
};

type ClearRequest = {
  ids: string[];
  bulk: boolean;
};

function formatNotificationTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export default function FieldManagerNotificationsClient() {
  const [items, setItems] = useState<FieldManagerNotification[]>([]);
  const [activeView, setActiveView] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [clearRequest, setClearRequest] = useState<ClearRequest | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
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
        setActiveView(payload.notifications.some((item) => !item.isRead) ? 'active' : 'history');
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Failed to load notifications.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const activeItems = useMemo(() => items.filter((item) => !item.isRead), [items]);
  const historyItems = useMemo(() => items.filter((item) => item.isRead), [items]);
  const visibleItems = activeView === 'active' ? activeItems : historyItems;

  function requestClear(notification: FieldManagerNotification) {
    setClearRequest({ ids: [notification.id], bulk: false });
  }

  function requestClearAll() {
    if (!activeItems.length) return;
    setClearRequest({ ids: activeItems.map((item) => item.id), bulk: true });
  }

  async function confirmClear() {
    if (!clearRequest || clearing) return;
    setClearing(true);
    setError('');
    try {
      const response = await fetch('/api/field-manager/notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: clearRequest.ids }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Could not clear notifications.');

      const cleared = new Set(clearRequest.ids);
      setItems((current) => current.map((item) => cleared.has(item.id) ? { ...item, isRead: true } : item));
      setClearRequest(null);
      if (clearRequest.bulk) setActiveView('history');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not clear notifications.');
    } finally {
      setClearing(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => window.location.assign('/field-manager')}>
            Home
          </button>
          <h1>Notifications</h1>
          <span className={styles.headerSpacer} aria-hidden="true" />
        </header>

        <section className={styles.tabs} aria-label="Notification sections">
          <button type="button" className={activeView === 'active' ? styles.tabActive : ''} onClick={() => setActiveView('active')}>
            Active <strong>{activeItems.length}</strong>
          </button>
          <button type="button" className={activeView === 'history' ? styles.tabActive : ''} onClick={() => setActiveView('history')}>
            History <strong>{historyItems.length}</strong>
          </button>
        </section>

        {activeView === 'active' && activeItems.length ? (
          <button type="button" className={styles.clearAllButton} onClick={requestClearAll} disabled={clearing}>
            Mark all checked
          </button>
        ) : null}

        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        {loading ? <p className={styles.empty}>Loading notifications…</p> : null}

        {!loading && visibleItems.length ? (
          <section className={styles.list} aria-live="polite">
            {visibleItems.map((notification) => (
              <article key={notification.id} className={`${styles.card} ${notification.isRead ? styles.cardHistory : styles.cardActive}`}>
                <Link href={notification.href} className={styles.cardLink}>
                  <time dateTime={notification.createdAtIso}>{formatNotificationTime(notification.createdAtIso)}</time>
                  <h2>{notification.title}</h2>
                  <p>{notification.body}</p>
                  <span className={styles.assignedBadge}>Assigned to you</span>
                </Link>
                {!notification.isRead ? (
                  <button type="button" className={styles.clearButton} onClick={() => requestClear(notification)}>
                    Clear
                  </button>
                ) : null}
              </article>
            ))}
          </section>
        ) : null}

        {!loading && !visibleItems.length ? (
          <p className={styles.empty}>
            {activeView === 'active' ? 'No active assigned notifications.' : 'No checked notifications yet.'}
          </p>
        ) : null}
      </div>

      {clearRequest ? (
        <div className={styles.modalOverlay} role="presentation">
          <button type="button" className={styles.modalBackdrop} onClick={() => !clearing && setClearRequest(null)} aria-label="Close clear confirmation" />
          <section className={styles.modal} role="alertdialog" aria-modal="true" aria-labelledby="assigned-clear-title">
            <h2 id="assigned-clear-title">Assigned to you</h2>
            <p>
              {clearRequest.bulk
                ? 'These notifications were specifically assigned to you. Are you sure you want to clear them?'
                : 'This notification was specifically assigned to you. Are you sure you want to clear it?'}
            </p>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setClearRequest(null)} disabled={clearing}>Cancel</button>
              <button type="button" className={styles.modalConfirm} onClick={() => void confirmClear()} disabled={clearing}>
                {clearing ? 'Clearing…' : clearRequest.bulk ? 'Clear notifications' : 'Clear notification'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
