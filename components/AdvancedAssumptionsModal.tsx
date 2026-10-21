'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import modal from './estimate-modal.module.css';
import styles from './advanced-assumptions-modal.module.css';

type Props = {
  open: boolean;
  busy: boolean;
  locked: boolean;
  error: string;
  children: ReactNode;
  onClose: () => void;
  onApply: () => void;
};

export default function AdvancedAssumptionsModal({ open, busy, locked, error, children, onClose, onApply }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return <dialog ref={dialog} className={`${styles.dialog} ${modal.surface}`}
    aria-labelledby="advanced-assumptions-title" aria-describedby="advanced-assumptions-description"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form className={styles.form} onSubmit={event => { event.preventDefault(); if (!busy && !locked) onApply(); }} aria-busy={busy}>
      <header className={styles.header}>
        <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 3v6m0 4v8M12 3v10m0 4v4M18 3v2m0 4v12M3 9h6m0 8h6m0-12h6"/></svg></span>
        <div><h2 id="advanced-assumptions-title" data-estimate-modal-title>Advanced assumptions</h2><p id="advanced-assumptions-description">Fine-tune this estimate to reflect your asset.</p></div>
        <button type="button" data-modal-close className={modal.close} disabled={busy} onClick={onClose} aria-label="Close advanced assumptions">×</button>
      </header>
      <div className={styles.body}>
        {locked ? <p className={styles.note}>Editing requires an active Aim4price account.</p> : null}
        {children}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </div>
      <footer className={`${modal.actions} ${styles.actions}`}>
        <button type="button" disabled={busy} onClick={onClose}>Close</button>
        {!locked ? <button type="submit" className={modal.primary} disabled={busy}>{busy ? 'Recalculating...' : 'Recalculate estimate'}</button> : null}
      </footer>
    </form>
  </dialog>;
}
