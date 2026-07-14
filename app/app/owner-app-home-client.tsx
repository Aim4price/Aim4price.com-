'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import OwnerAppNav from './owner-app-nav';
import { ownerAppMoney, type OwnerAppAssetsResponse } from './owner-app-types';
import styles from './owner-app.module.css';

type MaintenanceResponse = {
  ok?: boolean;
  summary?: {
    openCount: number;
    dueSoonCount: number;
    dueCount: number;
    overdueCount: number;
  };
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAtIso: string;
};

type NotificationsResponse = {
  ok?: boolean;
  notifications?: NotificationItem[];
};

export default function OwnerAppHomeClient({ displayName, businessName }: { displayName: string; businessName: string }) {
  const [assetData, setAssetData] = useState<OwnerAppAssetsResponse | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceResponse['summary'] | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [assetsResponse, maintenanceResponse, notificationsResponse] = await Promise.all([
          fetch('/api/owner-app/assets', { credentials: 'include', cache: 'no-store' }),
          fetch('/api/maintenance?status=upcoming', { credentials: 'include', cache: 'no-store' }),
          fetch('/api/notifications', { credentials: 'include', cache: 'no-store' }),
        ]);

        const assets = await assetsResponse.json().catch(() => null) as OwnerAppAssetsResponse | null;
        const maintenancePayload = await maintenanceResponse.json().catch(() => null) as MaintenanceResponse | null;
        const notificationPayload = await notificationsResponse.json().catch(() => null) as NotificationsResponse | null;

        if (!assetsResponse.ok || !assets?.ok) throw new Error(assets?.error || 'Your Aim4price information could not be loaded.');
        if (!active) return;

        setAssetData(assets);
        setMaintenance(maintenancePayload?.summary ?? null);
        setNotifications(notificationPayload?.notifications?.slice(0, 3) ?? []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Your Aim4price information could not be loaded.');
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  const attentionCount = Number(maintenance?.dueSoonCount || 0) + Number(maintenance?.dueCount || 0) + Number(maintenance?.overdueCount || 0);
  const welcomeName = displayName.trim().split(/\s+/)[0] || businessName || 'there';

  return (
    <main className={styles.appPage}>
      <OwnerAppNav />
      <div className={styles.narrowShell}>
        <header className={styles.homeHero}>
          <Image className={styles.homeLogo} src="/icon.png" alt="Aim4price" width={78} height={78} priority />
          <p className={styles.homeEyebrow}>Welcome, {welcomeName}</p>
          <h1>Your machinery, in your pocket.</h1>
          <p>Find answers, plan maintenance and open reports wherever you are.</p>
        </header>

        {error ? <div className={`${styles.notice} ${styles.noticeError}`} role="alert">{error}</div> : null}

        <section className={styles.homeStats} aria-label="Aim4price summary">
          <div className={styles.statBox}>
            <span>Saved assets</span>
            <strong>{assetData?.summary?.assetCount ?? '—'}</strong>
          </div>
          <div className={styles.statBox}>
            <span>Register value</span>
            <strong>{assetData?.summary ? ownerAppMoney(assetData.summary.totalValue) : '—'}</strong>
          </div>
        </section>

        <nav className={styles.actionGrid} aria-label="Aim4price App tools">
          <Link className={styles.actionCard} href="/app/assets">My Assets</Link>
          <Link className={styles.actionCard} href="/app/maintenance">
            Maintenance
            {attentionCount > 0 ? <span className={styles.actionBadge}>{attentionCount > 99 ? '99+' : attentionCount}</span> : null}
          </Link>
          <Link className={styles.actionCard} href="/app/reports">Reports</Link>
          <Link className={styles.actionCard} href="/app/valuation">Get Estimate</Link>
          <Link className={styles.actionCard} href="/marketplace">Marketplace</Link>
        </nav>

        <section className={styles.section} aria-labelledby="latest-activity-title">
          <div className={styles.sectionHeader}>
            <h2 id="latest-activity-title">Latest activity</h2>
          </div>
          <div className={styles.activityList}>
            {notifications.length ? notifications.map((notification) => (
              <article key={notification.id} className={styles.activityItem}>
                <strong>{notification.title}</strong>
                <p>{notification.body}</p>
                <time dateTime={notification.createdAtIso}>
                  {new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(notification.createdAtIso))}
                </time>
              </article>
            )) : (
              <div className={styles.emptyState}>No new activity. Your latest scans, maintenance and partner updates will appear here.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
