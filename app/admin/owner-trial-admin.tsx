'use client';
import {useEffect,useState} from 'react';
import styles from './page.module.css';

type Trial={ends_at:string;version:string};
export default function OwnerTrialAdmin({owner}:{owner:string}) {
  const [trial,setTrial]=useState<Trial|null>(null),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    async function read(){
      try {
        const response=await fetch('/api/admin/owner-trial?owner='+encodeURIComponent(owner),{cache:'no-store',signal:controller.signal});
        const data=await response.json();
        if(!response.ok) throw Error(data.error || 'Could not load trial.');
        setTrial(data.trial);
      } catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not load trial.');}
    }
    void read();return ()=>controller.abort();
  },[owner]);
  async function restart(){
    if(!trial || busy)return;
    setBusy(true);setError('');setMessage('');
    try {
      const response=await fetch('/api/admin/owner-trial',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner,version:trial.version,confirmed:true})});
      const data=await response.json();
      if(!response.ok)throw Error(data.error || 'Could not restart trial.');
      setTrial(data.trial);setConfirm(false);setMessage('Trial restarted.');
    } catch(e){setError(e instanceof Error?e.message:'Could not restart trial.');} finally{setBusy(false);}
  }
  if(!trial)return error?<p role="alert">{error}</p>:null;
  const end=new Date(trial.ends_at);
  return <details className={styles.accountDisclosure}><summary>Owner trial <span>{end.getTime()>Date.now()?'Ends':'Ended'} {end.toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg',day:'numeric',month:'short',year:'numeric'})}</span></summary>
    <div className={styles.accountActionSummary}>{confirm ? <><p>Start a fresh 30 days from today?</p>
      <button type="button" className={styles.accountActionButton} disabled={busy} onClick={()=>void restart()}>Confirm restart</button>
      <button type="button" className={styles.accountActionButton} disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button></> :
      <button type="button" className={styles.accountActionButton} onClick={()=>{setMessage('');setConfirm(true);}}>Restart 30-day trial</button>}
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    </div></details>;
}
