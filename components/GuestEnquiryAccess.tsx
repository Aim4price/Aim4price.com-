'use client';
import { useState } from 'react';
import Link from 'next/link';
import SignupFlow from './SignupFlow';
import styles from './SignupFlow.module.css';

export default function GuestEnquiryAccess({returnTo,blocked=false,limit=null,accessState}:{returnTo?:string|null;blocked?:boolean;limit?:number|null;accessState?:string}) {
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[verified,setVerified]=useState(false);
 const signup='/business/join?mode=account'+(returnTo?'&returnTo='+encodeURIComponent(returnTo):'');
 async function submit(action:'start'|'verify') {
  if(busy)return;setBusy(true);setError('');
  try {
   const response=await fetch('/api/guest-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,email,code})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Please try again.');
   if(action==='start')setSent(true);else if(returnTo)window.location.assign(returnTo);else setVerified(true);
  }catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
 }
 return <SignupFlow guest returnTo={returnTo} title={blocked?'Create your account to continue':verified?'Your email is verified':'Open a shared enquiry'} description={accessState==='suspended'?'This account is paused. Contact Aim4price, or log in with another account.':accessState==='wrong-recipient'?'Use the email invited by the sender. If you are signed in to a different account, choose Log in below to switch.':blocked?'You have used your guest allowance. Create an account to open new enquiries.':verified?'Return to the invitation in your email to open the shared enquiry.':'Use the email address the sender invited. We’ll send you a sign-in code.'}>
  <div className={styles.notice}><strong>Guest access · {limit ?? 'x'} credits</strong><p>View and reply through your own email. No personal Aim4price inbox, saved history or backup.</p><p>One credit per new enquiry; reopening is free. {limit===null?'The allowance is being finalised.':'Create an account when your allowance is used.'}</p></div>
  {!blocked&&!verified&&<form className={styles.form} onSubmit={e=>{e.preventDefault();void submit(sent?'verify':'start');}}>
   <label>Email address<input type="email" autoComplete="email" required value={email} disabled={sent||busy} onChange={e=>setEmail(e.target.value)}/></label>
   {sent&&<label>Sign-in code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></label>}
   <button className={styles.button} disabled={busy}>{busy?'Please wait…':sent?'Verify and open enquiry':'Email me a code'}</button>
   {sent&&<div className={styles.guestActions}><button type="button" className={styles.secondaryButton} disabled={busy} onClick={()=>void submit('start')}>Resend code</button><button type="button" className={styles.secondaryButton} disabled={busy} onClick={()=>{setSent(false);setCode('');setError('');}}>Change email</button></div>}
   {error&&<p role="alert" className={styles.error}>{error}</p>}
  </form>}
  <div className={styles.guestActions}><Link className={styles.secondaryButton} href={signup}>Create Business account</Link><Link className={styles.secondaryButton} href={'/auth?switchAccount=1'+(returnTo?'&returnTo='+encodeURIComponent(returnTo):'')+'#login'}>Log in</Link></div>
 </SignupFlow>;
}
