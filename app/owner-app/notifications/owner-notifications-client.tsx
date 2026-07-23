'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  isOwnerNotificationNew,
  markOwnerNotificationsSeen,
  readOwnerNotificationsSeenAt,
} from '../owner-notification-state';
import styles from '../owner-app.module.css';

type NotificationTone = 'neutral' | 'success' | 'warning' | 'info';

type Notification = {
  id: string;
  category: string;
  tone: NotificationTone;
  title: string;
  body: string;
  href: string;
  createdAtIso: string;
  assetId?: string;
  dealerAssetCorrectionId?: string;
  priority?: boolean;
};

type NotificationsResponse = {
  ok?: boolean;
  notifications?: Notification[];
  error?: string;
};

function destination(item: Notification): string {
  if (item.href.startsWith('/owner-app/')) {
    return item.href;
  }
  if (item.assetId) {
    return `/owner-app/assets/${encodeURIComponent(item.assetId)}`;
  }
  if (item.category === 'partner_note' || item.category === 'lead' || item.category === 'asset_discovery') {
    return '/owner-app/marketplace';
  }
  return '/owner-app/assets';
}

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

function toneClassName(tone: NotificationTone): string {
  if (tone === 'success') return styles.notificationToneSuccess;
  if (tone === 'warning') return styles.notificationToneWarning;
  if (tone === 'info') return styles.notificationToneInfo;
  return '';
}

export default function OwnerNotificationsClient({ viewerId }: { viewerId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [seenAtIso, setSeenAtIso] = useState<string | null>(null);
  const [seenStateReady, setSeenStateReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [processingCorrectionIds, setProcessingCorrectionIds] = useState<Set<string>>(() => new Set());
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    setSeenAtIso(readOwnerNotificationsSeenAt(viewerId));
    setSeenStateReady(true);
  }, [viewerId]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      if (!hasLoadedRef.current) setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/owner-app/notifications', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as NotificationsResponse | null;

        if (response.status === 401) {
          window.location.replace('/owner-app/login');
          return;
        }
        if (!response.ok || !payload?.ok || !Array.isArray(payload.notifications)) {
          throw new Error(payload?.error || 'Failed to load notifications.');
        }

        setItems(payload.notifications);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Failed to load notifications.');
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

  useEffect(() => {
    const reload = () => setReloadToken((current) => current + 1);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    const intervalId = window.setInterval(reload, 30_000);
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const newItems = useMemo(
    () => seenStateReady
      ? items.filter((item) => isOwnerNotificationNew(item.createdAtIso, seenAtIso))
      : [],
    [items, seenAtIso, seenStateReady],
  );

  function handleMarkChecked() {
    setSeenAtIso(markOwnerNotificationsSeen(viewerId, items));
  }

  function handleNotificationOpen() {
    setSeenAtIso(markOwnerNotificationsSeen(viewerId, items));
  }

  async function handleCorrectionDecision(correctionId: string, decision: 'accept' | 'reject') {
    setProcessingCorrectionIds((current) => new Set(current).add(correctionId));
    setError('');

    try {
      const response = await fetch(`/api/asset-corrections/${encodeURIComponent(correctionId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (response.status === 401) {
        window.location.replace('/owner-app/login');
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to save the correction decision.');
      }

      setItems((current) => current.filter((item) => item.dealerAssetCorrectionId !== correctionId));
      setSeenAtIso(markOwnerNotificationsSeen(viewerId, items));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save the correction decision.');
    } finally {
      setProcessingCorrectionIds((current) => {
        const next = new Set(current);
        next.delete(correctionId);
        return next;
      });
    }
  }

  const isReady = seenStateReady && !loading;
  const newCountLabel = `${newItems.length} new notification${newItems.length === 1 ? '' : 's'}`;

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
          onClick={handleMarkChecked}
          disabled={!isReady || newItems.length === 0}
          aria-label={newItems.length ? `Mark all ${newCountLabel} checked` : 'All notifications checked'}
        >
          <span aria-hidden="true">✓</span>
          {newItems.length ? 'Mark checked' : 'All checked'}
        </button>
      </section>

      {error ? (
        <div className={`${styles.errorNotice} ${styles.notificationError}`} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadToken((current) => current + 1)}>
            Try again
          </button>
        </div>
      ) : null}

      {!error && isReady ? (
        <section className={styles.notificationSection} aria-labelledby="new-notifications-title">
          <div className={`${styles.notificationSectionHeading} ${styles.ownerSectionHeading}`}>
            <h2 id="new-notifications-title">New</h2>
            <span aria-label={newCountLabel}>{newItems.length}</span>
          </div>

          {newItems.length ? (
            <div className={styles.notificationList} aria-live="polite">
              {newItems.map((item) => {
                const className = `${styles.notificationCard} ${toneClassName(item.tone)} ${item.priority ? styles.notificationCardPriority : styles.notificationCardNew}`;
                const cardContent = (
                  <>
                    <div className={styles.notificationCardLabels}>
                      <span className={styles.notificationKind}>
                        <i className={styles.notificationDot} aria-hidden="true" />
                        {item.priority ? '#1 Priority' : 'New'}
                      </span>
                      <time dateTime={item.createdAtIso}>{formatNotificationTime(item.createdAtIso)}</time>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </>
                );

                if (item.dealerAssetCorrectionId) {
                  const correctionId = item.dealerAssetCorrectionId;
                  const processing = processingCorrectionIds.has(correctionId);
                  return (
                    <article key={item.id} className={`${className} ${styles.notificationCorrectionCard}`}>
                      {cardContent}
                      <div className={styles.notificationCorrectionActions}>
                        <button
                          type="button"
                          className={styles.notificationCorrectionDecline}
                          onClick={() => void handleCorrectionDecision(correctionId, 'reject')}
                          disabled={processing}
                        >
                          {processing ? 'Saving…' : 'Decline'}
                        </button>
                        <button
                          type="button"
                          className={styles.notificationCorrectionAccept}
                          onClick={() => void handleCorrectionDecision(correctionId, 'accept')}
                          disabled={processing}
                        >
                          {processing ? 'Saving…' : 'Accept update'}
                        </button>
                      </div>
                    </article>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    className={className}
                    href={destination(item)}
                    prefetch={false}
                    onClick={handleNotificationOpen}
                  >
                    {cardContent}
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className={styles.notificationEmpty} aria-live="polite">
              You’re all caught up. New notifications will appear here.
            </p>
          )}
        </section>
      ) : null}

      {!error && !isReady ? (
        <p className={styles.notificationEmpty} role="status">Loading notifications…</p>
      ) : null}
    </div>
  );
}
