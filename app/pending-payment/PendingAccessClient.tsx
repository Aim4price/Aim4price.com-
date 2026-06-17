'use client';

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import AppHeader from "../../components/AppHeader";
import styles from "./page.module.css";

type PendingAccessClientProps = {
  email: string;
  statusLabel: string;
  isSuspended: boolean;
};

const CONTACT_PHONE_DISPLAY = "062 572 1650";
const CONTACT_PHONE_TEL = "0625721650";
const CONTACT_EMAIL = "aim4price@gmail.com";
const CONTACT_WHATSAPP = "https://wa.me/27625721650";

export default function PendingAccessClient({
  email,
  statusLabel,
  isSuspended,
}: PendingAccessClientProps) {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const modalTitleId = useId();
  const modalDescriptionId = useId();

  useEffect(() => {
    if (!isContactModalOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsContactModalOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isContactModalOpen]);

  const pageTitle = isSuspended
    ? "Account access paused"
    : "Account pending approval";
  const pageText = isSuspended
    ? "This account is currently suspended. Contact Aim4price to review your access."
    : "Your Aim4price account has been created. Access will unlock once payment and admin approval are complete.";
  const stateLabel = isSuspended ? "Suspended access" : "Pending payment";

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

          <div className={styles.actions}>
            <Link href="/" className={styles.secondaryButton}>
              Back to home
            </Link>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setIsContactModalOpen(true)}
            >
              Contact Aim4price
            </button>
          </div>
        </div>
      </section>

      {isContactModalOpen ? (
        <div
          className={styles.modalBackdrop}
          onClick={() => setIsContactModalOpen(false)}
        >
          <section
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            aria-describedby={modalDescriptionId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id={modalTitleId}>Contact Aim4price</h2>
              <p id={modalDescriptionId}>Choose how you would like to contact us.</p>
            </div>

            <div className={styles.contactDetails}>
              <div>
                <span>Number</span>
                <strong>{CONTACT_PHONE_DISPLAY}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{CONTACT_EMAIL}</strong>
              </div>
            </div>

            <div className={styles.modalActions}>
              <a href={`tel:${CONTACT_PHONE_TEL}`} className={styles.modalPrimaryButton}>
                Call
              </a>
              <a href={`mailto:${CONTACT_EMAIL}`} className={styles.modalSecondaryButton}>
                Email
              </a>
              <a
                href={CONTACT_WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className={styles.modalSecondaryButton}
              >
                WhatsApp
              </a>
            </div>

            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setIsContactModalOpen(false)}
              aria-label="Close contact modal"
            >
              Close
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
