'use client';

import SuspendedAccess from "./suspended-access";
import type { BillingInvoice } from "../../lib/billing-shared";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import styles from "./suspended-access.module.css";

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
  if (isSuspended) return <SuspendedAccess suspension={suspension} />;

  return (
    <main className={styles.page} data-account-access-page>
      <AppHeader active="none" />
      <section className={styles.hero} aria-labelledby="pending-access-heading">
        <div className={styles.overlay} />
        <div className={styles.grid}>
          <div className={`${styles.copy} ${styles.pendingCopy}`}>
            <span className={`${styles.status} ${styles.pendingStatus}`}><span aria-hidden="true"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/><path d="M8 5v3l2 1"/></svg></span>Awaiting approval</span>
            <h1 id="pending-access-heading">Pending approval</h1>
            <p className={styles.intro}>Your Aim4price account is ready for review. Access will unlock once payment and admin approval are complete.</p>
            <div className={`${styles.reason} ${styles.pendingReason}`}>
              <strong>{statusLabel}</strong>
              <p>{email || 'Your account is awaiting approval.'}</p>
              <span>You can view your invoices while we review your account.</span>
            </div>
          </div>
          <Link href="/billing" className={styles.invoiceCard}>
            <span className={styles.documentIcon}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg></span>
            <strong className={styles.cardTitle}>Your invoices</strong>
            <span className={styles.cardHint}>Invoices and payment details, in one place.</span>
            <span className={styles.cardAction}>View invoices</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
