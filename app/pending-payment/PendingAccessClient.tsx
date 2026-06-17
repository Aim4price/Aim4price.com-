'use client';

import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import ContactSupportModal from "./contact-support-modal";
import styles from "./page.module.css";

type PendingAccessClientProps = {
  email: string;
  statusLabel: string;
  isSuspended: boolean;
};

export default function PendingAccessClient({
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
              <p className={styles.text}>{pageText}</p>

              <div className={styles.actions}>
                <Link href="/" className={styles.secondaryButton}>
                  Back to home
                </Link>
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
      </section>
    </main>
  );
}
