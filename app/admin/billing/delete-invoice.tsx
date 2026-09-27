'use client';
import {useEffect,useRef,useState} from 'react';
import {money,type BillingInvoice} from '../../../lib/billing-shared';
import styles from './page.module.css';

export default function DeleteInvoice({invoice,onClose,onSaved}:{invoice:BillingInvoice;onClose:()=>void;onSaved:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [reason,setReason]=useState(''),[confirmation,setConfirmation]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const expected=invoice.number||'DELETE';
 useEffect(()=>{const element=dialog.current,previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;element?.showModal();document.body.style.overflow='hidden';return()=>{element?.close();document.body.style.overflow=overflow;previous?.focus();};},[]);
 async function save(){
  if(busy||!confirmed||reason.trim().length<5||confirmation!==expected)return;
  setBusy(true);setError('');
  try{const response=await fetch('/api/admin/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'hard_delete',id:invoice.id,version:invoice.version,reason:reason.trim(),confirmation,confirmed})});const result=await response.json();if(!response.ok)throw Error(result.error||'The invoice could not be deleted.');onSaved();}catch(e){setError((e as Error).message);setBusy(false);}
 }
 return <dialog ref={dialog} className={`${styles.shareDialog} ${styles.suspensionDialog}`} aria-labelledby="delete-invoice-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <header className={styles.shareHeader}><div><h2 id="delete-invoice-title">Permanently delete invoice</h2><p>{invoice.customer.businessName||invoice.customer.name}</p></div><button className={styles.shareClose} aria-label="Close invoice deletion" disabled={busy} onClick={onClose}>×</button></header>
  <div className={styles.suspensionSummary}><strong>{invoice.number||'Draft invoice'}</strong><span>Total {money(invoice.totalCents)} · Recorded payments {money(invoice.paidCents)}</span></div>
  <p className={styles.shareNote}>This removes the invoice, saved PDF, recorded payments and invoice history from Aim4price. It cannot be undone. It does not refund money or recall emails already delivered.</p>
  <p className={styles.shareNote}>Account access stays unchanged. A linked suspension loses this invoice. The invoice number stays retired and a deletion record is kept.</p>
  <label className={styles.suspensionReason}>Reason for deletion<textarea value={reason} onChange={event=>setReason(event.target.value)} maxLength={500} disabled={busy}/></label>
  <label className={styles.field}>Type {expected} to confirm<input value={confirmation} autoComplete="off" spellCheck={false} onChange={event=>setConfirmation(event.target.value)} disabled={busy}/></label>
  <label className={styles.check}><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/> I understand this permanently deletes the invoice</label>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  <footer className={styles.suspensionActions}><button className={styles.button} disabled={busy} onClick={onClose}>Cancel</button><button className={styles.danger} disabled={busy||!confirmed||confirmation!==expected||reason.trim().length<5} onClick={()=>void save()}>{busy?'Deleting…':'Permanently delete'}</button></footer>
 </dialog>;
}
