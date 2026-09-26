'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './ExternalLeadActions.module.css';
export default function ExternalAccessRequests({token}: {token:string}) {
  const router = useRouter();
  const [requests,setRequests] = useState<{user_id:string;email:string;business_name:string;status:string}[]>([]);
  const [notice,setNotice] = useState(''),[busy,setBusy] = useState(false);
  useEffect(()=>{const controller=new AbortController();fetch(`/api/asset-share-links/${token}/access`,{signal:controller.signal,cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to load access requests.');if(!controller.signal.aborted)setRequests(data.requests||[]);}).catch(e=>{if(!controller.signal.aborted)setNotice(e.message);});return()=>controller.abort();},[token]);
  async function review(userId:string,decision:string) {
    setBusy(true);setNotice('');
    try {const r=await fetch(`/api/asset-share-links/${token}/access`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,decision})});const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to review access.');setRequests(current=>current.map(row=>({...row,status:row.user_id===userId?decision:decision==='approved'&&row.status==='pending'?'rejected':row.status})));setNotice(decision==='approved'?'Recipient approved. They can use the selected actions.':'Access request declined.');router.refresh();}catch(e){setNotice(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
  }
  return <section className={styles.panel} aria-label="Recipient access"><h3>Recipient access</h3><p className={styles.hint}>Approve only the business you intended to invite. Each link can be assigned to one account.</p>{requests.length?requests.map(row=><div className={styles.gate} key={row.user_id}><strong>{row.business_name}</strong><p>{row.email}</p>{row.status==='pending'?<div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={()=>void review(row.user_id,'approved')}>Approve access</button><button className={styles.secondary} disabled={busy} onClick={()=>void review(row.user_id,'rejected')}>Decline</button></div>:<p>{row.status==='approved'?'Access approved':'Access declined'}</p>}</div>):<p className={styles.hint}>No access requests yet. The recipient can request access after verification.</p>}{notice&&<p role="status">{notice}</p>}</section>;
}
