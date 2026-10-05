'use client';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from '../WebsitePortal';
import { useLeadDialog } from '../leads/useLeadDialog';
import ShareModalCloseButton from './ShareModalCloseButton';
import layout from './AssetAccessSettingsDialog.module.css';
import styles from '../../app/asset-register/page.module.css';

/** The same settings surface for inside sharing and asset links. */
export default function AssetAccessSettingsDialog({title,assetTitle,onClose,children,linkSettings=false}: {
  title:string;assetTitle:string;onClose:()=>void;children:ReactNode;linkSettings?:boolean;
}) {
  const titleId=useId();
  const [showGuide,setShowGuide]=useState(linkSettings);
  const dismiss=()=>{if(showGuide)setShowGuide(false);else onClose();};
  const ref=useLeadDialog(dismiss);
  useEffect(()=>{ref.current?.querySelector<HTMLElement>(showGuide?'[data-access-start]':'input')?.focus();},[showGuide,ref]);
  useEffect(()=>{
    const bodyOverflow=document.body.style.overflow;
    const htmlOverflow=document.documentElement.style.overflow;
    document.body.style.overflow='hidden';
    document.documentElement.style.overflow='hidden';
    return()=>{document.body.style.overflow=bodyOverflow;document.documentElement.style.overflow=htmlOverflow;};
  },[]);
  return createPortal(<div className={`${styles.modalOverlay} ${styles.subModalOverlay} ${styles.quoteTrackingSettingsOverlay}`} data-website-overlay>
    <div className={styles.modalBackdrop} data-website-overlay onClick={dismiss}/>
    <section ref={ref} tabIndex={-1} className={`${styles.modalCard} ${styles.pricingModal} ${styles.dealerTrackingModal} ${styles.quoteTrackingSettingsModal} ${layout.dialog} ${showGuide ? layout.guideDialog : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} data-asset-link-dialog={linkSettings || undefined}>
      <div className={`${styles.modalHeader} ${styles.pricingModalHeader} ${styles.dealerTrackingHeader} ${layout.header}`}>
        <div className={styles.modalHeaderText}><h3 id={titleId}>{title}</h3><p>{assetTitle}</p></div>
        <ShareModalCloseButton onClick={dismiss} aria-label={showGuide ? 'Dismiss access guide' : `Close ${title}`}/>
      </div>
      <div className={`${styles.modalScrollBody} ${styles.pricingModalBody} ${styles.dealerTrackingBody} ${layout.body}`}>{showGuide ? <div className={layout.guideBody}>
        <span className={layout.guideIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 1.5 1.5L8 5M11 6h9M4 12l1.5 1.5L8 11M11 12h9M4 18l1.5 1.5L8 17M11 18h9"/></svg></span>
        <p className={layout.guideHeading}>Choose what recipients can view or update.</p>
        <div className={layout.guideInstructions}><p>Tick the options you want to share.</p><p>Use <strong>Select all</strong> to allow every option.</p></div>
        <button type="button" data-access-start className={styles.primaryButton} onClick={()=>setShowGuide(false)}>Choose options</button>
      </div> : children}</div>
    </section>
  </div>,document.body);
}
