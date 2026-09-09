'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AppHomeIcon, { AppHomeChevron } from '../../components/AppHomeIcon';
import launcherStyles from '../../components/AppHomeLauncher.module.css';
import styles from './owner-app.module.css';

type OverviewResponse = {
  ok?: boolean;
  summary?: {
    totalCount?: number;
  };
};

export default function OwnerOverviewLink() {
  const [count, setCount] = useState(0);

  const loadCount = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/owner-app/attention?range=upcoming', {
        credentials: 'include',
        cache: 'no-store',
        signal,
      });
      const payload = await response.json().catch(() => null) as OverviewResponse | null;
      const nextCount = Number(payload?.summary?.totalCount);

      if (response.ok && payload?.ok && Number.isFinite(nextCount) && nextCount >= 0) {
        setCount(Math.floor(nextCount));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => void loadCount();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const interval = window.setInterval(refresh, 30_000);

    void loadCount(controller.signal);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadCount]);

  return (
    <Link className={`${styles.homeLaunchCard} ${launcherStyles.card}`} href="/owner-app/attention" prefetch={false}>
      <AppHomeIcon name="overview" />
      <strong>Overview</strong>
      <span className={launcherStyles.end}>
        {count > 0 ? (
          <span className={`${styles.homeLaunchBadge} ${launcherStyles.badge}`} aria-label={`${count} overview ${count === 1 ? 'item' : 'items'}`}>
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
        <AppHomeChevron />
      </span>
    </Link>
  );
}
