'use client';
import {useEffect,useState} from 'react';
import type {AdminBusiness} from '../../lib/admin-business-network';
import styles from './BusinessNetwork.module.css';
export default function DirectoryAdminAccess({onAdd}:{onAdd:(business:AdminBusiness)=>void}){
 const [data,setData]=useState<{acceptances:any[];guests:any[]}>({acceptances:[],guests:[]}),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{const r=await fetch('/api/admin/guest-businesses',{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);}catch(e){setNotice(e instanceof Error?e.message:'Unable to load.');}}
 useEffect(()=>{void load();},[]);
 async function change(email:string,action:string,accessUntil?:string,note?:string){setBusy(true);setNotice('');try{const r=await fetch('/api/admin/guest-businesses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,action,accessUntil,note})}),d=await r.json();if(!r.ok)throw new Error(d.error);setNotice('Guest access updated.');await load();}catch(e){setNotice(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 return <section className={styles.panel}>
 <button type="button" className={styles.button} onClick={()=>void load()}>Refresh acceptances & guest access</button>
 {notice&&<p role="status">{notice}</p>}
 <details className={styles.directoryDisclosure}><summary>Business acceptances ({data.acceptances.length})</summary><p>These are submitted requests. Review the contact details before publishing.</p>
 {data.acceptances.map(a=><article key={a.id} className={styles.card}><strong>{a.business_name}</strong><span>{a.contact_name} · {a.email} {a.phone}</span>{a.details?.town&&<span>{a.details.town}</span>}{a.details?.googleMapsUrl&&<a href={a.details.googleMapsUrl} target="_blank" rel="noopener noreferrer">View submitted Google listing</a>}{a.details?.whatsappConfirmed&&<small>Business confirmed WhatsApp enquiries on this number</small>}<small>Accepted {new Date(a.accepted_at).toLocaleDateString('en-ZA')}</small>{a.business_id?<span>Listing already added · {a.listing_status}</span>:<button type="button" className={styles.button} onClick={()=>onAdd({id:'',name:a.business_name,email:a.email,status:'invited',details:{...a.details,name:a.business_name,phone:a.phone}})}>Prepare listing</button>}</article>)}
 {!data.acceptances.length&&<p>No acceptances yet. Copy the acceptance link above and send it yourself.</p>}</details>
 <details className={styles.directoryDisclosure}><summary>Guest report access ({data.guests.length})</summary><p>After receiving payment, choose an expiry date and activate access. Activation applies to reports that owners share with this business email.</p>
 {data.guests.map(g=><article key={g.email} className={styles.card}><strong>{g.business_name}</strong><span>{g.contact_name} · {g.email}</span><span>{g.suspended?'Suspended':g.active?'Active':'Awaiting activation / expired'}{g.access_until?` · until ${new Date(g.access_until).toLocaleDateString('en-ZA')}`:''}</span>
 <form onSubmit={event=>{event.preventDefault();const f=new FormData(event.currentTarget);void change(g.email,'activate',`${f.get('until')}T23:59:59Z`,String(f.get('note')||''));}}><label>Access expiry<input type="date" name="until" required/></label><label>Payment reference / note<input name="note" maxLength={500}/></label><button className={styles.primary} disabled={busy}>Activate paid access</button></form>
 <button type="button" className={styles.button} disabled={busy} onClick={()=>void change(g.email,'suspend')}>Suspend access</button></article>)}
 {!data.guests.length&&<p>Businesses appear here after confirming their email on a shared lead page.</p>}</details>
 </section>;
}
