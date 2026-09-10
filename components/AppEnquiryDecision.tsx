'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './AppNotifications.module.css';
export default function AppEnquiryDecision({id,licensing=false}:{id:string;licensing?:boolean}) {
  const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState('');
  async function decide(decision:'yes'|'no'){
    setBusy(true);setError('');
    try{const response=await fetch(`/api/app-notifications/enquiries/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json','x-aim4price-client-realm':'owner'},body:JSON.stringify({decision})});const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Could not save your decision.');setDone(decision==='yes'?'Enquiry approved.':'Enquiry declined.');router.refresh();}
    catch(e){setError(e instanceof Error?e.message:'Could not save your decision.');}finally{setBusy(false);}
  }
  return <section>{done?<p role="status">{done}</p>:<><p>{licensing?'Interested in licence renewal help?':'Interested in selling?'} Approving shares your contact details with the requester.</p><div className={styles.actions}><button type="button" disabled={busy} onClick={()=>void decide('yes')}>Yes, share my contact details</button><button type="button" disabled={busy} onClick={()=>void decide('no')}>Not interested</button></div></>}{error?<p role="alert" className={styles.error}>{error}</p>:null}</section>;
}
