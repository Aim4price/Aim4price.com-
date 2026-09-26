'use client';
import {useEffect,useRef} from 'react';
import {billingContactLinks,type BillingInvoice} from '../../../lib/billing-shared';
import styles from './page.module.css';
export default function ShareInvoice({invoice,onClose}:{invoice:BillingInvoice;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null),links=billingContactLinks(invoice);
 useEffect(()=>{const element=dialog.current,previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;element?.showModal();document.body.style.overflow='hidden';return()=>{element?.close();document.body.style.overflow=overflow;previous?.focus();};},[]);
 return <dialog ref={dialog} className={styles.shareDialog} aria-labelledby="billing-share-title" onCancel={event=>{event.preventDefault();onClose();}}>
  <header className={styles.shareHeader}><div><h2 id="billing-share-title">Share invoice</h2><p>{invoice.customer.businessName||invoice.customer.name}{invoice.number?` · ${invoice.number}`:' · Draft'}</p></div><button type="button" className={styles.shareClose} aria-label="Close share invoice" onClick={onClose}>×</button></header>
  <div className={styles.shareChannels}>
   {links.whatsapp?<a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={styles.shareChannel}><strong>WhatsApp</strong><span>{invoice.contactPhone}</span></a>:<button className={styles.shareChannel} disabled><strong>WhatsApp</strong><span>No valid phone number saved</span></button>}
   {links.email?<a href={links.email} className={styles.shareChannel}><strong>Email</strong><span>{invoice.contactEmail}</span></a>:<button className={styles.shareChannel} disabled><strong>Email</strong><span>No email address saved</span></button>}
  </div>
  <p className={styles.shareNote}>Opens your chosen app for you to review and send. Attach the downloaded PDF if needed.</p>
  {!links.whatsapp&&invoice.userId?<a className={styles.button} href={`/admin?account=${encodeURIComponent(invoice.userId)}`}>Account details</a>:null}
 </dialog>;
}
