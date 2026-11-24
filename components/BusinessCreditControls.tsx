'use client';
import { useEffect,useId,useRef,useState,type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { money, type BillingPlan } from '../lib/billing-shared';
import creditStyles from './BusinessCreditControls.module.css';
import ShareDisclosureDialog from './asset-register/ShareDisclosureDialog';
import styles from '../app/business/page.module.css';

export type CreditTarget={token:string;assetKey:string;visitId?:string};
export async function creditAction(target:CreditTarget,action:'manage'|'report'|'share'|'send'|'check',phase:'complete'|'reserve'|'cancel'|'close',requestId:string,visitId?:string) {
 const response=await fetch('/api/business-credits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...target,action,phase,requestId,visitId:visitId??target.visitId}),keepalive:phase==='close'||phase==='cancel'});
 const result=await response.json();
 if(!response.ok) throw Error(result.code||result.error||'Please try again.');
}
export function useMeteredManage(metered: boolean, onError: (message:string)=>void) {
 const busy = useRef(false);
 const attempt = useRef<{key:string; id:string} | null>(null);
 return async (key:string, open:()=>void) => {
   if (!metered) { open(); return; }
   if (busy.current) return;
   busy.current = true;
   try {
     if (attempt.current?.key !== key) attempt.current = {key,id:crypto.randomUUID()};
     await creditAction({token:'',assetKey:key},'manage','complete',attempt.current.id);
     attempt.current = null;
     open();
   } catch (error) {
     onError(error instanceof Error && error.message === 'BUSINESS_CREDIT_LIMIT' ? 'Your monthly credits have been used.' : 'Could not open Manage. Please try again.');
   } finally { busy.current = false; }
 };
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

function InviteActions({inviteLink,showLabels=false}:{inviteLink:string;showLabels?:boolean}) {
 const [copied,setCopied]=useState(false);
 const inviteUrl = new URL(inviteLink, window.location.origin).href;
 const inviteMessage = inviteUrl ? encodeURIComponent(`Join me on Aim4price to value and manage your assets: ${inviteUrl}`) : undefined;
 async function copyInvite() {
   if (!inviteUrl) return;
   try {
     await navigator.clipboard.writeText(inviteUrl);
     setCopied(true);
   } catch {
     window.prompt('Copy your invite link', inviteUrl);
   }
 }
 return <div className={[creditStyles.inviteActions, showLabels && creditStyles.shareChoices].filter(Boolean).join(" ")} role="group" aria-label="Share Aim4price">
   <button type="button" onClick={()=>void copyInvite()} aria-label="Copy invite link" title={copied ? 'Invite link copied' : 'Copy invite link'}>
     <svg aria-hidden="true" viewBox="0 0 24 24">{copied ? <path d="m4 12 5 5L20 6"/> : <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>}</svg>
     {showLabels && <span>{copied ? 'Link copied' : 'Copy link'}</span>}
   </button>
   <a href={'https://wa.me/?text=' + inviteMessage} target="_blank" rel="noopener noreferrer" aria-label="Share invite on WhatsApp" title="Share on WhatsApp">
     <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 11.8a8.8 8.8 0 0 1-13 7.7L3 21l1.4-4.7a8.8 8.8 0 1 1 16.4-4.5Z"/><path d="M8 7.7c-.8 1.1.3 3.4 2.2 5.4 2 2 4.2 3.1 5.5 2.2l.8-1.5-2.5-1.2-.9 1c-1.6-.8-2.5-1.8-3.2-3.2l.9-.9-1.1-2.4Z" fill="currentColor" stroke="none"/></svg>
     {showLabels && <span>WhatsApp</span>}
   </a>
   <a href={'mailto:?subject=Your%20Aim4price%20invite&body=' + inviteMessage} aria-label="Share invite by email" title="Share by email">
     <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>
     {showLabels && <span>Email</span>}
   </a>
   <span className={creditStyles.inviteStatus} role="status">{copied ? 'Invite link copied' : ''}</span>
 </div>;
}

export function ShareAim4priceButton({inviteLink,className,icon}:{inviteLink:string;className:string;icon:ReactNode}) {
 const [open,setOpen]=useState(false), titleId=useId();
 return <><button type="button" className={className} aria-haspopup="dialog" onClick={()=>setOpen(true)}>{icon}<strong>Share Aim4price</strong></button>
 {open && <ShareDisclosureDialog title="Share Aim4price" className={creditStyles.shareDialog} titleId={titleId} descriptionId={`${titleId}-description`} closeLabel="Close" onClose={()=>setOpen(false)}>
 <p id={`${titleId}-description`} className={creditStyles.shareDescription}>People who join through your link will see your name at signup.</p>
 <InviteActions inviteLink={inviteLink} showLabels />
 </ShareDisclosureDialog>}</>;
}

export function BusinessSubscriptionButton({plan,className,icon,credits=false,inviteLink}:{plan:BusinessSubscription;className:string;icon?:ReactNode;credits?:boolean;inviteLink?:string}) {
 const router=useRouter(), titleId=useId();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const fullAccess=plan.fullAccess ?? Boolean(plan.paidSince);
 const label=fullAccess?'Manage subscription':plan.pending?'Upgrade requested':'Upgrade Account';
 const [offers,setOffers]=useState<BillingPlan[]>([]);
 const [selected,setSelected]=useState('');
 useEffect(()=>{
   if (!open || fullAccess || plan.pending || !plan.owner) return;
   let active=true;
   fetch('/api/billing/plans',{cache:'no-store'}).then(async response=>{
     if(!response.ok) throw Error();
     const data=await response.json();
     const plans:BillingPlan[]=data.plans.filter((offer:BillingPlan)=>offer.accountType==='business');
     if(active){setOffers(plans);setSelected('');if(!plans.length)setError('No Business plans are currently available.');}
   }).catch(()=>{if(active)setError('Could not load plans. Reopen this window to retry.');});
   return ()=>{active=false;};
 },[open,fullAccess,plan.pending,plan.owner]);
 async function requestUpgrade(){
   setBusy(true);setError('');
   try {
     const response=await fetch('/api/business-credits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'upgrade',planKey:selected,planVersion:offers.find(offer=>offer.key===selected)?.version})});
     if(!response.ok) throw Error((await response.json()).error || 'Could not request upgrade.');
     router.refresh();setOpen(false);
   } catch(e){setError(e instanceof Error?e.message:'Could not request upgrade.');}
   finally{setBusy(false);}
 }
 const subscriptionAction = fullAccess ? <><p><strong>Paid Business Account</strong>{plan.paidSince && <> · Active since {new Date(plan.paidSince).toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'})}</>}</p>
 <p>Aim4price Admin manages your subscription. Contact us to change your plan.</p><a href="/contact-us" className={styles.button}>Contact Aim4price</a></> :
 plan.pending ? <p>Aim4price has received your request. Your Free Business Account stays active until the upgrade is confirmed.</p> :
 plan.owner ? <><p>Choose a plan for staff access and unlimited credits. No charge is taken today. We’ll contact you before activation.</p>
 <fieldset className={creditStyles.planChoices}><legend>Business plan</legend>{offers.map(offer=><label key={offer.key}><input type="radio" name={titleId+'-offer'} checked={selected===offer.key} onChange={()=>setSelected(offer.key||'')}/>{offer.description} · {money(offer.amountCents)} {offer.interval}</label>)}</fieldset>
 <button type="button" disabled={busy || !selected} onClick={()=>void requestUpgrade()} className={styles.button}>{busy?'Requesting…':'Request upgrade'}</button></> :
 plan.limit === null ? <><p>Contact Aim4price to request an upgrade for this account.</p><a className={styles.button} href="/contact-us">Contact Aim4price</a></> :
 <p>Your business owner can request an upgrade.</p>;
 return <><button type="button" className={credits ? className + ' ' + creditStyles.card : className}
   aria-haspopup="dialog" onClick={()=>{setError('');setOpen(true);}}>
   {credits ? <>
     <strong className={creditStyles.cardHeading}>Credits</strong>
     <CreditBalance plan={plan} />
   </> : <>{icon}<strong>{label}</strong></>}
 </button>{open && <ShareDisclosureDialog title={credits ? 'Business credits' : label} titleId={titleId}
   className={credits ? creditStyles.dialog : undefined} closeLabel="Close" onClose={()=>setOpen(false)}>
 {credits ? <div className={creditStyles.body}>
   <div className={creditStyles.summary}>
     <CreditBalance plan={plan} />
     {plan.allowance != null && <p>{plan.allowance} credits per month</p>}
   </div>
   <div className={creditStyles.options}>
     {inviteLink && <section>
       <h3>Invite an owner</h3>
       <p>Earn {plan.reward != null ? `${plan.reward} credits` : 'credits'} this month when an owner signs up with your link, verifies their email and adds their first asset.</p>
       {inviteLink && <InviteActions inviteLink={inviteLink} />}
     </section>}
     <section><h3>Paid Business</h3>{subscriptionAction}</section>
   </div>
 </div> : <>
   {!fullAccess && plan.remaining !== null && plan.limit !== null && <p><strong>{plan.remaining} of {plan.limit} credits remaining</strong></p>}
   {inviteLink && <InviteActions inviteLink={inviteLink} />}{subscriptionAction}
 </>}
 {error && <p role="alert">{error}</p>}</ShareDisclosureDialog>}</>;
}
