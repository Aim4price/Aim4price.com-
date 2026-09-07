'use client';

import type { SVGProps } from 'react';
import { useEffect, useId, useState } from 'react';
import styles from './page.module.css';

const SUPPORT_PHONE_DISPLAY = '062 572 1650';
const SUPPORT_PHONE_TEL = '0625721650';
const SUPPORT_WHATSAPP_URL = 'https://wa.me/27625721650';
const SUPPORT_EMAIL = 'aim4price@gmail.com';

function IconBase({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.85"
      viewBox="0 0 24 24"
      {...props}
    >
      {children}
    </svg>
  );
}

function PhoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M7.1 5.2 9.02 4a1.45 1.45 0 0 1 2 .48l1 1.76a1.55 1.55 0 0 1-.28 1.82l-.98 1.02a10.1 10.1 0 0 0 4.14 4.14l1.02-.98a1.55 1.55 0 0 1 1.82-.28l1.76 1a1.45 1.45 0 0 1 .48 2L18.8 16.9a2.3 2.3 0 0 1-2.22 1.05C10.9 17.2 6.8 13.1 6.05 7.42A2.3 2.3 0 0 1 7.1 5.2Z" />
    </IconBase>
  );
}

function EmailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="4.75" y="6.75" width="14.5" height="10.5" rx="1.35" />
      <path d="m5.35 7.55 6.65 5.1 6.65-5.1" />
    </IconBase>
  );
}

function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M7.18 17.78 4.75 18.5l.72-2.46a7.35 7.35 0 1 1 1.71 1.74Z" />
      <path d="M8.4 10.15h7.2" />
      <path d="M8.4 13.15h4.95" />
    </IconBase>
  );
}

export default function ContactSupportModal() {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

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
          className={styles.modalBackdrop} data-website-overlay
          role="presentation"
          onClick={() => setIsOpen(false)}
        >
          <section
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            aria-modal="true"
            className={styles.modalCard}
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderText}>
                <h2 id={titleId}>Contact Aim4price</h2>
                <p id={descriptionId}>Choose how you would like to contact us.</p>
              </div>
              <button
                aria-label="Close contact modal"
                className={styles.modalCloseButton}
                type="button"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.contactDetails} aria-label="Aim4price contact details">
              <div>
                <span>Number</span>
                <strong>{SUPPORT_PHONE_DISPLAY}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{SUPPORT_EMAIL}</strong>
              </div>
            </div>

            <div className={styles.contactActions}>
              <a
                className={`${styles.contactAction} ${styles.contactActionPrimary}`}
                href={`tel:${SUPPORT_PHONE_TEL}`}
              >
                <PhoneIcon className={styles.contactActionIcon} />
                <span>Call</span>
              </a>
              <a className={styles.contactAction} href={`mailto:${SUPPORT_EMAIL}`}>
                <EmailIcon className={styles.contactActionIcon} />
                <span>Email</span>
              </a>
              <a
                className={styles.contactAction}
                href={SUPPORT_WHATSAPP_URL}
                rel="noreferrer"
                target="_blank"
              >
                <ChatIcon className={styles.contactActionIcon} />
                <span>WhatsApp</span>
              </a>
            </div>

            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}

