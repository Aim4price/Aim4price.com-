'use client';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from '../WebsitePortal';
import { useLeadDialog } from '../leads/useLeadDialog';
import ShareModalCloseButton from './ShareModalCloseButton';
import layout from './AssetAccessSettingsDialog.module.css';
import styles from '../../app/asset-register/page.module.css';

/** The same settings surface for inside sharing and asset links. */
export default function AssetAccessSettingsDialog({title,assetTitle,onClose,children,footer,linkSettings=false,onViewOnly,subjectHeader=false,locationLayout=false}: {
  title:string;assetTitle:string;onClose:()=>void;children:ReactNode;footer?:ReactNode;linkSettings?:boolean;onViewOnly?:()=>void;subjectHeader?:boolean;locationLayout?:boolean;
}) {
  const titleId=useId();
  const [showGuide,setShowGuide]=useState(linkSettings);
  const dismiss=()=>onClose();
  const ref=useLeadDialog(dismiss);
  useEffect(()=>{ref.current?.querySelector<HTMLElement>(showGuide?'[data-access-start]':'input')?.focus();},[showGuide,ref]);
  useEffect(()=>{
    const bodyOverflow=document.body.style.getPropertyValue('overflow');
    const bodyPriority=document.body.style.getPropertyPriority('overflow');
    const htmlOverflow=document.documentElement.style.getPropertyValue('overflow');
    const htmlPriority=document.documentElement.style.getPropertyPriority('overflow');
    document.body.style.setProperty('overflow','hidden','important');
    document.documentElement.style.setProperty('overflow','hidden','important');
    return()=>{document.body.style.setProperty('overflow',bodyOverflow,bodyPriority);document.documentElement.style.setProperty('overflow',htmlOverflow,htmlPriority);};
  },[]);
  return createPortal(<div className={`${styles.modalOverlay} ${styles.subModalOverlay} ${styles.quoteTrackingSettingsOverlay}`} data-website-overlay>
    <div className={styles.modalBackdrop} data-website-overlay onClick={dismiss}/>
    <section ref={ref} tabIndex={-1} className={`${styles.modalCard} ${styles.pricingModal} ${styles.dealerTrackingModal} ${styles.quoteTrackingSettingsModal} ${layout.dialog} ${locationLayout ? `${styles.assetSettingsLocationModal} ${layout.locationDialog}` : ''} ${showGuide ? layout.guideDialog : ''} ${subjectHeader ? layout.subjectDialog : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} data-asset-link-dialog={linkSettings || undefined}>
      <div className={`${styles.modalHeader} ${styles.pricingModalHeader} ${styles.dealerTrackingHeader} ${layout.header}`}>
        <div className={styles.modalHeaderText}><h3 id={titleId}>{title}</h3><p>{assetTitle}</p></div>
        <ShareModalCloseButton onClick={dismiss} aria-label={`Close ${title}`} />
      </div>
      <div className={`${styles.modalScrollBody} ${styles.pricingModalBody} ${styles.dealerTrackingBody} ${layout.body}`}>{showGuide ? <div className={layout.guideBody}>
        <p className={layout.guideHeading}>Choose the access you want to share</p>
        <p className={layout.guideDescription}>The recipient signs in to use your link.</p>
        <div className={layout.accessChoices}>
          {onViewOnly && <button type="button" aria-label="View only" className={`${layout.accessChoice} ${layout.viewChoice}`} onClick={()=>{onViewOnly();setShowGuide(false);}}>
            <span className={layout.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></span>
            <span className={layout.choiceTitle}>View only</span>
            <span className={layout.choiceDescription}>Share asset information without allowing changes.</span>
          </button>}
          <button type="button" aria-label="Choose permissions" data-access-start className={`${layout.accessChoice} ${layout.permissionsChoice}`} onClick={()=>setShowGuide(false)}>
            <span className={layout.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="9" cy="18" r="2" fill="currentColor"/></svg></span>
            <span className={layout.choiceTitle}>Choose permissions</span>
            <span className={layout.choiceDescription}>Allow specific updates or include additional reports.</span>
          </button>
        </div>
      </div> : children}</div>
      {!showGuide && footer && <div className={layout.footer} data-access-footer>{footer}</div>}
    </section>
  </div>,document.body);
}
