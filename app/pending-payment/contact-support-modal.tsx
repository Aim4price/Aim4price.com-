'use client';

import type { SVGProps } from 'react';
import { useEffect, useId, useState } from 'react';
import styles from './page.module.css';

const SUPPORT_PHONE_DISPLAY = '062 572 1650';
const SUPPORT_PHONE_TEL = '0625721650';
const SUPPORT_WHATSAPP_URL = 'https://wa.me/27625721650';
const SUPPORT_EMAIL = 'aim4price@gmail.com';

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    />
  );
}

function PhoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M6.6 5.4 8.7 4a1.6 1.6 0 0 1 2.25.52l1.1 1.95a1.7 1.7 0 0 1-.34 2.05l-1.07 1.02a10.5 10.5 0 0 0 3.82 3.82l1.02-1.07a1.7 1.7 0 0 1 2.05-.34l1.95 1.1A1.6 1.6 0 0 1 20 15.3l-1.4 2.1c-.44.66-1.23 1.02-2.02.9C10.7 17.42 6.58 13.3 5.7 7.42c-.12-.79.24-1.58.9-2.02Z" />
    </IconBase>
  );
}

function EmailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4.75 6.75h14.5v10.5H4.75z" />
      <path d="m5.25 7.25 6.75 5.2 6.75-5.2" />
    </IconBase>
  );
}

function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M7.7 18.7 4.9 19.5l.82-2.7A7.15 7.15 0 1 1 7.7 18.7Z" />
      <path d="M9.15 8.85c.18-.4.36-.42.6-.42h.42c.14 0 .33.04.5.38.18.36.6 1.28.65 1.38.05.11.08.25.02.39-.06.15-.1.24-.22.37-.1.13-.24.28-.34.38-.11.11-.22.24-.1.46.11.22.5.86 1.08 1.4.74.66 1.35.87 1.58.97.22.11.36.09.49-.06.14-.16.56-.65.7-.87.15-.22.3-.18.5-.11.21.07 1.32.62 1.55.73.22.11.37.17.43.27.06.1.06.58-.13 1.13-.19.55-1.1 1.05-1.53 1.09-.4.04-.9.06-1.46-.09-.34-.09-.78-.25-1.34-.5-2.35-1.02-3.9-3.4-4.02-3.56-.12-.17-.96-1.28-.96-2.44 0-1.17.6-1.74.82-1.98.21-.24.48-.3.76-.3" />
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
          className={styles.modalBackdrop}
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
                <WhatsAppIcon className={styles.contactActionIcon} />
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
