'use client';
import { useLeadDialog } from './useLeadDialog';
import { useId, type ReactNode } from 'react';
import assetStyles from '../../app/asset-register/page.module.css';
import downloadStyles from '../ReportDownload.module.css';
import ShareModalCloseButton from '../asset-register/ShareModalCloseButton';

/** One report picker layout; each entry point supplies its authorised reports. */
export default function LeadReportDialog({title, description, onClose, busy = false, children}: {
  title: string; description: string; onClose: () => void; busy?: boolean; children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useLeadDialog(onClose, busy);
  return <div className={`${assetStyles.modalOverlay} ${assetStyles.subModalOverlay} ${downloadStyles.backdrop}`} data-website-overlay>
    <div className={assetStyles.modalBackdrop} data-website-overlay onClick={busy ? undefined : onClose} data-download-shade="true"/>
    <section ref={dialogRef} tabIndex={-1} className={`${assetStyles.modalCard} ${assetStyles.assetReportModal} ${downloadStyles.dialog}`} role="dialog" aria-modal="true" aria-labelledby={titleId} data-download-dialog="true">
      <header className={`${assetStyles.modalHeader} ${assetStyles.assetReportModalHeader}`} data-download-header="true">
        <div className={assetStyles.modalHeaderText}><h3 id={titleId}>{title}</h3><p>{description}</p></div>
        <ShareModalCloseButton onClick={onClose} disabled={busy} aria-label="Close PDF reports"/>
      </header>
      <div className={`${assetStyles.modalScrollBody} ${assetStyles.assetReportModalBody}`} data-download-body="true"><div className={assetStyles.assetReportOptionsGrid} data-download-grid="true">{children}</div></div>
      <footer data-download-footer="true"><button type="button" disabled={busy} onClick={onClose}>Cancel</button></footer>
    </section>
  </div>;
}
