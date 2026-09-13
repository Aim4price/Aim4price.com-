'use client';

import styles from './AssetGroupManagerModal.module.css';
import registerStyles from '../../app/asset-register/page.module.css';
import accountStyles from '../../app/account/page.module.css';

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
    <div className={`${registerStyles.modalOverlay} ${styles.accountBackdrop}`} data-website-overlay>
      <div className={registerStyles.modalBackdrop} data-website-overlay onClick={disabled ? undefined : onClose} />
      <section className={`${styles.accountModal} ${accountStyles.modalTheme} ${registerStyles.umbrellaAccountModal} ${registerStyles.optionsModal} ${styles.manageModal}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={`${registerStyles.modalHeader} ${styles.manageHeader}`}>
          <div className={registerStyles.modalHeaderText}>
            <h3 id={titleId} tabIndex={-1} title={subject}>Share {kind === 'register' ? 'asset register' : kind}</h3>
            <p>Choose how to share.</p>
          </div>
          <button className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} type="button" onClick={onClose} disabled={disabled} aria-label="Close share options">×</button>
        </header>
        <div className={`${registerStyles.modalScrollBody} ${registerStyles.optionsScrollBody} ${styles.manageMenuBody}`}>
          <div className={`${registerStyles.optionsContent} ${styles.manageMenuContent}`}>
            <div className={`${registerStyles.optionsGrid} ${registerStyles.assetOptionsGrid} ${styles.manageMenuGrid}`}>
              <button className={`${registerStyles.optionActionButton} ${registerStyles.optionFeaturedButton} ${styles.manageMenuAction}`} type="button" onClick={onInside} disabled={disabled}>
                <i className={`${styles.manageMenuIconTile} ${styles.manageMenuEditIcon}`} aria-hidden="true"><svg className={styles.manageMenuIconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-9h6v9M9 8h6" /></svg></i>
                <span><strong>Inside Aim4price</strong><small className={styles.menuOptionSubtitle}>Share with a partner</small></span>
              </button>
              <button className={`${registerStyles.optionActionButton} ${styles.manageMenuAction} ${styles.manageMenuReport}`} type="button" onClick={onOutside} disabled={disabled}>
                <i className={`${styles.manageMenuIconTile} ${styles.manageMenuReportIcon}`} aria-hidden="true"><svg className={styles.manageMenuIconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="12" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg></i>
                <span><strong>Outside Aim4price</strong><small className={styles.menuOptionSubtitle}>WhatsApp or email</small></span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
