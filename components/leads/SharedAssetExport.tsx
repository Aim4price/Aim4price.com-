'use client';

import { useId, useMemo, useState } from 'react';
import { createPortal } from '../WebsitePortal';
import AssetExternalShare, { type ExternalShareFileSource } from '../asset-register/AssetExternalShare';
import ShareModalCloseButton from '../asset-register/ShareModalCloseButton';
import LeadReportDialog from './LeadReportDialog';
import { useLeadDialog } from './useLeadDialog';
import type { ExternalAssetShareItem } from '../../lib/asset-external-share';
import triggerStyles from './SharedAssetExport.module.css';
import styles from '../../app/asset-register/page.module.css';
import accountStyles from '../../app/account/page.module.css';
import externalStyles from '../asset-register/AssetExternalShare.module.css';

export type ExportAttachment = { url: string; name: string };
type Props = { title: string; photos: string[]; details?: string; asset?: Partial<ExternalAssetShareItem>; attachments?: ExportAttachment[] };

/** Recipient entry point to the same outside-sharing panel used by the Asset Register. */
export default function SharedAssetExport(props: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={`${styles.optionsButton} ${styles.cardOptionsButton} ${triggerStyles.trigger}`} onClick={() => setOpen(true)}>
      <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.6 6.8-4.2m-6.8 7 6.8 4.2"/></svg>
      <span>Share</span>
    </button>
    {open && createPortal(<OutsideShareDialog key={JSON.stringify(props)} {...props} onClose={() => setOpen(false)}/>, document.body)}
  </>;
}

function OutsideShareDialog({ title, photos, details, asset, attachments = [], onClose }: Props & { onClose: () => void }) {
  const titleId = useId();
  const ref = useLeadDialog(onClose);
  const [choosingReports, setChoosingReports] = useState(false);
  const [reportFiles, setReportFiles] = useState<ExternalShareFileSource[]>([]);
  const assets = useMemo<ExternalAssetShareItem[]>(() => [{
    title, serialNumber: '', yearModel: null, usage: '', condition: '',
    replacementPriceExVat: null, valueExVat: null,
    ...asset, photoUrls: photos, publicUrl: null,
  }], [title, photos, asset]);
  const availableFiles: ExternalShareFileSource[] = attachments.map((file, index) => ({
    id: `shared-file:${index}:${file.url}`, kind: 'report', label: file.name,
    description: 'Shared attachment', fileName: file.name, url: file.url,
    preferSourceFileName: true,
  }));
  return <>
    <div className={`${styles.modalOverlay} ${styles.assetEntryOverlay}`} data-website-overlay style={choosingReports ? {display:'none'} : undefined}>
      <div className={styles.modalBackdrop} data-website-overlay onClick={onClose}/>
      <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`${styles.optionsModal} ${styles.assetQuoteModal} ${styles.externalAssetShareModal} ${styles.modalCard} ${styles.assetEntryModal} ${styles.registerShareAccountModal} ${styles.registerShareModal} ${accountStyles.modalTheme}`}>
        <div className={`${styles.modalHeader} ${styles.optionsModalHeader} ${styles.assetQuoteModalHeader} ${styles.registerShareModalHeader}`}>
          <div className={styles.modalHeaderText}><h3 id={titleId}>Share outside Aim4price</h3><p>Choose attachments, then share.</p></div>
          <ShareModalCloseButton onClick={onClose} aria-label="Close outside sharing"/>
        </div>
        <div className={`${styles.modalScrollBody} ${styles.optionsScrollBody} ${styles.assetQuoteScrollBody} ${styles.registerShareModalBody} ${externalStyles.accountShareTheme}`}>
          <AssetExternalShare shareName={title} assets={assets}
            messageBody={details ? `AIM4PRICE ASSET DETAILS\n\n${title}\n${details}\n\nShared from Aim4price. Values are saved estimates and remain subject to inspection.` : undefined}
            reportFiles={reportFiles} onAddAim4priceReport={() => setChoosingReports(true)}
            onRemoveAim4priceReport={id => setReportFiles(current => current.filter(file => file.id !== id))}/>
        </div>
      </section>
    </div>
    {choosingReports && <LeadReportDialog title={title} description="Choose a shared report or document to attach" onClose={() => setChoosingReports(false)}>
      {availableFiles.map(file => <button type="button" key={file.id} className={styles.assetReportOptionButton} disabled={reportFiles.some(selected => selected.id === file.id)} onClick={() => { setReportFiles(current => [...current, file]); setChoosingReports(false); }}>
        <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></svg><span><strong>{file.label}</strong><small>{reportFiles.some(selected => selected.id === file.id) ? 'Attached' : 'Attach shared file'}</small></span>
      </button>)}
      {!availableFiles.length && <p>No reports or documents have been shared with you for this asset.</p>}
    </LeadReportDialog>}
  </>;
}
