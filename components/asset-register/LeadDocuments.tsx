'use client';
import {useEffect,useState} from 'react';
import type {LeadSubmission} from '../../lib/lead-submissions';
import styles from './GuestLead.module.css';
export default function LeadDocuments({token,owner=false}:{token:string;owner?:boolean}){
 const [items,setItems]=useState<LeadSubmission[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const endpoint=`/api/asset-share-links/${token}/submissions`;
 async function load(signal?:AbortSignal){const r=await fetch(endpoint,{cache:'no-store',signal}),d=await r.json();if(!r.ok)throw new Error(d.error);setItems(d.submissions);}
 useEffect(()=>{if(!owner)return;const c=new AbortController();void load(c.signal).catch(e=>{if(!c.signal.aborted)setNotice(e.message);});return()=>c.abort();},[token,owner]);
 async function review(id:string,status:string){setBusy(true);setNotice('');try{const r=await fetch(endpoint,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})}),d=await r.json();if(!r.ok)throw new Error(d.error);await load();setNotice('Review saved. No asset details or costs were changed.');}catch(e){setNotice(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 return <section className={styles.panel} aria-label={owner?'Review received documents':'Send a document'}>
 <h2>{owner?'Received invoices & quotes':'Send an invoice or quote'}</h2>
 {owner?<><p>Sender details are self-reported. Review the document before using it. Accepting keeps it with this enquiry; it does not add a cost or change an asset.</p><button type="button" disabled={busy} onClick={()=>void load().catch(e=>setNotice(e.message))}>Refresh documents</button>{!items.length&&<p>No documents received yet.</p>}{items.map(item=><div className={styles.report} key={item.id}><div><strong>{item.kind==='invoice'?'Invoice':'Quote'} · {item.file_name}</strong><p>{item.sender_name} · {item.sender_contact}</p><p>{item.note}</p><small>{new Date(item.created_at).toLocaleDateString('en-ZA')} · {item.status}</small></div><div className={styles.actions}><a href={`${endpoint}?id=${item.id}`}>Download for review</a>{item.status==='pending'&&<><button disabled={busy} onClick={()=>void review(item.id,'accepted')}>Accept document</button><button disabled={busy} onClick={()=>void review(item.id,'rejected')}>Reject</button></>}</div></div>)}</>:<><p>The owner has enabled document submissions. No account is needed. Your document goes to the owner for review and will not be visible to other visitors.</p><form className={styles.form} onSubmit={async event=>{event.preventDefault();const form=event.currentTarget;setBusy(true);setNotice('');try{const r=await fetch(endpoint,{method:'POST',body:new FormData(form)}),d=await r.json();if(!r.ok)throw new Error(d.error);form.reset();setNotice('Document sent to the owner for review.');}catch(e){setNotice(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}}>
 <label>Your name<input name="name" required maxLength={150}/></label><label>Your email or phone<input name="contact" required maxLength={254}/></label>
 <label>Document type<select name="kind"><option value="quote">Quote</option><option value="invoice">Invoice</option></select></label>
 <label>Document · PDF, JPG, PNG or WEBP · up to 12 MB<input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.setCustomValidity(file&&file.size>12*1024*1024?'Choose a file no larger than 12 MB.':'');}}/></label>
 <label>Note · optional<textarea name="note" maxLength={2000}/></label><button disabled={busy}>{busy?'Uploading…':'Send to owner'}</button>
 </form></>}{notice&&<p role="status">{notice}</p>}</section>;
}
