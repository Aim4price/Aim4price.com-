'use client';

import { useMemo, useState } from 'react';
import type { AdminAssetSalesReport, AdminAssetSaleRow } from '../../../lib/admin-asset-sales';
import styles from './page.module.css';

type InfluenceFilter = 'all' | AdminAssetSaleRow['aim4priceInfluence'];
type TransferFilter = 'all' | AdminAssetSaleRow['transferStatus'];

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

export default function SoldAssetsClient({ report }: { report: AdminAssetSalesReport }) {
  const [search, setSearch] = useState('');
  const [influenceFilter, setInfluenceFilter] = useState<InfluenceFilter>('all');
  const [transferFilter, setTransferFilter] = useState<TransferFilter>('all');
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return report.sales.filter((sale) => {
      if (influenceFilter !== 'all' && sale.aim4priceInfluence !== influenceFilter) return false;
      if (transferFilter !== 'all' && sale.transferStatus !== transferFilter) return false;
      if (!term) return true;
      return [sale.assetTitle, sale.assetDescription, sale.sellerName, sale.note].join(' ').toLowerCase().includes(term);
    });
  }, [influenceFilter, report.sales, search, transferFilter]);

  return <>
    <section className={styles.metrics} aria-label="Sold asset summary">
      <article className={styles.featuredMetric}><span>Total assets sold</span><strong>{report.metrics.totalSold.toLocaleString('en-ZA')}</strong><small>Recorded sale events</small></article>
      <article><span>Sold with Aim4price help</span><strong>{report.metrics.helpedByAim4price.toLocaleString('en-ZA')}</strong><small>{report.metrics.helpRatePercent}% of yes/no answers</small></article>
      <article><span>Transferred between accounts</span><strong>{report.metrics.transferredAccounts.toLocaleString('en-ZA')}</strong><small>Successfully claimed</small></article>
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
        <table><thead><tr><th>Sold</th><th>Asset</th><th>Seller account</th><th>Amount excl. VAT</th><th>Aim4price helped</th><th>Transfer</th></tr></thead><tbody>{rows.map((sale) => <tr key={sale.id}><td>{formatDate(sale.soldDate)}</td><td><strong>{sale.assetTitle}</strong>{sale.assetDescription ? <span>{sale.assetDescription}</span> : null}{sale.note ? <small>{sale.note}</small> : null}</td><td>{sale.sellerName}</td><td>{formatMoney(sale.amountExVat)}</td><td><span className={`${styles.badge} ${styles[`impact_${sale.aim4priceInfluence}`]}`}>{INFLUENCE_LABELS[sale.aim4priceInfluence]}</span></td><td><span className={`${styles.badge} ${styles[`transfer_${sale.transferStatus}`]}`}>{TRANSFER_LABELS[sale.transferStatus]}</span></td></tr>)}</tbody></table>
        {!rows.length ? <div className={styles.empty}>No sold assets match these filters.</div> : null}
      </div>
    </section>
  </>;
}
