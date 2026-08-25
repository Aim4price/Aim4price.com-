'use client';

import { useMemo, useState } from 'react';
import type { AdminAssetAllocationAccount, AdminAssetSalesReport, AdminAssetSaleRow } from '../../../lib/admin-asset-sales';
import styles from './page.module.css';

type InfluenceFilter = 'all' | AdminAssetSaleRow['aim4priceInfluence'];
type TransferFilter = 'all' | AdminAssetSaleRow['transferStatus'];
type ActionDialog = { mode: 'allocate' | 'delete'; sale: AdminAssetSaleRow } | null;

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

function formatMoney(value: number | null) {
  if (value === null) return 'Not saved';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
}

const INFLUENCE_LABELS: Record<AdminAssetSaleRow['aim4priceInfluence'], string> = { yes: 'Yes', no: 'No', unsure: 'Not sure', unknown: 'Not recorded' };
const TRANSFER_LABELS: Record<AdminAssetSaleRow['transferStatus'], string> = { not_requested: 'No transfer', pending: 'Waiting', claimed: 'Claimed', cancelled: 'Archived', expired: 'Expired' };

export default function SoldAssetsClient({ report, allocationAccounts }: { report: AdminAssetSalesReport; allocationAccounts: AdminAssetAllocationAccount[] }) {
  const [search, setSearch] = useState('');
  const [influenceFilter, setInfluenceFilter] = useState<InfluenceFilter>('all');
  const [transferFilter, setTransferFilter] = useState<TransferFilter>('all');
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [selectedBuyerUserId, setSelectedBuyerUserId] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return report.sales.filter((sale) => {
      if (influenceFilter !== 'all' && sale.aim4priceInfluence !== influenceFilter) return false;
      if (transferFilter !== 'all' && sale.transferStatus !== transferFilter) return false;
      if (!term) return true;
      return [sale.assetTitle, sale.assetDescription, sale.sellerName, sale.note].join(' ').toLowerCase().includes(term);
    });
  }, [influenceFilter, report.sales, search, transferFilter]);

  const availableAccounts = useMemo(() => {
    if (actionDialog?.mode !== 'allocate') return [];
    const term = accountSearch.trim().toLowerCase();
    return allocationAccounts.filter((account) => account.userId !== actionDialog.sale.sellerUserId && (!term || [account.name, account.email, account.accountSubtype].join(' ').toLowerCase().includes(term)));
  }, [accountSearch, actionDialog, allocationAccounts]);

  function openAction(mode: NonNullable<ActionDialog>['mode'], sale: AdminAssetSaleRow) {
    setActionDialog({ mode, sale });
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
          lifecycleEventId: actionDialog.sale.id,
          assetId: actionDialog.sale.assetId,
          sellerUserId: actionDialog.sale.sellerUserId,
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
    <section className={styles.metrics} aria-label="Sold asset summary">
      <article className={styles.featuredMetric}><span>Total assets sold</span><strong>{report.metrics.totalSold.toLocaleString('en-ZA')}</strong><small>Recorded sale events</small></article>
      <article><span>Sold with Aim4price help</span><strong>{report.metrics.helpedByAim4price.toLocaleString('en-ZA')}</strong><small>{report.metrics.helpRatePercent}% of yes/no answers</small></article>
      <article><span>Transferred between accounts</span><strong>{report.metrics.transferredAccounts.toLocaleString('en-ZA')}</strong><small>Successfully claimed or allocated</small></article>
      <article><span>Waiting transfers</span><strong>{report.metrics.pendingTransfers.toLocaleString('en-ZA')}</strong><small>Pending or expired codes</small></article>
    </section>

    <section className={styles.tableCard}>
      <header className={styles.tableHeader}>
        <div><p>Sale records</p><h2>Reported sold assets</h2><span>{rows.length.toLocaleString('en-ZA')} of {report.sales.length.toLocaleString('en-ZA')} records</span></div>
        <div className={styles.filters}>
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Asset or account" /></label>
          <label><span>Aim4price impact</span><select value={influenceFilter} onChange={(event) => setInfluenceFilter(event.target.value as InfluenceFilter)}><option value="all">All answers</option><option value="yes">Yes</option><option value="no">No</option><option value="unsure">Not sure</option><option value="unknown">Not recorded</option></select></label>
          <label><span>Transfer</span><select value={transferFilter} onChange={(event) => setTransferFilter(event.target.value as TransferFilter)}><option value="all">All statuses</option><option value="not_requested">No transfer</option><option value="pending">Waiting</option><option value="claimed">Claimed</option><option value="cancelled">Archived</option><option value="expired">Expired</option></select></label>
        </div>
      </header>
      <div className={styles.tableScroller}>
        <table><thead><tr><th>Sold</th><th>Asset</th><th>Seller account</th><th>Amount excl. VAT</th><th>Aim4price helped</th><th>Transfer</th><th>Actions</th></tr></thead><tbody>{rows.map((sale) => {
          const alreadyMoved = sale.transferStatus === 'claimed';
          return <tr key={sale.id}><td>{formatDate(sale.soldDate)}</td><td><strong>{sale.assetTitle}</strong>{sale.assetDescription ? <span>{sale.assetDescription}</span> : null}{sale.note ? <small>{sale.note}</small> : null}</td><td>{sale.sellerName}</td><td>{formatMoney(sale.amountExVat)}</td><td><span className={`${styles.badge} ${styles[`impact_${sale.aim4priceInfluence}`]}`}>{INFLUENCE_LABELS[sale.aim4priceInfluence]}</span></td><td><span className={`${styles.badge} ${styles[`transfer_${sale.transferStatus}`]}`}>{TRANSFER_LABELS[sale.transferStatus]}</span></td><td><div className={styles.rowActions}><button type="button" onClick={() => openAction('allocate', sale)} disabled={alreadyMoved} title={alreadyMoved ? 'This asset has already moved to another account.' : 'Allocate this asset to an Owner or Dealer account'}>Allocate</button><button type="button" className={styles.rowDelete} onClick={() => openAction('delete', sale)} disabled={alreadyMoved} title={alreadyMoved ? 'Claimed assets cannot be deleted from the seller account.' : 'Delete this sold asset record'}>Delete</button></div></td></tr>;
        })}</tbody></table>
        {!rows.length ? <div className={styles.empty}>No sold assets match these filters.</div> : null}
      </div>
    </section>

    {actionDialog ? <div className={styles.actionDialog} role="dialog" aria-modal="true" aria-labelledby="sold-asset-action-title">
      <button type="button" className={styles.actionBackdrop} onClick={() => { if (!actionBusy) setActionDialog(null); }} aria-label="Close sold asset action" />
      <section className={styles.actionModal}>
        <header><div><p>{actionDialog.mode === 'allocate' ? 'Allocate asset' : 'Delete sold record'}</p><h2 id="sold-asset-action-title">{actionDialog.sale.assetTitle}</h2><span>Sold by {actionDialog.sale.sellerName}</span></div><button type="button" onClick={() => setActionDialog(null)} disabled={actionBusy} aria-label="Close">×</button></header>
        {actionDialog.mode === 'allocate' ? <div className={styles.actionBody}>
          <div className={styles.actionNotice}><strong>Ownership allocation</strong><p>The portable asset dossier moves to the selected active Owner register or Dealer inventory. Seller-private invoices, finance, insurance and account access do not move.</p></div>
          <label className={styles.accountSearch}><span>Find destination account</span><input type="search" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Business, person or email" autoFocus /></label>
          <div className={styles.accountList} role="radiogroup" aria-label="Choose destination account">{availableAccounts.length ? availableAccounts.map((account) => <button key={account.userId} type="button" className={selectedBuyerUserId === account.userId ? styles.accountSelected : ''} role="radio" aria-checked={selectedBuyerUserId === account.userId} onClick={() => setSelectedBuyerUserId(account.userId)}><span><strong>{account.name}</strong><small>{account.email || 'No email shown'}</small></span><em>{account.accountType === 'dealer' ? 'Dealer' : 'Owner'} · {account.accountSubtype}</em></button>) : <p>No active Owner or Dealer accounts match this search.</p>}</div>
        </div> : <div className={styles.actionBody}>
          <div className={`${styles.actionNotice} ${styles.deleteNotice}`}><strong>Remove this sold record?</strong><p>The asset will remain archived for audit and linked financial history, but it will leave Sold Assets reporting. A pending claim code will be cancelled. This cannot be used after the asset has moved to a buyer.</p></div>
        </div>}
        {actionError ? <p className={styles.actionError}>{actionError}</p> : null}
        <footer><button type="button" onClick={() => setActionDialog(null)} disabled={actionBusy}>Cancel</button><button type="button" className={actionDialog.mode === 'delete' ? styles.confirmDelete : styles.confirmAllocate} onClick={() => void submitAction()} disabled={actionBusy || (actionDialog.mode === 'allocate' && !selectedBuyerUserId)}>{actionBusy ? 'Saving…' : actionDialog.mode === 'allocate' ? 'Allocate asset' : 'Delete sold record'}</button></footer>
      </section>
    </div> : null}
  </>;
}
