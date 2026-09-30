'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SignupFlow from './SignupFlow';
import SwitchAccountButton from './SwitchAccountButton';
import styles from './SignupFlow.module.css';

export default function SharedEnquiryAccess({returnTo,access,embedded=false}: {returnTo:string;access:string;embedded?:boolean}) {
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const router=useRouter();
 const query=`returnTo=${encodeURIComponent(returnTo)}`;
 const title=access==='request-access'?'Request access from the sender':access==='wrong-recipient'?'Use the invited account':access==='verify-email'?'Verify your email':access==='suspended'?'Account access is paused':'Open your shared enquiry';
 const description=access==='request-access'?'The sender needs to approve your account before you can view this enquiry.':access==='wrong-recipient'?'This enquiry belongs to another recipient. Sign in with the invited account or ask the sender for access.':access==='verify-email'?'Verify your account email, then return to this enquiry.':access==='suspended'?'Contact Aim4price to review your account access.':'Create a free account or sign in. You will return to this enquiry after signing in.';
 const content = <>
  <div className={styles.guestActions}>
   {access==='sign-in'?<><Link className={styles.button} href={`/auth?${query}#login`}>Sign in</Link><span>Don’t have an account? <Link href={`/business/join?${query}`}>Create a free account</Link></span></>:access==='wrong-recipient'?<SwitchAccountButton primary returnTo={returnTo}/>:access==='request-access'?<button className={styles.button} disabled={busy} onClick={async()=>{setBusy(true);setNotice('');try{const response=await fetch(`${returnTo.split('?')[0].replace('/asset-share/','/api/asset-share-links/')}/access`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to request access.');setNotice('Access requested. Return here after the sender approves your account.');}catch(error){setNotice(error instanceof Error?error.message:'Please try again.');}finally{setBusy(false);}}}>Request access</button>:<Link className={styles.button} href={`/business?${query}`}>Account details</Link>}
   {access!=='sign-in'&&<button className={styles.secondaryButton} onClick={()=>router.refresh()}>Check access again</button>}
  </div>
  {notice&&<p role="status" className={styles.notice}>{notice}</p>}
 </>;
 return embedded ? <><p className={styles.notice}>{access==='sign-in' ? 'Use your existing Aim4price account, including an Owner or Dealer account. After signing in, you’ll return to this enquiry.' : description}</p>{content}</> : <SignupFlow title={title} description={description} returnTo={returnTo}>{content}</SignupFlow>;
}
