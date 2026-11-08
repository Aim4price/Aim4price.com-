'use client';

import FieldManagerSettings from './field-manager-settings';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import OwnerIcon from '../owner-app/owner-icon';
import mobile from './mobile.module.css';
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
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState('');
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
      setDisplayName(payload.manager.displayName);
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

      const count = Number(payload.summary.needsAttentionCount);
      if (Number.isFinite(count) && count >= 0) {
        setOverviewCount(Math.floor(count));
        const upcoming = Number(payload.summary.comingUpCount);
        setUpcomingCount(Number.isFinite(upcoming) && upcoming >= 0 ? Math.floor(upcoming) : null);
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

  return (
    <main className={styles.mobilePage}>
      <section className={`${styles.assetsShell} ${styles.dashboardShell}`}>
        <header className={styles.assetsHeader} aria-label="Field Manager account controls">
          <FieldManagerSettings />
          {hasManagerAccess ? <Link className={mobile.bell} href="/field-manager/notifications" aria-label={notificationCount ? `Notifications, ${notificationCount} unread` : 'Notifications'} prefetch={false}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
            {notificationCount ? <span className={mobile.badge} aria-hidden="true">{notificationCount > 99 ? '99+' : notificationCount}</span> : null}
          </Link> : null}
        </header>
        {notice ? <div className={styles.errorNotice} role="alert">{notice}<button type="button" className={styles.mobilePrimaryButton} onClick={() => void loadSession()}>Retry</button></div> : null}
        {isLoading ? <p className={styles.mobileEmpty}>Opening Field Manager…</p> : null}
        {!isLoading && hasManagerAccess ? <div className={styles.dashboardBody}>
          <section className={mobile.intro}><h1>Your work. Your day.</h1><p>{displayName}</p></section>
          <section aria-label="Your overview"><h2 className={mobile.sectionTitle}>Your overview</h2><div className={mobile.counts}>
            <Link className={mobile.count} href="/field-manager/overview" prefetch={false}><strong>{overviewCount ?? '—'}</strong><span>Needs attention</span></Link>
            <Link className={mobile.count} href="/field-manager/overview?range=upcoming" prefetch={false}><strong>{upcomingCount ?? '—'}</strong><span>Upcoming</span></Link>
          </div></section>
          <section aria-label="Field Manager actions"><h2 className={mobile.sectionTitle}>Quick actions</h2><nav className={mobile.grid}>
            <Link className={mobile.tile} href="/field-manager/diesel" prefetch={false}><OwnerIcon name="fuel" /><strong>Add fuel</strong></Link>
            <Link className={mobile.tile} href="/field-manager/assets" prefetch={false}><OwnerIcon name="record" /><strong>Record work</strong></Link>
            <Link className={mobile.tile} href="/field-manager/report-problem" prefetch={false}><OwnerIcon name="problem" /><strong>Report problem</strong></Link>
            <Link className={mobile.tile} href="/field-manager/assets" prefetch={false}><OwnerIcon name="search" /><strong>Find an asset</strong></Link>
          </nav></section>
          <Link className={mobile.row} href="/field-manager/offline.html" prefetch={false}><OwnerIcon name="offline" /><span><strong>Offline work</strong><small>Save work before heading out.</small></span></Link>
        </div> : null}
      </section>
    </main>
  );
}
