'use client';
import {useEffect,useState} from 'react';
import styles from './page.module.css';
import ui from './business-plan.module.css';

type Plan = {remaining:number;limit:number;canRefill:boolean;businessId:string;paid:boolean;pending:boolean;changes:{plan:'free'|'paid';changed_at:string;actor:string|null}[]};
async function readPlan(owner:string,signal?:AbortSignal):Promise<Plan>{
 const response=await fetch('/api/admin/business-credits?owner='+encodeURIComponent(owner),{cache:'no-store',signal});
 const result=await response.json();
 if(!response.ok) throw Error(result.error || 'Could not load the plan.');
 return result;
}
export default function BusinessPlanAdmin({owner,onChanged}:{owner:string;onChanged:(paid:boolean)=>void}){
 const [plan,setPlan]=useState<Plan|null>(null),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [refillId,setRefillId]=useState(''),[message,setMessage]=useState('');
 async function refill(){
   if (!refillId || busy) return;
   setBusy(true);setError('');setMessage('');
   try {
     const response=await fetch('/api/admin/business-credits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refill',owner,requestId:refillId,confirmed:true})});
     if(!response.ok) throw Error((await response.json()).error || 'Could not refill credits.');
     setPlan(await readPlan(owner));setRefillId('');setMessage('Credits refilled.');
   } catch(e){setError(e instanceof Error?e.message:'Could not refill credits.');} finally{setBusy(false);}
 }
 useEffect(()=>{
   const controller=new AbortController();
   readPlan(owner,controller.signal).then(setPlan).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
   return ()=>controller.abort();
 },[owner]);
 async function save(){
   if(!plan || busy)return;
   setBusy(true);setError('');
   try{
     const response=await fetch('/api/admin/business-credits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({businessId:plan.businessId,confirmed:true,plan:plan.paid?'free':'paid'})});
     if(!response.ok)throw Error((await response.json()).error || 'Could not change the plan.');
     const updated = await readPlan(owner);
     setPlan(updated);setConfirm(false);onChanged(updated.paid);
   }catch(e){setError(e instanceof Error?e.message:'Could not save the plan.');}
   finally{setBusy(false);}
 }
 const targetPlan = plan?.paid ? 'Free' : 'Paid';
 return (
   <details className={styles.accountDisclosure}>
     <summary>Business plan <span>{plan ? (plan.paid ? 'Paid Business Account' : 'Free Business Account') : 'Plan details'}</span></summary>
     {plan && <div className={ui.panel}>
       {!plan.paid && <div className={ui.balance}>
         <div className={ui.balanceLine}><strong>Available credits</strong><span><b>{plan.remaining}</b> of {plan.limit}</span></div>
         <progress value={plan.remaining} max={Math.max(1,plan.limit)} aria-label="Available credits" />
       </div>}
       {plan.pending && !plan.paid && <p>Upgrade requested</p>}
       {confirm || refillId ? <div className={ui.confirmation}>
         <p>{refillId ? 'Restore the full credit balance for this month?' : plan.paid ? 'Switch to Free Business? Staff access will pause. Team assignments and shared assets are preserved.' : 'Activate Paid Business? This unlocks staff access, Business stock, Parts Stock and hosted client registers.'}</p>
         <div className={ui.actions}>
           <button type="button" className={ui.primary} disabled={busy} onClick={()=>void (refillId ? refill() : save())}>{busy ? 'Saving…' : refillId ? 'Confirm refill' : 'Confirm change'}</button>
           <button type="button" disabled={busy} onClick={()=>{setConfirm(false);setRefillId('');}}>Cancel</button>
         </div>
       </div> : <div className={ui.actions}>
         {!plan.paid && <button type="button" className={ui.primary} disabled={busy || !plan.canRefill} onClick={()=>{setMessage('');setRefillId(crypto.randomUUID());}}>Refill credits</button>}
         <button type="button" disabled={busy} onClick={()=>{setMessage('');setConfirm(true);}}>Switch to {targetPlan} Business</button>
       </div>}
       {message && <p role="status">{message}</p>}
       {plan.changes.length>0 && <ul className={ui.history}>{plan.changes.map((change,i)=><li key={i}>{change.plan==='paid'?'Paid':'Free'} Business · {change.actor || 'Admin'} · {new Date(change.changed_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}</li>)}</ul>}
     </div>}
     {error && <p role="alert">{error}</p>}
   </details>
 );
}
