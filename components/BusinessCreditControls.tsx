'use client';
import { useId,useState } from 'react';
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
