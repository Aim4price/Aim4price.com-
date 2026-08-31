'use client';

import { useMemo, useState } from 'react';
import type {
  AdminAssetAllocationAccount,
  AdminAssetOutcome,
  AdminAssetOutcomesReport,
  AdminAssetOutcomeRow,
} from '../../../lib/admin-asset-sales';
import styles from './page.module.css';

type OutcomeFilter = 'all' | AdminAssetOutcome;
type InfluenceFilter = 'all' | AdminAssetOutcomeRow['aim4priceInfluence'];
type TransferFilter = 'all' | AdminAssetOutcomeRow['transferStatus'];
type ActionDialog = { mode: 'allocate' | 'delete'; record: AdminAssetOutcomeRow } | null;

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

function formatMoney(value: number | null) {
  if (value === null) return 'Not saved';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
}

const OUTCOME_LABELS: Record<AdminAssetOutcome, string> = { sold: 'Sold', traded_in: 'Traded in', scrapped: 'Scrapped' };
const INFLUENCE_LABELS: Record<AdminAssetOutcomeRow['aim4priceInfluence'], string> = { yes: 'Yes', no: 'No', unsure: 'Not sure', unknown: 'Not recorded' };
const TRANSFER_LABELS: Record<AdminAssetOutcomeRow['transferStatus'], string> = { not_requested: 'Not allocated', pending: 'Waiting', claimed: 'Allocated', cancelled: 'Closed', expired: 'Code expired' };

