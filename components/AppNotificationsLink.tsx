'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AppHomeIcon, { AppHomeChevron } from './AppHomeIcon';
import launcherStyles from './AppHomeLauncher.module.css';
import styles from '../app/owner-app/owner-app.module.css';

type NotificationsResponse = {
  ok?: boolean;
  unreadCount?: number;
  needsActionCount?: number;
};

export default function AppNotificationsLink({ app }: { app: 'dealer' | 'middleman' }) {
  const [activeCount, setActiveCount] = useState(0);

  const loadActiveCount = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/app-notifications/inbox', {
        credentials: 'include',
        cache: 'no-store',
        signal,
        headers: { 'x-aim4price-client-realm': app },
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
  }, [app]);

  useEffect(() => {
    const controller = new AbortController();
    void loadActiveCount(controller.signal);
    const refresh = () => void loadActiveCount();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const intervalId = window.setInterval(refresh, 30_000);

    window.addEventListener('focus', refresh);
    window.addEventListener('aim4price-notifications-updated', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('aim4price-notifications-updated', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadActiveCount, app]);

  return (
    <Link className={`${styles.homeLaunchCard} ${launcherStyles.card}`} href={`/${app}/notifications`} prefetch={false}>
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

