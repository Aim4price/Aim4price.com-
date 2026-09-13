'use client';

import styles from './ShareDestinationDialog.module.css';

type Props = {
  kind: 'register' | 'umbrella' | 'asset';
  titleId: string;
  subject: string;
  disabled?: boolean;
  onClose: () => void;
  onInside: () => void;
  onOutside: () => void;
};

/** Shared entry point; the existing sharing flows still own recipients and sending. */
export default function ShareDestinationDialog({ kind, titleId, subject, disabled = false, onClose, onInside, onOutside }: Props) {
  return (
    <div className={styles.overlay} data-website-overlay>
      <div className={styles.backdrop} data-website-overlay onClick={disabled ? undefined : onClose} />
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.header}>
          <div>
            <h3 id={titleId} tabIndex={-1} title={subject}>Share {kind === 'register' ? 'asset register' : kind}</h3>
            <p>Choose where to share.</p>
          </div>
          <button className={styles.close} type="button" onClick={onClose} disabled={disabled} aria-label="Close share options">×</button>
        </header>
        <div className={styles.choices}>
          <button className={styles.choice} type="button" onClick={onInside} disabled={disabled}>
            <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-9h6v9M9 8h6" /></svg></span>
            <span className={styles.copy}><strong>Inside Aim4price</strong><small>Aim4price partners</small></span>
            <span className={styles.arrow} aria-hidden="true">›</span>
          </button>
          <button className={`${styles.choice} ${styles.outside}`} type="button" onClick={onOutside} disabled={disabled}>
            <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="12" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg></span>
            <span className={styles.copy}><strong>Outside Aim4price</strong><small>WhatsApp or email</small></span>
            <span className={styles.arrow} aria-hidden="true">›</span>
          </button>
        </div>
      </section>
    </div>
  );
}
