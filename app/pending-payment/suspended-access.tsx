'use client';

import { useState } from 'react';
import AppHeader from '../../components/AppHeader';
import { InvoicePreview } from '../../components/InvoicePreview';
import { money, type BillingInvoice } from '../../lib/billing-shared';
import styles from './suspended-access.module.css';

export default function SuspendedAccess({ suspension }: {
  suspension?: { reason: string; invoice: BillingInvoice } | null;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const invoice = suspension?.invoice;
  const available = invoice?.status === 'issued';
  const balance = invoice ? Math.max(0, invoice.totalCents - invoice.paidCents) : 0;

  return <main className={styles.page} data-suspension-page>
    <AppHeader active="none" />
    <section className={styles.hero} aria-labelledby="pending-access-heading">
      <div className={styles.overlay} />
      <div className={styles.grid}>
        <div className={styles.copy}>
          <h1 id="pending-access-heading">Account paused.</h1>
          <div className={styles.reason}>
            <strong>Reason</strong>
            <p>{suspension?.reason || 'Account access is under review.'}</p>
          </div>
        </div>
        {available && invoice ? <button type="button" className={styles.invoiceCard} onClick={() => setPreviewOpen(true)} aria-label="Open invoice" aria-haspopup="dialog">
          <span className={styles.documentIcon}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg></span>
          <strong className={styles.cardTitle}>Open invoice</strong>
          <span className={styles.invoiceSummary}>
            <span className={styles.number}>{invoice.number}</span>
            <strong className={styles.amount}>{money(balance)}</strong>
            <span className={styles.balanceLabel}>Outstanding balance</span>
          </span>
        </button> : <aside className={styles.unavailable}>
          <span className={styles.documentIcon}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span>
          <h2>Access under review</h2>
          <p>{invoice ? 'This invoice is no longer payable.' : 'No invoice linked.'}</p>
        </aside>}
      </div>
    </section>
    {previewOpen && available && invoice ? <InvoicePreview id={invoice.id} number={invoice.number} onClose={() => setPreviewOpen(false)} /> : null}
  </main>;
}
