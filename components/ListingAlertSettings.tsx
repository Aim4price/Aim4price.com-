'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EMPTY_LISTING_FILTERS, listingMatchKey, type ListingWatch, type ListingWatchFilters } from '../lib/listing-alert-policy';
import type { PushApp } from '../lib/push-policy';
import styles from './PhoneNotificationSettings.module.css';
import form from './ListingAlertSettings.module.css';
const provinces=['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'];
type Family={sectorKey:string;familyKey:string;familyLabel:string};
function Editor({app,initialFilters}:{app:PushApp;initialFilters?:ListingWatchFilters}) {
  const [watch,setWatch]=useState<ListingWatch>({enabled:false,delivery:'daily',filters:{...EMPTY_LISTING_FILTERS}});
  const [families,setFamilies]=useState<Family[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const initial=useRef(initialFilters);
  useEffect(()=>{let active=true;
    void fetch('/api/app-notifications/listings',{cache:'no-store',headers:{'x-aim4price-client-realm':app}}).then(async r=>{const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'Could not load listing alerts.');if(active){setWatch({...data.watch,...(initial.current?{filters:{...initial.current,family:listingMatchKey(initial.current.family)}}:{})});setLoading(false);}}).catch(e=>{if(active)setError(e.message);});
    void fetch('/api/equipment-families',{cache:'no-store',headers:{'x-aim4price-client-realm':app}}).then(r=>r.json()).then(data=>{if(active)setFamilies(data.families||[]);}).catch(()=>{});
    return()=>{active=false;};
  },[app]);
  function filter<K extends keyof ListingWatchFilters>(key:K,value:ListingWatchFilters[K]) {setNotice('');setWatch(w=>({...w,filters:{...w.filters,[key]:value,...(key==='sector'?{family:''}:{})}}));}
  async function save(enabled=watch.enabled) {
    setBusy(true);setError('');setNotice('');
    try{const next={...watch,enabled};const r=await fetch('/api/app-notifications/listings',{method:'POST',headers:{'Content-Type':'application/json','x-aim4price-client-realm':app},body:JSON.stringify(next)});const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'Could not save listing alerts.');setWatch(data.watch);setNotice(enabled?'Saved. Alerts start with new listings from now.':'Listing alerts paused.');}
    catch(e){setError(e instanceof Error?e.message:'Could not save listing alerts.');}finally{setBusy(false);}
  }
  const available=families.filter(f=>f.sectorKey===watch.filters.sector);
  return <section className={form.editor} aria-busy={busy||loading}>
    {loading&&!error?<p>Loading listing interests…</p>:null}
    {error?<p role="alert" className={form.error}>{error}</p>:null}
    {!loading?<>
      <p>Only new public listings matching your interests. Phone alerts follow your notification settings.</p>
      <label>Sector<select value={watch.filters.sector} onChange={e=>filter('sector',e.target.value)}><option value="">Any sector</option>{[['agricultural','Agriculture'],['construction','Construction'],['industrial','Industrial'],['motor','Motor']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label>Asset type<select value={watch.filters.family} onChange={e=>filter('family',e.target.value)} disabled={!watch.filters.sector}><option value="">Any asset type</option>{watch.filters.family&&!available.some(f=>listingMatchKey(f.familyKey)===listingMatchKey(watch.filters.family))?<option value={watch.filters.family}>{watch.filters.family.replace(/[_-]/g,' ')}</option>:null}{available.map(f=><option key={f.familyKey} value={listingMatchKey(f.familyKey)}>{f.familyLabel}</option>)}</select></label>
      <label>Brand or model <span>(optional)</span><input maxLength={120} value={watch.filters.query} onChange={e=>filter('query',e.target.value)} placeholder="For example, John Deere" /></label>
      <label>Location<select value={watch.filters.province} onChange={e=>filter('province',e.target.value)}><option value="">Nationwide</option>{provinces.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
      <label>Minimum price, excl. VAT <span>(optional)</span><input type="number" inputMode="decimal" min="0" value={watch.filters.minPrice??''} onChange={e=>filter('minPrice',e.target.value===''?null:Number(e.target.value))} /></label>
      <label>Maximum price, excl. VAT <span>(optional)</span><input type="number" inputMode="decimal" min="0" value={watch.filters.maxPrice??''} onChange={e=>filter('maxPrice',e.target.value===''?null:Number(e.target.value))} /></label>
      <label>Phone delivery<select value={watch.delivery} onChange={e=>setWatch(w=>({...w,delivery:e.target.value as ListingWatch['delivery']}))}><option value="daily">Daily summary</option><option value="instant">As listings arrive</option></select></label>
      <button type="button" className={styles.button} disabled={busy} onClick={()=>void save(true)}>{busy?'Saving…':'Save listing alerts'}</button>
      {watch.enabled?<button type="button" className={styles.button} disabled={busy} onClick={()=>void save(false)}>Pause listing alerts</button>:null}
      <p role="status">{notice||(!watch.enabled?'Listing alerts are off.':'Listing alerts are on.')}</p>
    </>:null}
  </section>;
}
export default function ListingAlertSettings({app,initialFilters,inline=false}:{app:PushApp;initialFilters?:ListingWatchFilters;inline?:boolean}) {
  const [open,setOpen]=useState(false);const dialog=useRef<HTMLDialogElement|null>(null),trigger=useRef<HTMLButtonElement>(null);
  if(inline)return <details className={form.details}><summary>Listing interests</summary><Editor app={app} /></details>;
  return <><button ref={trigger} type="button" className={styles.button} aria-haspopup="dialog" onClick={()=>setOpen(true)}>Notify me of similar assets</button>
    {open&&typeof document!=='undefined'?createPortal(<dialog ref={node=>{dialog.current=node;if(node&&!node.open)node.showModal();}} className={styles.dialog} aria-labelledby="listing-alert-heading" onClose={()=>{setOpen(false);trigger.current?.focus();}}>
      <header className={styles.modalHeading}><h2 id="listing-alert-heading">Listing alerts</h2><button type="button" className={styles.close} aria-label="Close listing alerts" onClick={()=>dialog.current?.close()}>×</button></header>
      <Editor app={app} initialFilters={initialFilters} /><button type="button" className={styles.button} onClick={()=>dialog.current?.close()}>Done</button>
    </dialog>,document.body):null}</>;
}
