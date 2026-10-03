'use client';
import { useLeadDialog } from './useLeadDialog';
import { useId, type ReactNode } from 'react';
import styles from '../DealerAssetCorrectionEditor.module.css';
import dialogStyles from '../AccountDialog.module.css';

export default function LeadActionDialog({title, assetTitle, onClose, busy = false, children, footer, closeLabel = 'Close action form', className = ''}: {
  title: string; assetTitle: string; onClose: () => void; busy?: boolean; children: ReactNode; footer?: ReactNode; closeLabel?: string; className?: string;
}) {
  const titleId = useId();
  const dialogRef = useLeadDialog(onClose, busy);
  return <div className={styles.overlay} data-website-overlay role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className={`${styles.modal} ${dialogStyles.surface} ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className={`${styles.modalHeader} ${dialogStyles.header}`}>
        <div className={styles.modalTitleGroup}><div className={styles.modalHeaderCopy}><h2 id={titleId}>{title}</h2><p>{assetTitle}</p></div></div>
        <button type="button" className={`${styles.closeButton} ${dialogStyles.close}`} onClick={onClose} disabled={busy} aria-label={closeLabel}>×</button>
      </header>
      <div className={`${styles.modalBody} ${dialogStyles.body}`}>{children}</div>
      {footer && <footer className={`${styles.modalFooter} ${dialogStyles.footer}`}>{footer}</footer>}
    </section>
  </div>;
}
