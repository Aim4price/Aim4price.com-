'use client';
import { useState } from 'react';
import styles from './BusinessNetwork.module.css';
export default function BusinessAcceptanceForm() {
 const [done,setDone]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <main className={`${styles.panel} ${styles.page}`}>
  <h1>Be part of the Aim4price directory</h1>
  <p>Let asset owners find your business and contact you by email or WhatsApp. A basic listing is free. You do not need an Aim4price account.</p>
  {done ? <section className={styles.card} role="status"><h2>Thank you—your acceptance is recorded.</h2><p>We will review your details and manually prepare your listing. Submitting this form does not publish a listing or activate paid report access.</p></section> : <form className={styles.card} onSubmit={async event=>{
   event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);
   try {const response=await fetch('/api/business-network/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(form),accepted:form.get('accepted')==='on'})});const data=await response.json();if(!response.ok)throw new Error(data.error);setDone(true);}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
  }}>
   <label>Business name<input name="businessName" required minLength={2} maxLength={200}/></label>
   <label>Your name<input name="contactName" required minLength={2} maxLength={150}/></label>
   <label>Business email<input name="email" type="email" required maxLength={254}/></label>
   <label>Phone · optional<input name="phone" type="tel" maxLength={40}/></label>
   <label className={styles.check}><input name="accepted" type="checkbox" required/>I represent this business and agree to a public directory listing and enquiries from Aim4price users.</label>
   <p>Guest report access and a full Aim4price account are separate options. Nothing is charged by submitting this form.</p>
   <button className={styles.primary} disabled={busy}>{busy?'Saving…':'Accept free listing'}</button>
   {error&&<p role="alert">{error}</p>}
  </form>}
 </main>;
}
