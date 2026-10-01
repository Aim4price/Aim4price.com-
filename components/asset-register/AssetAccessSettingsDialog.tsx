'use client';
import { useId, type ReactNode } from 'react';
import { createPortal } from '../WebsitePortal';
import { useLeadDialog } from '../leads/useLeadDialog';
import ShareModalCloseButton from './ShareModalCloseButton';
import styles from '../../app/asset-register/page.module.css';

/** The same settings surface for inside sharing and asset links. */
export default function AssetAccessSettingsDialog({title,assetTitle,onClose,children,linkSettings=false}: {
  title:string;assetTitle:string;onClose:()=>void;children:ReactNode;linkSettings?:boolean;
}) {
  const titleId=useId();
  const ref=useLeadDialog(onClose);
  return createPortal(<div className={`${styles.modalOverlay} ${styles.subModalOverlay} ${styles.quoteTrackingSettingsOverlay}`} data-website-overlay>
    <div className={styles.modalBackdrop} data-website-overlay onClick={onClose}/>
    <section ref={ref} tabIndex={-1} className={`${styles.modalCard} ${styles.pricingModal} ${styles.dealerTrackingModal} ${styles.quoteTrackingSettingsModal}`} role="dialog" aria-modal="true" aria-labelledby={titleId} data-asset-link-dialog={linkSettings || undefined}>
      <div className={`${styles.modalHeader} ${styles.pricingModalHeader} ${styles.dealerTrackingHeader}`}>
        <div className={styles.modalHeaderText}><h3 id={titleId}>{title}</h3><p>{assetTitle}</p></div>
        <ShareModalCloseButton onClick={onClose} aria-label={`Close ${title}`}/>
      </div>
      <div className={`${styles.modalScrollBody} ${styles.pricingModalBody} ${styles.dealerTrackingBody}`}>{children}</div>
    </section>
  </div>,document.body);
}
