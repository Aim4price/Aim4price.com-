'use client';

import type { ReactNode } from 'react';
import base from './ShareDestinationDialog.module.css';
import styles from './InsideShareDialog.module.css';

type Option = { id: string; title: string; description: string; icon: ReactNode; onSelect: () => void };

export default function InsideShareDialog({ titleId, subject, options, disabled = false, onClose }: {
  titleId: string;
  subject: string;
  options: Option[];
  disabled?: boolean;
  onClose: () => void;
}) {
  return (
    <div className={base.overlay} data-website-overlay>
      <div className={base.backdrop} data-website-overlay onClick={disabled ? undefined : onClose} />
      <section className={`${base.dialog} ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={`${base.header} ${styles.header}`}>
          <div>
            <h3 id={titleId} tabIndex={-1} title={subject}>Share inside Aim4price</h3>
            <p>Choose who to share with.</p>
          </div>
          <button className={base.close} type="button" onClick={onClose} disabled={disabled} aria-label="Back to share options">×</button>
        </header>
        <div className={styles.grid}>
          {options.map(option => (
            <button key={option.id} type="button" className={styles.card} data-tone={option.id} onClick={option.onSelect} disabled={disabled}>
              <span className={styles.icon} aria-hidden="true">{option.icon}</span>
              <span className={styles.copy}><strong>{option.title}</strong><small>{option.description}</small></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
