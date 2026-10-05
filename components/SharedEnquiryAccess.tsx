'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SignupFlow from './SignupFlow';
import SwitchAccountButton from './SwitchAccountButton';
import styles from './SignupFlow.module.css';
import entryStyles from './SharedEnquiryLanding.module.css';

export default function SharedEnquiryAccess({returnTo,access,embedded=false}: {returnTo:string;access:string;embedded?:boolean}) {
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const router=useRouter();
 const query=`returnTo=${encodeURIComponent(returnTo)}`;
 const title=access==='request-access'?'Request access from the sender':access==='wrong-recipient'?'Use the invited account':access==='verify-email'?'Verify your email':access==='suspended'?'Account access is paused':'Oops, we need you to sign in.';
 const description=access==='request-access'?'The sender needs to approve your account before you can view this enquiry.':access==='wrong-recipient'?'This enquiry belongs to another recipient. Sign in with the invited account or ask the sender for access.':access==='verify-email'?'You’re signed in, but your email still needs verification. Verify your email to open this enquiry.':access==='suspended'?'Contact Aim4price to review your account access.':'Create a free account or sign in. You will return to this enquiry after signing in.';
 if (access === 'sign-in') { const signIn = <div className={entryStyles.signInBody}>
  <p>Choose an option to open the shared assets.</p>
  <div className={entryStyles.accountChoices}>
   <section className={entryStyles.accountChoice} aria-label="Existing account">
    <span className={entryStyles.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h5v16h-5M3 12h12m-4-4 4 4-4 4"/></svg></span>
    <h3>Already have an account?</h3>
    <p>Use your existing Aim4price login.</p>
    <Link className={`${styles.button} ${entryStyles.signInButton}`} href={`/auth?${query}#login`}>Sign in <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></Link>
   </section>
   <section className={`${entryStyles.accountChoice} ${entryStyles.newAccount}`} aria-label="New account">
    <span className={entryStyles.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M19 7v6m-3-3h6"/></svg></span>
    <h3>New to Aim4price?</h3>
    <p>Access this and future shared assets.</p>
    <Link className={`${styles.secondaryButton} ${entryStyles.signInButton}`} href={`/business/join?${query}`}>Create a free account <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></Link>
   </section>
  </div>
  <p className={entryStyles.returnHint}>After signing in, you’ll return to these assets.</p>
 </div>;
 return embedded ? signIn : <SignupFlow title={title} description="Sign in to open your shared enquiry." returnTo={returnTo}>{signIn}</SignupFlow>;
 }
 if(access==='verify-email') {
  const verification=<div className={entryStyles.signInBody}>
   <p>Verify your email once to activate your free sharing account.</p>
   <div className={entryStyles.accessActions}>
    <button className={styles.button} disabled={busy} onClick={async()=>{setBusy(true);setNotice('');try{const response=await fetch('/api/shared-account/verification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnTo})});const data=await response.json();if(!response.ok)throw Error(data.error||'Please try again.');setNotice('Verification email sent. Check your inbox.');}catch(error){setNotice(error instanceof Error?error.message:'Please try again.');}finally{setBusy(false);}}}>{busy?'Sending…':'Resend verification email'}</button>
    <button className={styles.secondaryButton} onClick={()=>router.refresh()}>I’ve verified my email</button>
    <SwitchAccountButton returnTo={returnTo}/>
   </div>
   {notice&&<p role="status" className={styles.notice}>{notice}</p>}
  </div>;
  return embedded?verification:<SignupFlow title="Verify your email" description="One last step to activate your free account." returnTo={returnTo}>{verification}</SignupFlow>;
 }
 const content = <>
  <div className={entryStyles.accessActions}>
   {access==='sign-in'?<><Link className={styles.button} href={`/auth?${query}#login`}>Sign in</Link><span>Don’t have an account? <Link href={`/business/join?${query}`}>Create a free account</Link></span></>:access==='wrong-recipient'?<SwitchAccountButton primary returnTo={returnTo}/>:access==='request-access'?<button className={styles.button} disabled={busy} onClick={async()=>{setBusy(true);setNotice('');try{const response=await fetch(`${returnTo.split('?')[0].replace('/asset-share/','/api/asset-share-links/')}/access`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to request access.');setNotice('Access requested. Return here after the sender approves your account.');}catch(error){setNotice(error instanceof Error?error.message:'Please try again.');}finally{setBusy(false);}}}>Request access</button>:<Link className={styles.button} href={`/business?${query}`}>Account details</Link>}
   {access==='verify-email'&&<SwitchAccountButton returnTo={returnTo}/>}
   {access!=='sign-in'&&<button className={styles.secondaryButton} onClick={()=>router.refresh()}>Check access again</button>}
  </div>
  {notice&&<p role="status" className={styles.notice}>{notice}</p>}
 </>;
 return embedded ? <><p className={styles.notice}>{access==='sign-in' ? 'Use your existing Aim4price account, including an Owner or Dealer account. After signing in, you’ll return to this enquiry.' : description}</p>{content}</> : <SignupFlow title={title} description={description} returnTo={returnTo}>{content}</SignupFlow>;
}
