'use client';
import { useId,useState,type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
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

export type BusinessSubscription = { fullAccess?:boolean; paidSince:string|null; pending:boolean; owner:boolean; remaining:number|null; limit:number|null };

export function BusinessSubscriptionButton({plan,className,icon}:{plan:BusinessSubscription;className:string;icon:ReactNode}) {
 const router=useRouter(), titleId=useId();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const fullAccess=plan.fullAccess ?? Boolean(plan.paidSince);
 const label=fullAccess?'Manage subscription':plan.pending?'Upgrade requested':'Upgrade Account';
 async function requestUpgrade(){
   setBusy(true);setError('');
   try {
     const response=await fetch('/api/business-credits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'upgrade'})});
     if(!response.ok) throw Error((await response.json()).error || 'Could not request upgrade.');
     router.refresh();setOpen(false);
   } catch(e){setError(e instanceof Error?e.message:'Could not request upgrade.');}
   finally{setBusy(false);}
 }
 return <><button type="button" className={className} onClick={()=>{setError('');setOpen(true);}}>
   {icon}
   <strong>{label}</strong>
 </button>{open && <ShareDisclosureDialog title={label} titleId={titleId} closeLabel="Close" onClose={()=>setOpen(false)}>
 {!fullAccess && plan.remaining !== null && plan.limit !== null && (
   <p><strong>{plan.remaining} of {plan.limit} credits remaining</strong></p>
 )}
 {fullAccess ? <><p><strong>Paid Business Account</strong>{plan.paidSince && <> · Active since {new Date(plan.paidSince).toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'})}</>}</p>
 <p>Aim4price Admin manages your subscription. Contact us to change your plan.</p><a href="/contact-us" className={styles.button}>Contact Aim4price</a></> :
 plan.pending ? <p>Aim4price has received your request. Your Free Business Account stays active until the upgrade is confirmed.</p> :
 plan.owner ? <><p>Paid Business adds staff access and removes the monthly credit limit. Aim4price will contact you to arrange activation.</p><button type="button" disabled={busy} onClick={()=>void requestUpgrade()} className={styles.button}>{busy?'Requesting…':'Request upgrade'}</button></> :
 plan.limit === null ? <><p>Contact Aim4price to request an upgrade for this account.</p><a className={styles.button} href="/contact-us">Contact Aim4price</a></> :
 <p>Your business owner can request an upgrade.</p>}
 {error && <p role="alert">{error}</p>}</ShareDisclosureDialog>}</>;
}
