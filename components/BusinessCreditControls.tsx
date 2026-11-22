'use client';
import { useId,useState,type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import creditStyles from './BusinessCreditControls.module.css';
import ShareDisclosureDialog from './asset-register/ShareDisclosureDialog';
import styles from '../app/business/page.module.css';

export type CreditTarget={token:string;assetKey:string;visitId?:string};
export async function creditAction(target:CreditTarget,action:'manage'|'share'|'send'|'check',phase:'complete'|'reserve'|'cancel'|'close',requestId:string,visitId?:string) {
 const response=await fetch('/api/business-credits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...target,action,phase,requestId,visitId:visitId??target.visitId}),keepalive:phase==='close'||phase==='cancel'});
 const result=await response.json();
 if(!response.ok) throw Error(result.code||result.error||'Please try again.');
}
export function CreditNotice({message,onClose}:{message:string;onClose:()=>void}) {
 const id=useId(),limit=message==='BUSINESS_CREDIT_LIMIT';
 return <ShareDisclosureDialog title={limit?'You’ve used your monthly credits':'Action unavailable'} titleId={id} closeLabel="Close" onClose={onClose}>
  <p>{limit?'You can still view shared assets. Upgrade your Business account or wait for the monthly reset.':message}</p>
  {limit&&<a className={styles.button} href="/account#business-credits">Upgrade to Paid Business</a>} <button className={styles.secondaryButton} onClick={onClose}>Continue viewing</button>
 </ShareDisclosureDialog>;
}
export function UpgradeBusiness({businessId}:{businessId?:string}) {
 const id=useId(),router=useRouter();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(){
   setBusy(true);setError('');
   try {
     const response=await fetch(businessId?'/api/admin/business-credits':'/api/business-credits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(businessId?{businessId,confirmed:true}:{action:'upgrade'})});
     const data=await response.json();
     if(!response.ok)throw Error(data.error);
     setOpen(false);router.refresh();
   } catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
 }
 return <><button className={styles.button} onClick={()=>setOpen(true)}>{businessId?'Activate Paid Business':'Upgrade to Paid Business'}</button>
 {open&&<ShareDisclosureDialog title={businessId?'Activate Paid Business?':'Upgrade to Paid Business'} titleId={id} closeLabel="Close" onClose={()=>setOpen(false)}>
 <p>{businessId?'Confirm that the subscription has been arranged. This lifts the monthly credit limit for this business.':'Request an upgrade for this account. Aim4price will contact you to agree the subscription before activation.'}</p>
 {error&&<p role="alert">{error}</p>}<button disabled={busy} className={styles.button} onClick={()=>void submit()}>{busy?'Saving…':businessId?'Confirm subscription':'Request upgrade'}</button>
 </ShareDisclosureDialog>}</>;
}

export type BusinessSubscription = { allowance?:number; resets?:string; bonus?:number; reward?:number; history?:{action:string;units:number;date:string}[]; fullAccess?:boolean; paidSince:string|null; pending:boolean; owner:boolean; remaining:number|null; limit:number|null };

function CreditBalance({plan}:{plan:BusinessSubscription}) {
 const {remaining,limit}=plan;
 if (remaining === null || limit === null) return <span>Balance unavailable</span>;
 const percent=limit > 0 ? Math.min(100,Math.max(0,100 * remaining / limit)) : 0;
 return <span className={creditStyles.balance}>
   <span><strong>{remaining.toLocaleString('en-ZA')}</strong> of {limit.toLocaleString('en-ZA')} available</span>
   <span aria-hidden="true" className={creditStyles.track}><span style={{width: percent + '%'}} /></span>
 </span>;
}

export function BusinessSubscriptionButton({plan,className,icon,credits=false,inviteLink}:{plan:BusinessSubscription;className:string;icon?:ReactNode;credits?:boolean;inviteLink?:string}) {
 const router=useRouter(), titleId=useId();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const fullAccess=plan.fullAccess ?? Boolean(plan.paidSince);
 const label=fullAccess?'Manage subscription':plan.pending?'Upgrade requested':'Upgrade Account';
 const [copied,setCopied]=useState(false);
 async function copyInvite() {
   if (!inviteLink) return;
   const url = new URL(inviteLink, window.location.origin).href;
   try {
     await navigator.clipboard.writeText(url);
     setCopied(true);
   } catch {
     window.prompt('Copy your owner invite link', url);
   }
 }
 async function requestUpgrade(){
   setBusy(true);setError('');
   try {
     const response=await fetch('/api/business-credits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'upgrade'})});
     if(!response.ok) throw Error((await response.json()).error || 'Could not request upgrade.');
     router.refresh();setOpen(false);
   } catch(e){setError(e instanceof Error?e.message:'Could not request upgrade.');}
   finally{setBusy(false);}
 }
 const inviteAction = inviteLink && <button type="button" className={styles.secondaryButton} onClick={()=>void copyInvite()}>
   <span aria-live="polite">{copied ? 'Invite link copied' : 'Copy owner invite link'}</span>
 </button>;
 const subscriptionAction = fullAccess ? <><p><strong>Paid Business Account</strong>{plan.paidSince && <> · Active since {new Date(plan.paidSince).toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'})}</>}</p>
 <p>Aim4price Admin manages your subscription. Contact us to change your plan.</p><a href="/contact-us" className={styles.button}>Contact Aim4price</a></> :
 plan.pending ? <p>Aim4price has received your request. Your Free Business Account stays active until the upgrade is confirmed.</p> :
 plan.owner ? <><p>Add staff and use unlimited credits. We’ll contact you to arrange activation.</p><button type="button" disabled={busy} onClick={()=>void requestUpgrade()} className={styles.button}>{busy?'Requesting…':'Request upgrade'}</button></> :
 plan.limit === null ? <><p>Contact Aim4price to request an upgrade for this account.</p><a className={styles.button} href="/contact-us">Contact Aim4price</a></> :
 <p>Your business owner can request an upgrade.</p>;
 return <><button type="button" className={credits ? className + ' ' + creditStyles.card : className}
   aria-haspopup="dialog" onClick={()=>{setError('');setCopied(false);setOpen(true);}}>
   {credits ? <>
     <span className={creditStyles.cardHeading}><strong>Credits</strong><span className={creditStyles.arrow} aria-hidden="true" /></span>
     <CreditBalance plan={plan} />
   </> : <>{icon}<strong>{label}</strong></>}
 </button>{open && <ShareDisclosureDialog title={credits ? 'Business credits' : label} titleId={titleId}
   className={credits ? creditStyles.dialog : undefined} closeLabel="Close" onClose={()=>setOpen(false)}>
 {credits ? <div className={creditStyles.body}>
   <div className={creditStyles.summary}>
     
     <CreditBalance plan={plan} />
     {plan.allowance != null && <p>Monthly allowance · {plan.allowance} credits</p>}
   </div>
   <section className={creditStyles.usage}>
     <p><strong>1 credit</strong><span>Save a cost, document or maintenance record.</span></p>
     <p><strong>Free</strong><span>View assets, message and share.</span></p>
   </section>
   <div className={creditStyles.options}>
     {inviteLink && <section>
       <h3>Invite an owner {plan.reward != null && <span className={creditStyles.reward}>+{plan.reward} credits</span>}</h3>
       <p>Earn credits for the month when a new owner joins through your link, verifies their email and adds their first asset.</p>
       {inviteAction}
     </section>}
     <section><h3>Paid Business</h3>{subscriptionAction}</section>
   </div>
 </div> : <>
   {!fullAccess && plan.remaining !== null && plan.limit !== null && <p><strong>{plan.remaining} of {plan.limit} credits remaining</strong></p>}
   {inviteAction}{subscriptionAction}
 </>}
 {error && <p role="alert">{error}</p>}</ShareDisclosureDialog>}</>;
}
