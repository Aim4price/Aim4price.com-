'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import type { InsurancePortfolioItem } from '../../lib/insurance-workspace-types';
import styles from './shared-registers.module.css';

type Props = { initialItems: InsurancePortfolioItem[] };
type Notice = { tone: 'success' | 'error'; message: string };

function dateLabel(value: string | null): string {
  if (!value) return 'Not reviewed yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not reviewed yet'
    : `Last reviewed ${new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)}`;
}

function renewalStatus(value: string | null): { label: string; urgent: boolean } {
  if (!value) return { label: 'Renewal date not recorded', urgent: true };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { label: 'Renewal date needs checking', urgent: true };
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `Renewal overdue by ${Math.abs(days)}d`, urgent: true };
  if (days <= 60) return { label: `Renewal in ${days}d`, urgent: true };
  return { label: `Renewal ${new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)}`, urgent: false };
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m16.5 16.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function OpenIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function DeleteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function SharedRegistersClient({ initialItems }: Props) {
  const [registers, setRegisters] = useState(initialItems);
  const [query, setQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InsurancePortfolioItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return registers.filter((item) => !normalized || [item.clientName, item.clientMeta].join(' ').toLowerCase().includes(normalized));
  }, [query, registers]);

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/insurance-shares/${deleteTarget.shareId}`, { method: 'DELETE' });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'The shared register could not be deleted.');
      setRegisters((current) => current.filter((item) => item.shareId !== deleteTarget.shareId));
      setNotice({ tone: 'success', message: `${deleteTarget.clientName} was removed from Shared Registers.` });
      setDeleteTarget(null);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The shared register could not be deleted.' });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="shared-registers" />
      <section className={styles.shell}>
        {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : ''}`}>{notice.message}</div> : null}
        <header className={styles.hero}><h1>Shared Registers</h1></header>

        <label className={styles.searchBox}>
          <SearchIcon />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by client, town or segment" />
        </label>

        <section className={styles.registerStack} aria-label="Shared insurance registers">
          {items.map((item) => {
            const renewal = renewalStatus(item.nearestRenewalDateIso);
            const completion = item.assetCount ? Math.round((item.completedAssetCount / item.assetCount) * 100) : 0;
            return (
            <article className={styles.registerCard} key={item.id}>
              <div className={styles.clientCopy}>
                <div className={styles.clientHeading}><div><h2>{item.clientName}</h2><p>{item.clientMeta || dateLabel(item.lastReviewedAtIso)}</p></div><span className={renewal.urgent ? styles.urgentBadge : styles.renewalBadge}>{renewal.label}</span></div>
                <div className={styles.portfolioProgress}><span style={{ width: `${completion}%` }} /></div>
                <div className={styles.portfolioMeta}><span><strong>{item.completedAssetCount}/{item.assetCount}</strong> assets reviewed</span><span><strong>{item.currentPolicyCount}</strong> current polic{item.currentPolicyCount === 1 ? 'y' : 'ies'}</span><span className={item.openQuestionCount ? styles.urgentText : ''}><strong>{item.openQuestionCount}</strong> open question{item.openQuestionCount === 1 ? '' : 's'}</span><span>{dateLabel(item.lastReviewedAtIso)}</span></div>
              </div>
              <div className={styles.cardActions}>
                <button className={styles.deleteButton} type="button" onClick={() => setDeleteTarget(item)}><DeleteIcon /><span>Delete</span></button>
                <Link className={styles.openButton} href={`/shared-registers/${item.shareId}`}><OpenIcon /><span>Open</span></Link>
              </div>
            </article>
          );})}
          {!items.length ? <div className={styles.emptyState}>{registers.length ? 'No clients match your search.' : 'No registers have been shared with you yet.'}</div> : null}
        </section>
      </section>

      {deleteTarget ? (
        <div className={styles.modalBackdrop} data-website-overlay role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null); }}>
          <section className={styles.deleteModal} role="dialog" aria-modal="true" aria-labelledby="delete-register-title">
            <div className={styles.deleteIcon}><DeleteIcon /></div>
            <h2 id="delete-register-title">Delete shared register?</h2>
            <p>This removes <strong>{deleteTarget.clientName}</strong> and your saved insurance review from this portfolio. It does not change the client&apos;s asset register.</p>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button type="button" className={styles.confirmDeleteButton} onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete register'}</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

