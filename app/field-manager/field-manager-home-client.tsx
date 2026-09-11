'use client';

import { useEffect, useState } from 'react';
import { clearCachedHeaderSession } from '../../lib/header-session-cache';
import AppHomeIcon, { AppHomeChevron } from '../../components/AppHomeIcon';
import launcherStyles from '../../components/AppHomeLauncher.module.css';
import styles from './page.module.css';

type FieldManagerSession = {
  id: string;
  displayName: string;
  username: string;
};

type SessionApiResponse = {
  ok: boolean;
  manager?: FieldManagerSession;
  error?: string;
};

type OverviewCountApiResponse = {
  ok: boolean;
  summary?: {
    totalCount: number;
    needsAttentionCount: number;
    comingUpCount: number;
  };
  error?: string;
};

type NotificationCountApiResponse = {
  ok: boolean;
  unreadCount?: number;
  error?: string;
};

function extractError(payload: { error?: string } | null, fallback: string): string {
  return payload?.error?.trim() || fallback;
}

export default function FieldManagerHomeClient() {
  const [hasManagerAccess, setHasManagerAccess] = useState(false);
  const [overviewCount, setOverviewCount] = useState<number | null>(null);
  const [notificationCount, setNotificationCount] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    if (!hasManagerAccess) return undefined;

    const refresh = () => {
      void loadOverviewCount();
      void loadNotificationCount();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const interval = window.setInterval(refresh, 30_000);

    window.addEventListener('focus', refresh);
    window.addEventListener('aim4price-notifications-updated', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('aim4price-notifications-updated', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [hasManagerAccess]);

  async function loadSession() {
    setIsLoading(true);
    setHasManagerAccess(false);
    setNotice(null);

    try {
      const response = await fetch('/api/field-manager/session', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as SessionApiResponse | null;

      if (response.status === 401) {
        window.location.replace('/field-manager/login');
        return;
      }

      if (!response.ok || !payload?.ok || !payload.manager) {
        throw new Error(extractError(payload, 'Field Manager login is required.'));
      }

      setHasManagerAccess(true);
      void loadOverviewCount();
      void loadNotificationCount();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Field Manager login is required.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadOverviewCount() {
    try {
      const response = await fetch('/api/field-manager/overview?range=upcoming', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as OverviewCountApiResponse | null;

      if (!response.ok || !payload?.ok || !payload.summary) return;

      const count = Number(payload.summary.totalCount);
      if (Number.isFinite(count) && count >= 0) {
        setOverviewCount(Math.floor(count));
      }
    } catch {
      // The Overview count is optional; the home actions remain available if it cannot load.
    }
  }

  async function loadNotificationCount() {
    try {
      const response = await fetch('/api/field-manager/notifications', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as NotificationCountApiResponse | null;
      if (!response.ok || !payload?.ok) return;

      const count = Number(payload.unreadCount ?? 0);
      if (Number.isFinite(count) && count >= 0) {
        setNotificationCount(Math.floor(count));
      }
    } catch {
      // Notifications remain available from their own page if the badge refresh fails.
    }
  }

  async function handleLogout() {
    await fetch('/api/field-manager/login', {
      method: 'DELETE',
      credentials: 'include',
      cache: 'no-store',
    }).catch(() => undefined);
    if ('BroadcastChannel' in window) { const channel = new BroadcastChannel('aim4price-field-session'); channel.postMessage('lock'); channel.close(); }
    clearCachedHeaderSession();
    window.location.replace('/field-manager/login');
  }

  return (
    <main className={`${styles.mobilePage} ${styles.homePage}`}>
      <section className={`${styles.assetsShell} ${styles.homeShell}`}>
        <header className={styles.assetsHeader} aria-label="Field Manager account controls">
          <button type="button" className={styles.logoutButton} onClick={() => void handleLogout()}>
            Sign out
          </button>
        </header>

        {notice ? <div className={styles.errorNotice}>{notice}</div> : null}
        {isLoading ? <p className={styles.mobileEmpty}>Opening Field Manager…</p> : null}

        {!isLoading && hasManagerAccess ? (
          <section className={styles.homeCard} aria-label="Field Manager actions">
            <div className={`${styles.homeActionGrid} ${launcherStyles.list}`}>
              <button
                type="button"
                className={`${styles.homeActionCard} ${launcherStyles.card}`}
                aria-label={
                  notificationCount && notificationCount > 0
                    ? `Notifications, ${notificationCount} unread`
                    : 'Notifications'
                }
                onClick={() => window.location.assign('/field-manager/notifications')}
              >
                <AppHomeIcon name="notifications" />
                <strong>Notifications</strong>
                <span className={launcherStyles.end}>
                  {notificationCount && notificationCount > 0 ? (
                    <span className={`${styles.homeActionBadge} ${launcherStyles.badge}`} aria-hidden="true">
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  ) : null}
                  <AppHomeChevron />
                </span>
              </button>

              <button
                type="button"
                className={`${styles.homeActionCard} ${launcherStyles.card}`}
                aria-label={
                  overviewCount && overviewCount > 0
                    ? `Overview, ${overviewCount} ${overviewCount === 1 ? 'item' : 'items'}`
                    : 'Overview'
                }
                onClick={() => window.location.assign('/field-manager/overview')}
              >
                <AppHomeIcon name="overview" />
                <strong>Overview</strong>
                <span className={launcherStyles.end}>
                  {overviewCount && overviewCount > 0 ? (
                    <span className={`${styles.homeActionBadge} ${launcherStyles.badge}`} aria-hidden="true">
                      {overviewCount > 99 ? '99+' : overviewCount}
                    </span>
                  ) : null}
                  <AppHomeChevron />
                </span>
              </button>

              <button
                type="button"
                className={`${styles.homeActionCard} ${launcherStyles.card}`}
                onClick={() => window.location.assign('/field-manager/assets')}
              >
                <AppHomeIcon name="operations" />
                <strong>Maintenance</strong>
                <AppHomeChevron />
              </button>

              <button type="button" className={`${styles.homeActionCard} ${launcherStyles.card}`}
                onClick={() => window.location.assign('/field-manager/offline.html')}>
                <AppHomeIcon name="operations" /><strong>Offline work</strong><AppHomeChevron />
              </button>

              <button
                type="button"
                className={`${styles.homeActionCard} ${launcherStyles.card}`}
                onClick={() => window.location.assign('/field-manager/diesel')}
              >
                <AppHomeIcon name="fuel" />
                <strong>Fuel</strong>
                <AppHomeChevron />
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
