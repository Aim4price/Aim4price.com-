'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type {
  DealerMaintenanceTrackedAsset,
  DealerMaintenanceTrackerStatus,
} from '../../lib/dealer-maintenance-tracker';
import styles from './page.module.css';

type TrackingFilter = 'all' | 'attention' | 'upcoming';

function formatUsage(value: number | null, metric: string): string {
  if (value === null || !Number.isFinite(value)) return 'Not recorded';
  if (metric === 'percentage') {
    return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}%`;
  }
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} ${metric === 'km' ? 'km' : 'hours'}`;
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function formatUpdated(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recently updated';
  return `Updated ${new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed)}`;
}

function dueAt(asset: DealerMaintenanceTrackedAsset): string {
  const record = asset.nextMaintenance;
  return record.triggerType === 'usage'
    ? formatUsage(record.dueUsage, record.usageMetric || asset.usageMetric)
    : formatDate(record.dueDate);
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
  if (record.remainingUsage < 0) {
    return `${formatUsage(Math.abs(record.remainingUsage), record.usageMetric || asset.usageMetric)} overdue`;
  }
  return formatUsage(record.remainingUsage, record.usageMetric || asset.usageMetric);
}

function statusClass(status: DealerMaintenanceTrackerStatus): string {
  if (status === 'overdue' || status === 'due') return styles.statusUrgent;
  if (status === 'due_soon' || status === 'usage_needed') return styles.statusAttention;
  return styles.statusUpcoming;
}

function needsAttention(status: DealerMaintenanceTrackerStatus): boolean {
  return status !== 'upcoming';
}

function matchesSearch(asset: DealerMaintenanceTrackedAsset, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    asset.assetTitle,
    asset.ownerName,
    asset.assetKind,
    asset.brandName,
    asset.modelName,
    asset.serialNumber,
    asset.statusLabel,
    asset.nextMaintenance.title,
  ].some((value) => String(value || '').toLowerCase().includes(normalized));
}

export default function TrackingClient({
  initialAssets,
}: {
  initialAssets: DealerMaintenanceTrackedAsset[];
}) {
  const [filter, setFilter] = useState<TrackingFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const attentionCount = useMemo(
    () => initialAssets.filter((asset) => needsAttention(asset.status)).length,
    [initialAssets],
  );
  const upcomingCount = initialAssets.length - attentionCount;

  const visibleAssets = useMemo(
    () => initialAssets.filter((asset) => {
      if (!matchesSearch(asset, searchTerm)) return false;
      if (filter === 'attention') return needsAttention(asset.status);
      if (filter === 'upcoming') return asset.status === 'upcoming';
      return true;
    }),
    [filter, initialAssets, searchTerm],
  );

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Dealer workspace</span>
        <h1>Equipment Tracking</h1>
        <p>Monitor maintenance schedules and usage for equipment shared with your dealership.</p>
      </section>

      <section className={styles.summaryGrid} aria-label="Equipment tracking summary">
        <article className={`${styles.summaryCard} ${styles.summaryTotal}`}>
          <div><span>Tracked equipment</span><small>Shared by owners or Field Managers.</small></div>
          <strong>{initialAssets.length}</strong>
        </article>
        <article className={`${styles.summaryCard} ${styles.summaryAttention}`}>
          <div><span>Needs attention</span><small>Due, overdue, due soon or awaiting usage.</small></div>
          <strong>{attentionCount}</strong>
        </article>
        <article className={`${styles.summaryCard} ${styles.summaryUpcoming}`}>
          <div><span>Upcoming</span><small>Schedules currently on track.</small></div>
          <strong>{upcomingCount}</strong>
        </article>
      </section>

      <section className={styles.controls} aria-label="Tracking search and filters">
        <label className={styles.searchField}>
          <span className={styles.searchIcon} aria-hidden="true">⌕</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by equipment, owner, serial or maintenance item"
            aria-label="Search tracked equipment"
          />
        </label>

        <div className={styles.filterGroup} role="group" aria-label="Tracking status filter">
          <button type="button" className={filter === 'all' ? styles.filterActive : undefined} onClick={() => setFilter('all')}>All</button>
          <button type="button" className={filter === 'attention' ? styles.filterActive : undefined} onClick={() => setFilter('attention')}>Attention</button>
          <button type="button" className={filter === 'upcoming' ? styles.filterActive : undefined} onClick={() => setFilter('upcoming')}>Upcoming</button>
        </div>
      </section>

      <div className={styles.resultSummary}>
        <strong>{visibleAssets.length}</strong>
        <span>{visibleAssets.length === 1 ? 'tracked item' : 'tracked items'} shown</span>
      </div>

      {!initialAssets.length ? (
        <section className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden="true">✓</span>
          <strong>No tracked equipment yet</strong>
          <p>Equipment will appear here when an owner or Field Manager enables dealer maintenance tracking.</p>
        </section>
      ) : null}

      {initialAssets.length > 0 && !visibleAssets.length ? (
        <section className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden="true">⌕</span>
          <strong>No equipment matches this view</strong>
          <p>Try another search or status filter.</p>
        </section>
      ) : null}

      <section className={styles.assetList} aria-label="Tracked equipment">
        {visibleAssets.map((asset) => (
          <Link
            key={asset.accessId}
            href={`/tracking/${encodeURIComponent(asset.accessId)}`}
            className={styles.assetCard}
            prefetch={false}
          >
            <div className={styles.assetPhoto}>
              {asset.photoUrl ? <img src={asset.photoUrl} alt="" /> : <span>{asset.assetTitle.charAt(0).toUpperCase()}</span>}
            </div>

            <div className={styles.assetBody}>
              <div className={styles.assetHeading}>
                <div>
                  <span className={styles.ownerLabel}>{asset.ownerName}</span>
                  <h2>{asset.assetTitle}</h2>
                  <p>{[asset.brandName, asset.modelName, asset.yearModel].filter(Boolean).join(' · ') || asset.assetKind}</p>
                </div>
                <span className={`${styles.statusBadge} ${statusClass(asset.status)}`}>{asset.statusLabel}</span>
              </div>

              <div className={styles.nextMaintenance}>
                <span>Next maintenance</span>
                <strong>{asset.nextMaintenance.title}</strong>
              </div>

              <div className={styles.assetStats}>
                <div><span>Current usage</span><strong>{formatUsage(asset.currentUsage, asset.usageMetric)}</strong></div>
                <div><span>Due at</span><strong>{dueAt(asset)}</strong></div>
                <div><span>Remaining</span><strong>{remaining(asset)}</strong></div>
              </div>

              <div className={styles.assetFooter}>
                <span>{formatUpdated(asset.updatedAtIso)}</span>
                <strong>Open tracking record <span aria-hidden="true">›</span></strong>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
