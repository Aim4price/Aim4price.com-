'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AppHeader from '../../../components/AppHeader';
import type { AccountantRegisterAccess } from '../../../lib/accountant-workspace';
import styles from './page.module.css';

type Props = { initialRegisters: AccountantRegisterAccess[] };

function money(value: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
}

function date(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not available' : new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m16.5 16.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}

function RefreshIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4.7L4 8m0-4v4h4M4 13a8 8 0 0 0 14.5 4.7L20 16m0 4v-4h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function AccountantRegistersClient({ initialRegisters }: Props) {
  const [registers, setRegisters] = useState(initialRegisters);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AccountantRegisterAccess | null>(null);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return registers.filter((item) => !search || `${item.ownerBusinessName} ${item.ownerName} ${item.registerName}`.toLowerCase().includes(search));
  }, [query, registers]);

  async function refresh() {
    setRefreshing(true);
    setNotice(null);
    try {
      const response = await fetch('/api/accountant/registers', { cache: 'no-store', credentials: 'include' });
      const data = await response.json() as { ok?: boolean; registers?: AccountantRegisterAccess[]; error?: string };
      if (!response.ok || !data.ok || !data.registers) throw new Error(data.error || 'Asset Registers could not be refreshed.');
      setRegisters(data.registers);
      setNotice({ tone: 'success', text: 'Asset Registers refreshed.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Asset Registers could not be refreshed.' });
    } finally {
      setRefreshing(false);
    }
  }

  async function removeAccess() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const response = await fetch(`/api/accountant/registers/${encodeURIComponent(removeTarget.shareId)}`, { method: 'DELETE', credentials: 'include' });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Access could not be removed.');
      setRegisters((items) => items.filter((item) => item.shareId !== removeTarget.shareId));
      setNotice({ tone: 'success', text: `${removeTarget.registerName} was removed from your workspace. The owner’s data was not deleted.` });
      setRemoveTarget(null);
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Access could not be removed.' });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="shared-registers" />
      <section className={styles.shell}>
        {notice ? <div className={`${styles.notice} ${notice.tone === 'success' ? styles.success : styles.error}`}>{notice.text}</div> : null}
        <section className={styles.titlePanel}><h1>MANAGE ASSET REGISTERS</h1></section>
        <section className={styles.summaryGrid}>
          <article className={styles.summaryBlue}><span>Shared registers</span><strong>{registers.length}</strong><small>Owner-authorised registers in your workspace.</small></article>
          <article className={styles.summaryCream}><span>Assets under review</span><strong>{registers.reduce((sum, item) => sum + item.assetCount, 0)}</strong><small>Current active assets across shared registers.</small></article>
          <article className={styles.summaryGreen}><span>Current register value</span><strong>{money(registers.reduce((sum, item) => sum + item.totalValue, 0))}</strong><small>Aim4price values, excluding VAT.</small></article>
        </section>
        <div className={styles.toolbar}>
          <label className={styles.search}><SearchIcon/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by owner, business or Asset Register" /></label>
          <button type="button" className={styles.refreshButton} onClick={() => void refresh()} disabled={refreshing}><RefreshIcon/><span>{refreshing ? 'Refreshing...' : 'Refresh'}</span></button>
        </div>
        <p className={styles.resultCount}>Showing <strong>{visible.length}</strong> of {registers.length} Asset Registers</p>
        <div className={styles.cardList}>
          {visible.length ? visible.map((item) => (
            <article className={styles.registerCard} key={item.shareId}>
              <div className={styles.cardCopy}>
                <span className={styles.statusPill}>ACTIVE ACCESS</span>
                <h2>{item.ownerBusinessName}</h2>
                <h3>{item.registerName}</h3>
                <div className={styles.meta}><span>{item.assetCount} {item.assetCount === 1 ? 'asset' : 'assets'}</span><span>{money(item.totalValue)} excl. VAT</span><span>Shared {date(item.dateSharedIso)}</span><span>Updated {date(item.lastUpdatedIso)}</span></div>
                <div className={styles.permissionLine}><strong>{item.allowDirectUpdates ? 'Direct updates allowed' : 'Read-only'}</strong><span>Fuel {item.includeFuelLedger ? 'shared' : 'not shared'} · Cost {item.includeCostLedger ? 'shared' : 'not shared'}</span></div>
              </div>
              <div className={styles.cardActions}>
                <button type="button" className={styles.removeButton} onClick={() => setRemoveTarget(item)}>Remove</button>
                <Link className={styles.openButton} href={`/accountant/registers/${encodeURIComponent(item.shareId)}`}>Open</Link>
              </div>
            </article>
          )) : <div className={styles.empty}><strong>No Asset Registers found.</strong><span>Try another search, or ask the owner to share a full register with your accountant account.</span></div>}
        </div>
      </section>
      {removeTarget ? (
        <div className={styles.modalOverlay}>
          <button className={styles.backdrop} aria-label="Close confirmation" onClick={() => !removing && setRemoveTarget(null)} />
          <section className={styles.modal} role="alertdialog" aria-modal="true">
            <h2>Remove this Asset Register?</h2>
            <p>This only ends your accountant access to <strong>{removeTarget.registerName}</strong>. It will never delete the owner’s Asset Register, assets, documents, finance, fuel or cost records.</p>
            <div className={styles.modalActions}><button type="button" onClick={() => setRemoveTarget(null)} disabled={removing}>Cancel</button><button type="button" className={styles.danger} onClick={() => void removeAccess()} disabled={removing}>{removing ? 'Removing...' : 'Remove access'}</button></div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
