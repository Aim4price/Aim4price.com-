'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AppHomeIcon, { AppHomeChevron } from '../../components/AppHomeIcon';
import launcherStyles from '../../components/AppHomeLauncher.module.css';
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
        headers: { 'x-aim4price-client-realm': 'owner' },
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
    <Link className={`${styles.homeLaunchCard} ${launcherStyles.card}`} href="/owner-app/notifications" prefetch={false}>
      <AppHomeIcon name="notifications" />
      <strong>Notifications</strong>
      <span className={launcherStyles.end}>
        {activeCount > 0 ? (
          <span className={`${styles.homeLaunchBadge} ${launcherStyles.badge}`} aria-label={`${activeCount} active notifications`}>
            {activeCount > 99 ? '99+' : activeCount}
          </span>
        ) : null}
        <AppHomeChevron />
      </span>
    </Link>
  );
}

