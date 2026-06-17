'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

type ContactSupportModalProps = {
  accountEmail: string | null | undefined;
  statusLabel: string;
};

const SUPPORT_PHONE_DISPLAY = '062 572 1650';
const SUPPORT_PHONE_TEL = '+27625721650';
const SUPPORT_WHATSAPP = '27625721650';
const SUPPORT_EMAIL = 'aim4price@gmail.com';

export default function ContactSupportModal({
  accountEmail,
  statusLabel,
}: ContactSupportModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const supportLinks = useMemo(() => {
    const safeEmail = accountEmail?.trim() || 'the email linked to my account';
    const safeStatus = statusLabel?.trim() || 'account access';
    const message = `Hi Aim4price, I need help with my account status. Status: ${safeStatus}. Signed in as: ${safeEmail}.`;
    const subject = encodeURIComponent('Aim4price account support');
    const body = encodeURIComponent(message);
    const whatsappText = encodeURIComponent(message);

    return {
      call: `tel:${SUPPORT_PHONE_TEL}`,
      email: `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`,
      whatsapp: `https://wa.me/${SUPPORT_WHATSAPP}?text=${whatsappText}`,
    };
  }, [accountEmail, statusLabel]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        className={styles.primaryButton}
        type="button"
        onClick={() => setIsOpen(true)}
      >
        Contact Aim4price
      </button>

      {isOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setIsOpen(false)}
        >
          <section
            aria-labelledby="contact-support-title"
            aria-modal="true"
            className={styles.modal}
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalKicker}>Aim4price support</span>
                <h2 id="contact-support-title" className={styles.modalTitle}>
                  How would you like to contact us?
                </h2>
              </div>
              <button
                aria-label="Close contact options"
                className={styles.modalCloseButton}
                type="button"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>

            <p className={styles.modalText}>
              Use these options for payment approval, account activation, or a
              suspended-account review. Include the email address shown on this page
              when contacting support.
            </p>

            <div className={styles.contactOptions}>
              <a className={styles.contactOption} href={supportLinks.call}>
                <span className={styles.contactOptionLabel}>Call</span>
                <strong>{SUPPORT_PHONE_DISPLAY}</strong>
              </a>

              <a className={styles.contactOption} href={supportLinks.email}>
                <span className={styles.contactOptionLabel}>Email</span>
                <strong>{SUPPORT_EMAIL}</strong>
              </a>

              <a
                className={styles.contactOption}
                href={supportLinks.whatsapp}
                rel="noreferrer"
                target="_blank"
              >
                <span className={styles.contactOptionLabel}>WhatsApp</span>
                <strong>{SUPPORT_PHONE_DISPLAY}</strong>
              </a>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
