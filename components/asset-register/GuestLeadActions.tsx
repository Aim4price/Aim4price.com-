'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {LeadAccess,LeadDetails,LeadReport} from '../../lib/guest-leads';
import {buildWhatsAppShareUrl} from '../../lib/asset-external-share';
import styles from './GuestLead.module.css';
export default function GuestLeadActions({token,details,reports,access}:{token:string;details:LeadDetails;reports:LeadReport[];access:LeadAccess}){
 const router=useRouter(),[signingIn,setSigningIn]=useState(false),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const open=access==='owner'||access==='active';
 const activationHref=`mailto:aim4price@gmail.com?subject=${encodeURIComponent('Guest report access')}&body=${encodeURIComponent(`Please arrange report access for ${details.recipientEmail}.`)}`;
 async function auth(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setNotice('');const form=new FormData(event.currentTarget);try{const r=await fetch('/api/guest-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(form),email:details.recipientEmail,action:sent?'verify':'start'})}),d=await r.json();if(!r.ok)throw new Error(d.error);if(sent){setSigningIn(false);router.refresh();}else{setSent(true);setNotice('Check your email for your sign-in code.');}}catch(e){setNotice(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 return <section className={styles.panel}>
 {details.allowReply&&<div className={styles.actions}><a href={`mailto:${encodeURIComponent(details.replyEmail)}?subject=${encodeURIComponent('Re: Aim4price asset request')}`}>Reply by email</a>{details.replyPhone&&<a target="_blank" rel="noreferrer" href={buildWhatsAppShareUrl({subject:'Asset enquiry',body:`Hello ${details.replyName}, regarding your Aim4price asset request.`},details.replyPhone)}>Reply on WhatsApp</a>}</div>}
 <details className={styles.manage}><summary>Manage · shared reports ({reports.length})</summary>
 <p>Only reports chosen by the owner appear here. Access does not allow you to edit the owner’s assets.</p>
 {access==='owner'&&<p>You are previewing your own lead. The recipient needs verified, active access to open reports.</p>}
 {reports.map(report=><div key={report.id} className={styles.report}><strong>{report.label}</strong>{open?<a href={`/api/asset-share-links/${token}/reports/${report.id}`} target="_blank" rel="noreferrer">Open report</a>:access==='payment-required'?<a href={activationHref}>Arrange access</a>:<button type="button" onClick={()=>{setSigningIn(true);setNotice('');}}>🔒 Sign in to open</button>}</div>)}
 {!reports.length&&<p>The owner has not shared any reports with this lead.</p>}
 {reports.length>0&&!open&&<>
 <p>{access==='payment-required'?'Your email is confirmed. Paid guest access is awaiting activation, expired or suspended.':'Reports are restricted to the business email selected by the owner. Confirm that email to continue.'}</p>
 {access==='wrong-recipient'&&<p>You are signed in as a different guest. Sign in using the email this lead was addressed to.</p>}
 {access==='payment-required'?<div className={styles.actions}><a href={activationHref}>Arrange guest access</a><button type="button" onClick={()=>router.refresh()}>Check access again</button></div>:<button type="button" onClick={()=>setSigningIn(true)}>Sign up / sign in with email</button>}
 </>}
 {signingIn&&!open&&access!=='payment-required'&&<form className={styles.form} onSubmit={auth}>
 <h3>Guest business access</h3><p>A limited login for shared leads. No full workspace signup is needed. Payment and activation are handled by Aim4price.</p>
 <label>Recipient email<input type="email" readOnly value={details.recipientEmail}/></label>
 {!sent?<><label>Business name<input name="businessName" defaultValue={details.recipientName} required minLength={2} maxLength={200}/></label><label>Your name<input name="contactName" required minLength={2} maxLength={150}/></label></>:<label>Email code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required/></label>}
 <button disabled={busy}>{busy?'Please wait…':sent?'Confirm email':'Email me a sign-in code'}</button>
 {sent&&<button type="button" disabled={busy} onClick={()=>{setSent(false);setNotice('');}}>Request a new code</button>}
 </form>}
 {access!=='sign-in'&&access!=='owner'&&<button type="button" onClick={async()=>{try{const r=await fetch('/api/guest-access',{method:'DELETE'});if(!r.ok)throw new Error();router.refresh();setSent(false);}catch{setNotice('Could not sign out. Please try again.');}}}>Sign out guest access</button>}
 {notice&&<p role="status">{notice}</p>}
 </details></section>;
}
