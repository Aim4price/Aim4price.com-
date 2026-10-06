'use client';
import { assetModalUsage } from '../../lib/asset-modal-usage';
import { useLeadDialog } from './useLeadDialog';
import { useId, type ReactNode } from 'react';
import assetStyles from '../../app/asset-register/page.module.css';
import leadStyles from '../../app/leads/page.module.css';
import dialogStyles from '../AccountDialog.module.css';
import ShareModalCloseButton from '../asset-register/ShareModalCloseButton';

/** Shared by inbox leads and live-link enquiries. Children own permission checks. */
export default function LeadManageDialog({title, description, onClose, children, classes = {}, ownerLayout = false}: {
  title: string; description: string; onClose: () => void; children: ReactNode;
  ownerLayout?: boolean;
  classes?: {overlay?: string; modal?: string; header?: string; body?: string};
}) {
  const titleId = useId();
  const dialogRef = useLeadDialog(onClose);
  return <div className={`${assetStyles.modalOverlay} ${assetStyles.ownerCommandOverlay} ${classes.overlay ?? `${leadStyles.dealerDesktopLeads} ${leadStyles.leadManageOverlay}`}`} data-website-overlay data-account-asset-modal={ownerLayout || undefined} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={assetStyles.modalBackdrop} data-website-overlay onClick={onClose}/>
    <section ref={dialogRef} tabIndex={-1} className={`${assetStyles.optionsModal} ${assetStyles.ownerCommandModal} ${classes.modal ?? `${leadStyles.leadManageModal} ${dialogStyles.surface} ${dialogStyles.flush}`}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className={`${assetStyles.modalHeader} ${assetStyles.optionsModalHeader} ${classes.header ?? dialogStyles.header}`}>
        <div className={assetStyles.modalHeaderText}><h3 id={titleId}>{title}</h3>{assetModalUsage(description) ? <p>{assetModalUsage(description)}</p> : null}</div>
        <ShareModalCloseButton onClick={onClose} aria-label="Close lead management"/>
      </header>
      <div className={`${assetStyles.modalScrollBody} ${assetStyles.optionsScrollBody} ${assetStyles.ownerCommandScrollBody} ${classes.body ?? `${leadStyles.leadManageScrollBody} ${dialogStyles.body}`}`}>{children}</div>
    </section>
  </div>;
}
