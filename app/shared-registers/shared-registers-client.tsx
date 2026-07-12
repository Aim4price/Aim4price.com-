'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import { sharedRegisterSnapshot, type SharedRegisterLead } from '../../lib/shared-register-prototype';
import styles from './shared-registers.module.css';

type Props = { initialShares: SharedRegisterLead[] };

function money(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m16.5 16.5 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function SharedRegistersClient({ initialShares }: Props) {
  const [query, setQuery] = useState('');
  const shares = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return initialShares;
    return initialShares.filter((share) =>
      [share.ownerBusinessName, share.ownerName, share.ownerProvince, share.ownerTownCity]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [initialShares, query]);

  const totalAssets = initialShares.reduce((sum, share) => sum + (sharedRegisterSnapshot(share)?.assetCount ?? 0), 0);
  const totalReplacement = initialShares.reduce(
    (sum, share) => sum + (sharedRegisterSnapshot(share)?.totalReplacementValue ?? 0),
    0,
  );

  return (
    <main className={styles.page}>
      <AppHeader active="shared-registers" />
      <section className={styles.shell}>
        <section className={styles.panel}>
          <header className={styles.hero}>
            <div>
              <span className={styles.eyebrow}>Insurance workspace</span>
              <h1>Shared Registers</h1>
              <p>Review client assets, organise insurance sections and prepare cleaner underwriting submissions.</p>
            </div>
            <span className={styles.prototypeBadge}>First prototype</span>
          </header>

          <div className={styles.summaryGrid}>
            <article><span>Shared registers</span><strong>{initialShares.length}</strong><small>Received insurance registers</small></article>
            <article><span>Assets available</span><strong>{totalAssets}</strong><small>Across current register snapshots</small></article>
            <article><span>Replacement value</span><strong>{money(totalReplacement)}</strong><small>Excluding VAT</small></article>
          </div>

          <div className={styles.toolbar}>
            <label className={styles.searchBox}>
              <SearchIcon />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by client or location" />
            </label>
          </div>

          <div className={styles.registerStack}>
            {shares.map((share) => {
              const snapshot = sharedRegisterSnapshot(share);
              if (!snapshot) return null;
              return (
                <article className={styles.registerCard} key={share.id}>
                  <div className={styles.clientIdentity}>
                    <span className={styles.statusPill}>{share.status === 'sent' ? 'New' : 'In review'}</span>
                    <h2>{share.ownerBusinessName || share.ownerName || 'Aim4price client'}</h2>
                    <p>{[share.ownerProvince, share.ownerTownCity].filter(Boolean).join(' · ') || 'Location not provided'}</p>
                  </div>
                  <div className={styles.cardMetrics}>
                    <span><small>Assets</small><strong>{snapshot.assetCount}</strong></span>
                    <span><small>Register value</small><strong>{money(snapshot.totalValue)}</strong></span>
                    <span><small>Replacement</small><strong>{money(snapshot.totalReplacementValue)}</strong></span>
                    <span><small>Shared</small><strong>{dateLabel(snapshot.generatedAtIso)}</strong></span>
                  </div>
                  <Link className={styles.openButton} href={`/shared-registers/${encodeURIComponent(share.id)}`}>
                    Open register
                  </Link>
                </article>
              );
            })}

            {!shares.length && initialShares.length ? <div className={styles.emptyState}>No shared registers match your search.</div> : null}

            {!initialShares.length ? (
              <article className={`${styles.registerCard} ${styles.demoCard}`}>
                <div className={styles.clientIdentity}>
                  <span className={styles.demoPill}>Interactive demo</span>
                  <h2>Skimmelkrans Boerdery</h2>
                  <p>Explore the proposed broker and underwriter workflow with sample assets.</p>
                </div>
                <div className={styles.demoCopy}>
                  A real register will appear here after an owner sends a full-register insurance share.
                </div>
                <Link className={styles.openButton} href="/shared-registers/demo">Open prototype</Link>
              </article>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
