'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { DealerMaintenanceTrackedAsset, DealerMaintenanceTrackerStatus } from '../../../lib/dealer-maintenance-tracker';
import styles from './maintenance-tracker.module.css';

type Filter = 'all' | 'attention' | 'upcoming';

function usage(value: number | null, metric: string): string {
  if (value === null || !Number.isFinite(value)) return 'Not recorded';
  if (metric === 'percentage') return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}%`;
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} ${metric === 'km' ? 'km' : 'hours'}`;
}

function date(value: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

function due(asset: DealerMaintenanceTrackedAsset): string {
  const record = asset.nextMaintenance;
  return record.triggerType === 'usage'
    ? usage(record.dueUsage, record.usageMetric || asset.usageMetric)
    : date(record.dueDate);
}

function remaining(asset: DealerMaintenanceTrackedAsset): string {
  const record = asset.nextMaintenance;
  if (record.triggerType === 'date') {
    if (!record.dueDate) return 'Not set';
    const today = new Date();
    const dueDate = new Date(`${record.dueDate}T00:00:00`);
    const days = Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    return `${days} days`;
  }
  if (record.remainingUsage === null) return 'Usage needed';
  if (record.remainingUsage < 0) return `${usage(Math.abs(record.remainingUsage), record.usageMetric || asset.usageMetric)} overdue`;
  return usage(record.remainingUsage, record.usageMetric || asset.usageMetric);
}

function statusClass(status: DealerMaintenanceTrackerStatus): string {
  if (status === 'overdue' || status === 'due') return styles.statusUrgent;
  if (status === 'due_soon') return styles.statusSoon;
  return styles.statusUpcoming;
}

export default function DealerMaintenanceClient({ initialAssets }: { initialAssets: DealerMaintenanceTrackedAsset[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const assets = useMemo(() => initialAssets.filter((asset) => {
    if (filter === 'attention') return ['overdue', 'due', 'due_soon', 'usage_needed'].includes(asset.status);
    if (filter === 'upcoming') return asset.status === 'upcoming';
    return true;
  }), [filter, initialAssets]);

  return (
    <main className={styles.trackerPage}>
      <header className={styles.pageIntro}>
        <h1>Maintenance Tracker</h1>
        <p>Track shared service schedules and send owner-approved asset detail corrections.</p>
      </header>

      <div className={styles.filterBar} role="group" aria-label="Maintenance filters">
        <button type="button" className={filter === 'all' ? styles.filterActive : undefined} onClick={() => setFilter('all')}>All</button>
        <button type="button" className={filter === 'attention' ? styles.filterActive : undefined} onClick={() => setFilter('attention')}>Needs attention</button>
        <button type="button" className={filter === 'upcoming' ? styles.filterActive : undefined} onClick={() => setFilter('upcoming')}>Upcoming</button>
      </div>

      {!initialAssets.length ? <div className={styles.emptyState}><strong>No tracked assets yet.</strong><span>Assets appear here after an owner or Field Manager enables dealer maintenance tracking.</span></div> : null}
      {initialAssets.length && !assets.length ? <div className={styles.emptyState}><strong>No assets in this view.</strong><span>Choose another tracker filter.</span></div> : null}

      <section className={styles.assetList} aria-label="Tracked assets">
        {assets.map((asset) => (
          <Link key={asset.accessId} href={`/dealer/maintenance/${encodeURIComponent(asset.accessId)}`} className={styles.assetCard} prefetch={false}>
            <div className={styles.assetPhoto}>
              {asset.photoUrl ? <img src={asset.photoUrl} alt="" /> : <span>{asset.assetTitle.charAt(0).toUpperCase()}</span>}
            </div>
            <div className={styles.assetCardBody}>
              <div className={styles.assetCardHeading}>
                <div><small>{asset.ownerName}</small><h2>{asset.assetTitle}</h2></div>
                <span className={`${styles.status} ${statusClass(asset.status)}`}>{asset.statusLabel}</span>
              </div>
              <p>{asset.nextMaintenance.title}</p>
              <div className={styles.assetStats}>
                <div><span>Current</span><strong>{usage(asset.currentUsage, asset.usageMetric)}</strong></div>
                <div><span>Due at</span><strong>{due(asset)}</strong></div>
                <div><span>Remaining</span><strong>{remaining(asset)}</strong></div>
              </div>
              {asset.nextMaintenance.notes ? <div className={styles.latestNote}><span>Maintenance note</span><p>{asset.nextMaintenance.notes}</p></div> : null}
              <span className={styles.openLabel}>Open asset ›</span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
