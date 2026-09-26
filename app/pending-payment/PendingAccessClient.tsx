'use client';

import InlineBillingInvoice from "../../components/InlineBillingInvoice";
import BillingInvoiceCard from "../../components/BillingInvoiceCard";
import type { BillingInvoice } from "../../lib/billing-shared";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import ContactSupportModal from "./contact-support-modal";
import styles from "./page.module.css";

type PendingAccessClientProps = {
  suspension?: {reason:string;invoice:BillingInvoice}|null;
  email: string;
  statusLabel: string;
  isSuspended: boolean;
};

export default function PendingAccessClient({
  suspension,
  email,
  statusLabel,
  isSuspended,
}: PendingAccessClientProps) {
  const pageTitle = isSuspended
    ? "Account access paused"
    : "Account pending approval";
  const pageText = isSuspended
    ? "This account is currently suspended. Contact Aim4price to review your access."
    : "Your Aim4price account has been created. Access will unlock once payment and admin approval are complete.";
  const stateLabel = isSuspended ? "Access paused" : "Admin approval";

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section className={styles.shell} aria-labelledby="pending-access-heading">
        <div className={styles.panel}>
          <div className={styles.contentGrid}>
            <div className={styles.copyBlock}>
              <span className={styles.stateLabel}>{stateLabel}</span>
              <h1 id="pending-access-heading" className={styles.title}>
                {pageTitle}
              </h1>
              <p className={styles.text}>{suspension?'Account access is suspended. Please review the reason and invoice below.':pageText}</p>
              {suspension?<div className={styles.reason}><strong>Why access is suspended</strong><p>{suspension.reason}</p><span>After payment is verified, Aim4price will review and restore access.</span></div>:null}

              <div className={styles.actions}>
                <Link href="/" className={styles.secondaryButton}>
                  Back to home
                </Link>
                <Link href="/billing" className={styles.secondaryButton}>View invoices</Link>
                <ContactSupportModal />
              </div>
            </div>

            <aside className={styles.summaryCard} aria-label="Account summary">
              <div className={styles.summaryRow}>
                <span>Signed in as</span>
                <strong>{email || "Unknown email"}</strong>
              </div>
              <div className={styles.summaryRule} aria-hidden="true" />
              <div className={styles.summaryRow}>
                <span>Current status</span>
                <strong>{statusLabel}</strong>
              </div>
            </aside>
          </div>
        </div>
        {suspension?<div className={styles.invoiceSection}><BillingInvoiceCard invoice={suspension.invoice} showPreview={false}/>{suspension.invoice.status==='issued'?<InlineBillingInvoice id={suspension.invoice.id}/>:<p className={styles.text}>This invoice has been voided. Please contact Aim4price to review your access.</p>}</div>:null}
      </section>
    </main>
  );
}
