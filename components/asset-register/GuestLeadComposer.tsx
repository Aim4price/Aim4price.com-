'use client';
import {useEffect,useState} from 'react';
import LeadDocuments from './LeadDocuments';
import styles from './GuestLead.module.css';
export default function GuestLeadComposer({assetIds,includePhotos,recipient,reports,ready,onChange,selectionKey}:{selectionKey:string;assetIds:string[];includePhotos:boolean;recipient?:{name:string;email:string;phone:string};reports:{label:string;file:File}[];ready:boolean;onChange:(url:string,email?:string,whatsapp?:string)=>void}){
 const [fields,setFields]=useState({recipientName:recipient?.name||'',recipientEmail:recipient?.email||'',recipientWhatsApp:'',allowSubmissions:false,request:'',replyName:'',replyEmail:'',replyPhone:'',allowReply:true});
 const [history,setHistory]=useState<any[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[url,setUrl]=useState(''),[reviewToken,setReviewToken]=useState('');
 useEffect(()=>{setUrl('');},[selectionKey]);
 async function load(signal?:AbortSignal){const params=new URLSearchParams();assetIds.forEach(id=>params.append('assetId',id));const r=await fetch(`/api/asset-share-links/leads?${params}`,{cache:'no-store',signal}),d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load shared leads.');setHistory(d.leads||[]);setFields(f=>({...f,replyName:f.replyName||d.replyName||'',replyEmail:f.replyEmail||d.replyEmail||''}));}
 useEffect(()=>{const c=new AbortController();void load(c.signal).catch(e=>{if(!c.signal.aborted)setNotice(e.message);});return()=>c.abort();},[]); // The parent remounts on asset/recipient changes.
 function update(key:string,value:string|boolean){setFields(f=>({...f,[key]:value}));setUrl('');onChange('');}
 async function create(event:React.FormEvent){event.preventDefault();setBusy(true);setNotice('');try{
 const form=new FormData();form.set('assetIds',JSON.stringify(assetIds));form.set('includePhotos',String(includePhotos));form.set('details',JSON.stringify(fields));
 reports.forEach(report=>form.append('reports',report.file,`${report.label.replace(/\.pdf$/i,'').replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,180)}.pdf`));
 const r=await fetch('/api/asset-share-links/leads',{method:'POST',body:form}),d=await r.json();if(!r.ok)throw new Error(d.error||'Could not create the lead.');const next=`${window.location.origin}/asset-share/${d.share.token}`;setUrl(next);onChange(next,fields.recipientEmail,fields.recipientWhatsApp);setNotice('Lead link ready. Preview it, then send it from your email or WhatsApp.');await load();
 }catch(e){setNotice(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 async function revoke(token:string){setBusy(true);try{const r=await fetch('/api/asset-share-links',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!r.ok)throw new Error('Could not disable the lead.');if(url.endsWith(token)){setUrl('');onChange('');}await load();setNotice('Lead disabled, including its report access.');}catch(e){setNotice(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 return <section className={styles.panel} aria-label="Create a shared lead"><h2>Lead page</h2>
 <p>The basic card, photos you include and your request are visible to anyone with the link. Reports require an eligible verified Aim4price account matching the recipient email. Existing approved guest access is also honoured. Reports are kept on the lead page, not attached to your email.</p>
 <form className={styles.form} onSubmit={create}><fieldset disabled={busy} className={styles.fields}>
 <label>Business name<input value={fields.recipientName} maxLength={200} onChange={e=>update('recipientName',e.target.value)}/></label>
 <label>Recipient email · required for reports<input type="email" value={fields.recipientEmail} required={reports.length>0} maxLength={254} onChange={e=>update('recipientEmail',e.target.value)}/></label>
 <label>Confirmed recipient WhatsApp · optional<input type="tel" value={fields.recipientWhatsApp} placeholder="+27821234567" maxLength={40} onChange={e=>update('recipientWhatsApp',e.target.value)}/></label>
 <p>Enter an email, a confirmed WhatsApp number, or both. A business phone number is not automatically a WhatsApp number.</p>
 <label>Your request<textarea value={fields.request} required maxLength={3000} placeholder="Please quote to insure this asset." onChange={e=>update('request',e.target.value)}/></label>
 <label>Your name<input value={fields.replyName} required maxLength={150} onChange={e=>update('replyName',e.target.value)}/></label>
 <label>Your reply email<input type="email" value={fields.replyEmail} required maxLength={254} onChange={e=>update('replyEmail',e.target.value)}/></label>
 <label>Your WhatsApp number · optional<input type="tel" value={fields.replyPhone} maxLength={40} onChange={e=>update('replyPhone',e.target.value)}/></label>
 <label><span><input style={{width:'auto'}} type="checkbox" checked={fields.allowReply} onChange={e=>update('allowReply',e.target.checked)}/> Show reply buttons and my contact details on the lead</span></label>
 <label><span><input style={{width:'auto'}} type="checkbox" checked={fields.allowSubmissions} onChange={e=>update('allowSubmissions',e.target.checked)}/> Allow anyone with this link to submit invoices or quotes for my review</span></label>
 <p>{reports.length?`${reports.length} selected report(s) will be locked until the recipient has access.`:'No reports selected. Use Add report above to include reports.'} {includePhotos?'Saved asset photos are included.':'Photos are not included.'}</p>
 <button disabled={busy||!ready}>{busy?'Saving lead…':!ready?'Preparing reports…':'Create lead link'}</button>
 </fieldset></form>
 {url&&<div className={styles.actions}><a href={url} target="_blank" rel="noreferrer">Preview recipient page</a><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(url);setNotice('Lead link copied.');}catch{setNotice(url);}}}>Copy lead link</button></div>}
 {notice&&<p role="status">{notice}</p>}
 <details><summary>Previously shared leads ({history.length})</summary>{history.map(lead=><div key={lead.token} className={styles.report}><span>{lead.recipient_name||lead.recipient_email} · {lead.recipient_email}<br/>{new Date(lead.created_at).toLocaleDateString('en-ZA')} {lead.revoked_at?'· Disabled':''}</span><button type="button" onClick={()=>setReviewToken(reviewToken===lead.token?'':lead.token)}>Review documents{lead.pending_documents?` (${lead.pending_documents} new)`: ''}</button>{!lead.revoked_at&&<div className={styles.actions}><a href={`/asset-share/${lead.token}`} target="_blank" rel="noreferrer">View</a><button disabled={busy} type="button" onClick={()=>void revoke(lead.token)}>Disable</button></div>}</div>)}</details>
 {reviewToken&&<LeadDocuments token={reviewToken} owner/>}
 </section>;
}
