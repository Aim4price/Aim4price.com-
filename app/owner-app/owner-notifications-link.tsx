'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  isOwnerNotificationNew,
  OWNER_NOTIFICATION_SEEN_EVENT,
  ownerNotificationSeenStorageKey,
  readOwnerNotificationsSeenAt,
} from './owner-notification-state';
import styles from './owner-app.module.css';

type NotificationSummary = {
  createdAtIso: string;
};

type NotificationsResponse = {
  ok?: boolean;
  notifications?: NotificationSummary[];
};

export default function OwnerNotificationsLink({ viewerId }: { viewerId: string }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/owner-app/notifications', {
        credentials: 'include',
        cache: 'no-store',
        signal,
      });
      const payload = await response.json().catch(() => null) as NotificationsResponse | null;
      if (!response.ok || !payload?.ok || !Array.isArray(payload.notifications)) return;

      const seenAtIso = readOwnerNotificationsSeenAt(viewerId);
      setUnreadCount(payload.notifications.filter(
        (notification) => isOwnerNotificationNew(notification.createdAtIso, seenAtIso),
      ).length);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }, [viewerId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadUnreadCount(controller.signal);
    const refresh = () => void loadUnreadCount();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const intervalId = window.setInterval(refresh, 30_000);

    function handleStorage(event: StorageEvent) {
      if (event.key === ownerNotificationSeenStorageKey(viewerId)) {
        void loadUnreadCount();
      }
    }

    function handleNotificationsSeen(event: Event) {
      const detail = (event as CustomEvent<{ viewerId?: string }>).detail;
      if (!detail?.viewerId || detail.viewerId === viewerId) {
        void loadUnreadCount();
      }
    }

    window.addEventListener('storage', handleStorage);
    window.addEventListener(OWNER_NOTIFICATION_SEEN_EVENT, handleNotificationsSeen);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(OWNER_NOTIFICATION_SEEN_EVENT, handleNotificationsSeen);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadUnreadCount, viewerId]);

  return (
    <Link className={styles.homeLaunchCard} href="/owner-app/notifications" prefetch={false}>
      <strong>Notifications</strong>
      {unreadCount > 0 ? (
        <span className={styles.homeLaunchBadge} aria-label={`${unreadCount} new notifications`}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
