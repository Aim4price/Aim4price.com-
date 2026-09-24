'use client';
import {useState} from 'react';
import styles from './BusinessNetwork.module.css';
type Place={id:string;displayName?:{text?:string};formattedAddress?:string;googleMapsUri?:string};
export default function FindEnquiryBusiness({onShare}:{onShare:(recipient:{name:string;email:string;phone:string})=>void}){
 const [query,setQuery]=useState(''),[name,setName]=useState(''),[places,setPlaces]=useState<Place[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 return <details className={styles.directoryDisclosure}><summary>Business not listed?</summary><div className={styles.card}>
 <p>Find a business on Google or enter its name. It can receive your enquiry without joining the directory.</p>
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setNotice('');setPlaces([]);try{const r=await fetch('/api/business-network/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})}),d=await r.json();if(!r.ok)throw new Error(d.error);setPlaces(d.places);if(!d.places.length)setNotice('No matches. Try the town or enter the business below.');}catch(e){setNotice(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}}>
 <label>Business name and town<input value={query} minLength={3} maxLength={200} required onChange={e=>setQuery(e.target.value)}/></label><button type="submit" disabled={busy}>{busy?'Searching…':'Search Google'}</button>
 </form>
 {places.length>0&&<div aria-label="Google business results"><a href="https://maps.google.com" target="_blank" rel="noreferrer" translate="no">Google Maps</a>{places.map(place=><div className={styles.card} key={place.id}><strong>{place.displayName?.text}</strong><small>{place.formattedAddress}</small>{place.googleMapsUri?.startsWith('https://')&&<a href={place.googleMapsUri} target="_blank" rel="noreferrer">View on Google Maps</a>}<button type="button" onClick={()=>{setName(place.displayName?.text||'');setNotice('Confirm the business name below. Add its email or confirmed WhatsApp number in the next step.');}}>Choose business</button></div>)}</div>}
 <label>Business name · confirm or enter manually<input value={name} maxLength={200} onChange={e=>setName(e.target.value)}/></label>
 <button type="button" className={styles.primary} disabled={!name.trim()} onClick={()=>onShare({name:name.trim(),email:'',phone:''})}>Prepare enquiry</button>
 <p>This does not publish a directory listing. The shared page includes an optional invitation to join.</p>{notice&&<p role="status">{notice}</p>}
 </div></details>;
}
