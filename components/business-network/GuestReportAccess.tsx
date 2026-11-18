'use client';
import DateInput from '../DateInput';
import {useEffect,useState} from 'react';
import styles from './BusinessNetwork.module.css';
export default function GuestReportAccess(){
 const [data,setData]=useState<{guests:any[]}>({guests:[]}),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 async function load(){setLoading(true);setLoadError('');try{const r=await fetch('/api/admin/guest-businesses',{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);}catch(e){setLoadError(e instanceof Error?e.message:'Unable to load guest access.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function change(email:string,action:string,accessUntil?:string,note?:string){setBusy(true);setNotice('');try{const r=await fetch('/api/admin/guest-businesses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,action,accessUntil,note})}),d=await r.json();if(!r.ok)throw new Error(d.error);setNotice('Guest access updated.');await load();}catch(e){setNotice(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 return <section className={styles.panel}>
 <button type="button" className={styles.button} disabled={loading || busy} onClick={()=>void load()}>{loading ? "Loading guest access…" : "Refresh guest access"}</button>
 {notice&&<p role="status">{notice}</p>}
 {loadError&&<p role="alert">{loadError} Use Refresh to try again.</p>}
 {!loading && !loadError && <>
 <details className={styles.directoryDisclosure}><summary>Guest report access ({data.guests.length})</summary><p>After receiving payment, choose an expiry date and activate access. Activation applies to reports that owners share with this business email.</p>
 {data.guests.map(g=><article key={g.email} className={styles.card}><strong>{g.business_name}</strong><span>{g.contact_name} · {g.email}</span><span>{g.suspended?'Suspended':g.active?'Active':'Awaiting activation / expired'}{g.access_until?` · until ${new Date(g.access_until).toLocaleDateString('en-ZA')}`:''}</span>
 <form onSubmit={event=>{event.preventDefault();const f=new FormData(event.currentTarget);void change(g.email,'activate',`${f.get('until')}T23:59:59Z`,String(f.get('note')||''));}}><label>Access expiry<DateInput name="until" aria-label="Access expiry" required/></label><label>Payment reference / note<input name="note" maxLength={500}/></label><button className={styles.primary} disabled={busy}>Activate paid access</button></form>
 <button type="button" className={styles.button} disabled={busy} onClick={()=>void change(g.email,'suspend')}>Suspend access</button></article>)}
 {!data.guests.length&&<p>Businesses appear here after confirming their email on a shared lead page.</p>}</details>
 </>}
 </section>;
}
