'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import styles from './owner-app.module.css';

type NotificationsResponse = {
  ok?: boolean;
  unreadCount?: number;
  needsActionCount?: number;
};

export default function OwnerNotificationsLink({ viewerId }: { viewerId: string }) {
  const [activeCount, setActiveCount] = useState(0);

  const loadActiveCount = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/owner-app/notifications', {
        credentials: 'include',
        cache: 'no-store',
        signal,
      });
      const payload = await response.json().catch(() => null) as NotificationsResponse | null;
      if (!response.ok || !payload?.ok) return;

      setActiveCount(
        Math.max(0, Number(payload.unreadCount) || 0)
        + Math.max(0, Number(payload.needsActionCount) || 0),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadActiveCount(controller.signal);
    const refresh = () => void loadActiveCount();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const intervalId = window.setInterval(refresh, 30_000);

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadActiveCount, viewerId]);

  return (
    <Link className={styles.homeLaunchCard} href="/owner-app/notifications" prefetch={false}>
      <strong>Notifications</strong>
      {activeCount > 0 ? (
        <span className={styles.homeLaunchBadge} aria-label={`${activeCount} active notifications`}>
          {activeCount > 99 ? '99+' : activeCount}
        </span>
      ) : null}
    </Link>
  );
}
