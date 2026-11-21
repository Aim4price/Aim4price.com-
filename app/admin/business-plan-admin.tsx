'use client';
import {useEffect,useState} from 'react';
import styles from './page.module.css';

type Plan = {businessId:string;paid:boolean;pending:boolean;changes:{plan:'free'|'paid';changed_at:string;actor:string|null}[]};
async function readPlan(owner:string,signal?:AbortSignal):Promise<Plan>{
 const response=await fetch('/api/admin/business-credits?owner='+encodeURIComponent(owner),{cache:'no-store',signal});
 const result=await response.json();
 if(!response.ok) throw Error(result.error || 'Could not load the plan.');
 return result;
}
export default function BusinessPlanAdmin({owner}:{owner:string}){
 const [plan,setPlan]=useState<Plan|null>(null),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
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
     setPlan(await readPlan(owner));setConfirm(false);
   }catch(e){setError(e instanceof Error?e.message:'Could not save the plan.');}
   finally{setBusy(false);}
 }
 return <details className={styles.accountDisclosure}><summary>Business plan <span>{plan?(plan.paid?'Paid Business':'Free Business'):'Plan details'}</span></summary>
 {plan && <div className={styles.accountActionSummary}>
 {plan.pending && !plan.paid && <p>Upgrade requested</p>}
 {confirm ? <><p>{plan.paid?'Switch to Free? Staff access will pause. Team assignments and the owner’s Shared Assets are preserved.':'Activate Paid Business? This unlocks Business stock, Parts Stock, hosted client registers and staff access.'}</p>
 <button type="button" className={styles.accountActionButton} disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Confirm change'}</button>
 <button type="button" className={styles.accountActionButton} disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button></> :
 <button type="button" className={styles.accountActionButton} onClick={()=>setConfirm(true)}>Switch to {plan.paid?'Free':'Paid'} Business</button>}
 {plan.changes.length>0 && <ul>{plan.changes.map((change,i)=><li key={i}>{change.plan==='paid'?'Paid':'Free'} Business · {change.actor || 'Admin'} · {new Date(change.changed_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}</li>)}</ul>}
 </div>}{error && <p role="alert">{error}</p>}</details>;
}
