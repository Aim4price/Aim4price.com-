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

  return <main className={styles.page} data-suspension-page data-account-access-page>
    <AppHeader active="none" />
    <section className={styles.hero} aria-labelledby="pending-access-heading">
      <div className={styles.overlay} />
      <div className={styles.grid}>
        <div className={styles.copy}>
          <span className={styles.status}><span aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M5 4v8M11 4v8"/></svg></span>Access paused</span>
          <h1 id="pending-access-heading">Your account is<br />temporarily paused.</h1>
          <p className={styles.intro}>{available
            ? 'Please review your invoice so we can help restore access.'
            : 'Please contact Aim4price so we can review your account access.'}</p>
          <div className={styles.reason}>
            <strong>Reason for suspension</strong>
            <p>{suspension?.reason || 'Your account access has been paused. Contact Aim4price for more information.'}</p>
            <span>{available
              ? 'Once payment is verified, Aim4price will review your access.'
              : invoice ? 'This invoice is no longer payable. Contact Aim4price to review your access.'
              : 'Our team will explain the next steps to restore access.'}</span>
          </div>
        </div>
        {available && invoice ? <button type="button" className={styles.invoiceCard} onClick={() => setPreviewOpen(true)} aria-label="Open invoice" aria-haspopup="dialog">
          <span className={styles.documentIcon}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg></span>
          <strong className={styles.cardTitle}>Open invoice</strong>
          <span className={styles.cardHint}>View invoice and payment details</span>
          <span className={styles.invoiceSummary}>
            <span className={styles.number}>{invoice.number}</span>
            <strong className={styles.amount}>{money(balance)}</strong>
            <span className={styles.balanceLabel}>Outstanding balance</span>
          </span>
        </button> : <aside className={styles.unavailable}>
          <span className={styles.documentIcon}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span>
          <h2>Let’s review your access</h2>
          <p>{invoice ? 'Your linked invoice is no longer available for payment.' : 'There is no invoice linked to this suspension.'}</p>
        </aside>}
      </div>
    </section>
    {previewOpen && available && invoice ? <InvoicePreview id={invoice.id} number={invoice.number} onClose={() => setPreviewOpen(false)} /> : null}
  </main>;
}