export default function SoldAssetsClient({ report, allocationAccounts }: { report: AdminAssetOutcomesReport; allocationAccounts: AdminAssetAllocationAccount[] }) {
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [influenceFilter, setInfluenceFilter] = useState<InfluenceFilter>('all');
  const [transferFilter, setTransferFilter] = useState<TransferFilter>('all');
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [selectedBuyerUserId, setSelectedBuyerUserId] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return report.outcomes.filter((record) => {
      if (outcomeFilter !== 'all' && record.outcome !== outcomeFilter) return false;
      if (influenceFilter !== 'all' && record.aim4priceInfluence !== influenceFilter) return false;
      if (transferFilter !== 'all' && record.transferStatus !== transferFilter) return false;
      if (!term) return true;
      return [record.assetTitle, record.assetDescription, record.sourceName, record.note, OUTCOME_LABELS[record.outcome]].join(' ').toLowerCase().includes(term);
    });
  }, [influenceFilter, outcomeFilter, report.outcomes, search, transferFilter]);

  const availableAccounts = useMemo(() => {
    if (actionDialog?.mode !== 'allocate') return [];
    const term = accountSearch.trim().toLowerCase();
    return allocationAccounts.filter((account) => account.userId !== actionDialog.record.sourceUserId && (!term || [account.name, account.email, account.accountSubtype, account.accountType].join(' ').toLowerCase().includes(term)));
  }, [accountSearch, actionDialog, allocationAccounts]);

  function openAction(mode: NonNullable<ActionDialog>['mode'], record: AdminAssetOutcomeRow) {
    setActionDialog({ mode, record });
    setAccountSearch('');
    setSelectedBuyerUserId('');
    setActionError('');
  }

  async function submitAction() {
    if (!actionDialog || actionBusy) return;
    if (actionDialog.mode === 'allocate' && !selectedBuyerUserId) {
      setActionError('Choose the Owner or Dealer account that should receive this asset.');
      return;
    }
    setActionBusy(true);
    setActionError('');
    try {
      const response = await fetch('/api/admin/sold-assets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionDialog.mode,
          lifecycleEventId: actionDialog.record.id,
          assetId: actionDialog.record.assetId,
          sellerUserId: actionDialog.record.sourceUserId,
          buyerUserId: actionDialog.mode === 'allocate' ? selectedBuyerUserId : undefined,
        }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'The action could not be completed.');
      window.location.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The action could not be completed.');
      setActionBusy(false);
    }
  }

  return <>
    <section className={styles.metrics} aria-label="Asset outcome summary">
      <article className={styles.featuredMetric}><span>Total tracked outcomes</span><strong>{report.metrics.totalOutcomes.toLocaleString('en-ZA')}</strong><small>{report.metrics.transferredAccounts.toLocaleString('en-ZA')} allocated · {report.metrics.pendingTransfers.toLocaleString('en-ZA')} waiting</small></article>
      <article><span>Sold</span><strong>{report.metrics.totalSold.toLocaleString('en-ZA')}</strong><small>{report.metrics.soldHelpedByAim4price.toLocaleString('en-ZA')} with Aim4price help</small></article>
      <article><span>Traded in</span><strong>{report.metrics.totalTradedIn.toLocaleString('en-ZA')}</strong><small>{report.metrics.tradedInHelpedByAim4price.toLocaleString('en-ZA')} with Aim4price help</small></article>
      <article><span>Scrapped</span><strong>{report.metrics.totalScrapped.toLocaleString('en-ZA')}</strong><small>{report.metrics.scrappedHelpedByAim4price.toLocaleString('en-ZA')} with Aim4price help</small></article>
    </section>

    <section className={styles.tableCard}>
      <header className={styles.tableHeader}>
        <div className={styles.tableTitle}><h2>Outcomes</h2><strong>{rows.length.toLocaleString('en-ZA')} of {report.outcomes.length.toLocaleString('en-ZA')} · {report.metrics.helpRatePercent}% helped</strong></div>
        <div className={styles.filters}>
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Asset or account" /></label>
          <label><span>Outcome</span><select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value as OutcomeFilter)}><option value="all">All outcomes</option><option value="sold">Sold</option><option value="traded_in">Traded in</option><option value="scrapped">Scrapped</option></select></label>
          <label><span>Aim4price impact</span><select value={influenceFilter} onChange={(event) => setInfluenceFilter(event.target.value as InfluenceFilter)}><option value="all">All answers</option><option value="yes">Yes</option><option value="no">No</option><option value="unsure">Not sure</option><option value="unknown">Not recorded</option></select></label>
          <label><span>Allocation</span><select value={transferFilter} onChange={(event) => setTransferFilter(event.target.value as TransferFilter)}><option value="all">All statuses</option><option value="not_requested">Not allocated</option><option value="pending">Waiting</option><option value="claimed">Allocated</option><option value="cancelled">Closed</option><option value="expired">Code expired</option></select></label>
        </div>
      </header>
      <div className={styles.tableScroller}>
        <table><thead><tr><th>Date</th><th>Outcome</th><th>Asset</th><th>Source account</th><th>Amount excl. VAT</th><th>Aim4price helped</th><th>Allocation</th><th>Actions</th></tr></thead><tbody>{rows.map((record) => {
          const alreadyMoved = record.transferStatus === 'claimed';
          return <tr key={record.id}><td>{formatDate(record.outcomeDate)}</td><td><span className={`${styles.badge} ${styles[`outcome_${record.outcome}`]}`}>{OUTCOME_LABELS[record.outcome]}</span></td><td><strong>{record.assetTitle}</strong>{record.assetDescription ? <span>{record.assetDescription}</span> : null}{record.note ? <small>{record.note}</small> : null}</td><td>{record.sourceName}</td><td>{formatMoney(record.amountExVat)}</td><td><span className={`${styles.badge} ${styles[`impact_${record.aim4priceInfluence}`]}`}>{INFLUENCE_LABELS[record.aim4priceInfluence]}</span></td><td><span className={`${styles.badge} ${styles[`transfer_${record.transferStatus}`]}`}>{TRANSFER_LABELS[record.transferStatus]}</span></td><td><div className={styles.rowActions}><button type="button" onClick={() => openAction('allocate', record)} disabled={alreadyMoved} title={alreadyMoved ? 'This asset has already moved to another account.' : 'Restore it or allocate it to an Owner or Dealer account'}>Allocate</button><button type="button" className={styles.rowDelete} onClick={() => openAction('delete', record)} disabled={alreadyMoved} title={alreadyMoved ? 'Allocated assets cannot be deleted from the source account.' : 'Delete this outcome record'}>Delete</button></div></td></tr>;
        })}</tbody></table>
        {!rows.length ? <div className={styles.empty}>No asset outcomes match these filters.</div> : null}
      </div>
    </section>

    {actionDialog ? <div className={styles.actionDialog} role="dialog" aria-modal="true" aria-labelledby="asset-outcome-action-title">
      <button type="button" className={styles.actionBackdrop} onClick={() => { if (!actionBusy) setActionDialog(null); }} aria-label="Close asset outcome action" />
      <section className={styles.actionModal}>
        <header><h2 id="asset-outcome-action-title">{actionDialog.mode === 'allocate' ? 'Allocate' : 'Delete'} · {actionDialog.record.assetTitle}</h2><button type="button" onClick={() => setActionDialog(null)} disabled={actionBusy} aria-label="Close">×</button></header>
        {actionDialog.mode === 'allocate' ? <div className={styles.actionBody}>
          <div className={styles.actionNotice}><strong>Choose an account</strong><p>Restore the asset to its original account or allocate it to another Owner or Dealer. Private records never move.</p></div>
          <label className={styles.accountSearch}><span>Find destination account</span><input type="search" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Business, person or email" autoFocus /></label>
          <div className={styles.accountList} role="radiogroup" aria-label="Choose destination account">
            <button type="button" className={selectedBuyerUserId === actionDialog.record.sourceUserId ? styles.accountSelected : ''} role="radio" aria-checked={selectedBuyerUserId === actionDialog.record.sourceUserId} onClick={() => setSelectedBuyerUserId(actionDialog.record.sourceUserId)}><span><strong>{actionDialog.record.sourceName}</strong><small>Reverse this outcome and make the asset active again</small></span><em>Original account</em></button>
            {availableAccounts.length ? availableAccounts.map((account) => <button key={account.userId} type="button" className={selectedBuyerUserId === account.userId ? styles.accountSelected : ''} role="radio" aria-checked={selectedBuyerUserId === account.userId} onClick={() => setSelectedBuyerUserId(account.userId)}><span><strong>{account.name}</strong><small>{account.email || 'No email shown'}</small></span><em>{account.accountType === 'dealer' ? 'Dealer' : 'Owner'} · {account.accountSubtype}</em></button>) : accountSearch.trim() ? <p>No other active Owner or Dealer accounts match this search.</p> : null}
          </div>
        </div> : <div className={styles.actionBody}>
          <div className={`${styles.actionNotice} ${styles.deleteNotice}`}><strong>Delete outcome?</strong><p>The record leaves this report, but the asset remains archived. Use Allocate to restore it.</p></div>
        </div>}
        {actionError ? <p className={styles.actionError}>{actionError}</p> : null}
        <footer><button type="button" onClick={() => setActionDialog(null)} disabled={actionBusy}>Cancel</button><button type="button" className={actionDialog.mode === 'delete' ? styles.confirmDelete : styles.confirmAllocate} onClick={() => void submitAction()} disabled={actionBusy || (actionDialog.mode === 'allocate' && !selectedBuyerUserId)}>{actionBusy ? 'Saving…' : actionDialog.mode === 'allocate' ? selectedBuyerUserId === actionDialog.record.sourceUserId ? 'Restore asset' : 'Allocate asset' : 'Delete outcome record'}</button></footer>
      </section>
    </div> : null}
  </>;
}
