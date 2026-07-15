'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import type { InsurancePortfolioItem, InsuranceReviewStatus } from '../../lib/insurance-workspace-types';
import styles from './shared-registers.module.css';

type Props = { initialItems: InsurancePortfolioItem[] };

function money(value: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value || 0);
}

function dateLabel(value: string | null): string {
  if (!value) return 'Not reviewed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not reviewed' : new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const STATUS_LABELS: Record<InsuranceReviewStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
};

export default function SharedRegistersClient({ initialItems }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | InsuranceReviewStatus>('all');

  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return initialItems.filter((item) => {
      if (status !== 'all' && item.reviewStatus !== status) return false;
      return !normalized || [item.clientName, item.clientMeta, item.snapshotReference].join(' ').toLowerCase().includes(normalized);
    });
  }, [initialItems, query, status]);

  const totalAssets = initialItems.reduce((sum, item) => sum + item.assetCount, 0);
  const outstanding = initialItems.reduce((sum, item) => sum + item.outstandingAssetCount, 0);

  return (
    <main className={styles.page}>
      <AppHeader active="shared-registers" />
      <section className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <p>Insurance portfolio</p>
            <h1>Shared registers</h1>
            <span>Review owner-provided snapshots, record broker decisions, and issue versioned reports.</span>
          </div>
        </header>

        <section className={styles.summaryGrid} aria-label="Portfolio summary">
          <article><span>Client workspaces</span><strong>{initialItems.length}</strong><small>Registers shared with your account</small></article>
          <article><span>Assets received</span><strong>{totalAssets}</strong><small>Immutable snapshot assets</small></article>
          <article><span>Reviews outstanding</span><strong>{outstanding}</strong><small>Assets not marked completed</small></article>
        </section>

        <section className={styles.toolbar} aria-label="Portfolio filters">
          <label>
            <span>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Client, location or register reference" />
          </label>
          <label>
            <span>Review status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              <option value="all">All statuses</option>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </section>

        <section className={styles.portfolioTable} aria-label="Shared insurance registers">
          <div className={styles.tableHead}>
            <span>Client</span><span>Status</span><span>Progress</span><span>Replacement value</span><span>Last reviewed</span><span />
          </div>
          {items.map((item) => (
            <article className={styles.tableRow} key={item.id}>
              <div className={styles.clientCell}>
                <strong>{item.clientName}</strong>
                <small>{item.clientMeta || item.snapshotReference}</small>
              </div>
              <div><small className={styles.cellLabel}>Status</small><strong>{STATUS_LABELS[item.reviewStatus]}</strong></div>
              <div><small className={styles.cellLabel}>Progress</small><strong>{item.completedAssetCount} of {item.assetCount}</strong><small>{item.outstandingAssetCount} outstanding</small></div>
              <div><small className={styles.cellLabel}>Replacement value</small><strong>{money(item.totalReplacementValue)}</strong></div>
              <div><small className={styles.cellLabel}>Last reviewed</small><strong>{dateLabel(item.lastReviewedAtIso)}</strong></div>
              <Link className={styles.openButton} href={`/shared-registers/${item.shareId}`}>Open workspace</Link>
            </article>
          ))}
          {!items.length ? <div className={styles.emptyState}>No shared registers match these filters.</div> : null}
        </section>
      </section>
    </main>
  );
}
