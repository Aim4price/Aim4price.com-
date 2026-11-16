'use client';
import {useEffect,useId,useRef,useState} from 'react';
import ShareDisclosureDialog from './asset-register/ShareDisclosureDialog';
import directory from './business-network/PartnerDirectory.module.css';
import asset from '../app/asset-register/page.module.css';
import styles from './PartsBusinessPicker.module.css';
export type PartsBusiness={email:string;business_name:string;town_city:string;address?:string;phone?:string;services?:string;logo_url?:string};
type Props={name:string;count:number;network:string;api:(body?:Record<string,unknown>,query?:string)=>Promise<any>;selected:string;onSelect:(business:PartsBusiness|null)=>void;onContinue:()=>void;onClose:()=>void};
export default function PartsBusinessPicker({name,count,network,api,selected,onSelect,onContinue,onClose}:Props){
 const title=useId(),areaId=useId();const request=useRef(0);
 const [search,setSearch]=useState(''),[area,setArea]=useState(''),[rows,setRows]=useState<PartsBusiness[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[details,setDetails]=useState(''),[help,setHelp]=useState(false);
 async function load(nextArea=area){const id=++request.current;setBusy(true);setError('');setDetails('');onSelect(null);try{const result=await api(undefined,`?view=recipients&network=${encodeURIComponent(network)}&search=${encodeURIComponent(search)}&area=${encodeURIComponent(nextArea)}`);if(id===request.current)setRows(result.recipients||[]);}catch(e){if(id===request.current){setRows([]);setError(e instanceof Error?e.message:'Could not load businesses. Please try again.');}}finally{if(id===request.current)setBusy(false);}}
 useEffect(()=>{void load();return()=>{request.current++;};},[network]); // Load approved businesses when the chooser opens.
 return <ShareDisclosureDialog title="Choose a business." titleId={title} closeLabel="Back to share options" onClose={onClose} className={styles.dialog}>
 <p className={styles.subtitle}>{count} {count===1?'part':'parts'} in {name}</p>
 <div className={styles.body}>
 <div className={directory.controls}><form className={directory.filters} onSubmit={e=>{e.preventDefault();document.getElementById(areaId)?.removeAttribute('open');void load();}}>
 <label>Business<input aria-label="Find sharing recipient" placeholder="Find a business by name" value={search} onChange={e=>{setSearch(e.target.value);onSelect(null);}}/></label>
 <details id={areaId} className={directory.areaFilter}><summary>{area||'All areas'}<span aria-hidden="true">⌄</span></summary><div className={directory.areaPopover}><label>Area<input placeholder="Town or province" value={area} onChange={e=>{setArea(e.target.value);onSelect(null);}}/></label><button type="button" disabled={busy} onClick={()=>{setArea('');document.getElementById(areaId)?.removeAttribute('open');void load('');}}>Search all areas</button></div></details>
 <button type="submit" disabled={busy}>{busy?'Searching…':'Search'}</button></form></div>
 <div className={directory.layout}><section className={directory.results} aria-label="Available companies" aria-busy={busy}>
 <div className={directory.summary} role="status">{busy?'Finding businesses…':`${rows.length} ${rows.length===1?'business':'businesses'}`}</div>
 {error?<p role="alert">{error}</p>:null}
 <div className={directory.list}>{!busy&&rows.map((business,index)=><article key={business.email} className={`${directory.row} ${selected===business.email?directory.selected:''}`}>
 <div className={directory.identity}>{business.logo_url?<img src={business.logo_url} alt=""/>:<span className={directory.initial} aria-hidden="true">{(business.business_name||business.email).charAt(0)}</span>}<div><strong>{business.business_name||business.email}</strong><small>Aim4price account</small></div></div>
 <div className={directory.description}><span>{business.town_city||'Location not provided'}</span><small>{business.services||'Approved directory business'}</small></div>
 <div className={directory.rowActions}><button type="button" aria-expanded={details===business.email} aria-controls={`${title}-${index}`} onClick={()=>setDetails(details===business.email?'':business.email)}>{details===business.email?'Hide details':'Details'}</button><button type="button" aria-pressed={selected===business.email} onClick={()=>onSelect(selected===business.email?null:business)}>{selected===business.email?'Selected ✓':'Select'}</button></div>
 {details===business.email?<div id={`${title}-${index}`} className={directory.details}><dl>{[['Address',business.address||business.town_city],['Services',business.services],['Phone',business.phone],['Email',business.email]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Not provided'}</dd></div>)}</dl></div>:null}
 </article>)}</div>
 {!busy&&!error&&!rows.length?<div className={styles.empty}><strong>No businesses found</strong><p>Try another business name or search all areas.</p></div>:null}
 <footer className={directory.footer}><span>{selected?'1 business selected':'Select one company'}</span><button type="button" className={asset.primaryButton} disabled={!selected||busy} onClick={onContinue}>Continue</button></footer>
 </section></div>
 <div className={directory.invitation}><button type="button" className={styles.missing} aria-expanded={help} onClick={()=>setHelp(!help)}>Business not listed?<span aria-hidden="true">{help?'−':'+'}</span></button></div>
 {help?<p className={styles.help}>Only approved directory businesses with an active Aim4price account can receive an inside share. Ask the business to complete its directory listing, or go back and choose Share link.</p>:null}
 </div></ShareDisclosureDialog>;
}
