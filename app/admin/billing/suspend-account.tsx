'use client';
import {useEffect,useRef,useState} from 'react';
import {billingDate,money,type BillingInvoice} from '../../../lib/billing-shared';
import styles from './page.module.css';

export default function SuspendAccount({invoice,onClose,onSaved}:{invoice:BillingInvoice;onClose:()=>void;onSaved:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const element=dialog.current,previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;element?.showModal();document.body.style.overflow='hidden';return()=>{element?.close();document.body.style.overflow=overflow;previous?.focus();};},[]);
 async function save(){
  if(busy||!confirmed||reason.trim().length<5)return;
  setBusy(true);setError('');
  try{const response=await fetch('/api/admin/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'suspend_account',id:invoice.id,version:invoice.version,accountStatus:invoice.accountStatus,reason:reason.trim()})});const result=await response.json();if(!response.ok)throw Error(result.error||'The account could not be suspended.');onSaved();}catch(e){setError((e as Error).message);setBusy(false);}
 }
 return <dialog ref={dialog} className={`${styles.shareDialog} ${styles.suspensionDialog}`} aria-labelledby="suspend-account-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <header className={styles.shareHeader}><div><h2 id="suspend-account-title">{invoice.accountStatus==='suspended'?'Update suspension':'Suspend account'}</h2><p>{invoice.customer.businessName||invoice.customer.name}</p></div><button type="button" className={styles.shareClose} aria-label="Close suspension" disabled={busy} onClick={onClose}>×</button></header>
  <div className={styles.suspensionSummary}><strong>{invoice.number}</strong><span>{money(invoice.totalCents-invoice.paidCents)} outstanding · Due {billingDate(invoice.dueDate)}</span><span>{invoice.contactEmail||invoice.customer.email}</span></div>
  <p className={styles.shareNote}>The customer will see the reason below and this invoice when they try to access their account.</p>
  <label className={styles.suspensionReason}>Reason shown to the customer<textarea value={reason} onChange={event=>setReason(event.target.value)} maxLength={500} disabled={busy} placeholder="Please explain why access is suspended and what the customer should do next."/></label>
  <p className={styles.shareNote}>Access stays suspended until an admin restores it in Accounts, even after payment is recorded.</p>
  <label className={styles.check}><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/> {invoice.accountStatus==='suspended'?'Keep this account suspended with this reason':'Suspend access for this account'}</label>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  <footer className={styles.suspensionActions}><button className={styles.button} disabled={busy} onClick={onClose}>Cancel</button><button className={styles.danger} disabled={busy||!confirmed||reason.trim().length<5} onClick={()=>void save()}>{busy?'Suspending…':'Confirm suspension'}</button></footer>
 </dialog>;
}
