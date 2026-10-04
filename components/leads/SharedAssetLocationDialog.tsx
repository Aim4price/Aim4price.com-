'use client';
import {useEffect,useState,useRef} from 'react';
import {useRouter} from 'next/navigation';
import AssetLocationEditor,{type AssetLocationValue} from '../AssetLocationEditor';
import styles from './SharedAssetWorkDialog.module.css';
import LeadActionDialog from './LeadActionDialog';
export default function SharedAssetLocationDialog({endpoint,assetTitle,onClose,onSaved}:{endpoint:string;assetTitle:string;onClose:()=>void;onSaved?:()=>void}) {
 const pending=useRef<{payload:string;id:string}|null>(null);
 const router=useRouter(),[location,setLocation]=useState<AssetLocationValue|null>(null),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();fetch(`${endpoint}/location`,{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setLocation(d.location)}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[endpoint]);
 return <LeadActionDialog title="Asset location" assetTitle={assetTitle} onClose={onClose} className={styles.detailsDialog}>{error?<p role="alert">{error}</p>:!location?<p>Loading location…</p>:<AssetLocationEditor location={location} onSave={async value=>{const payload=JSON.stringify(value);if(pending.current?.payload!==payload)pending.current={payload,id:crypto.randomUUID()};const r=await fetch(`${endpoint}/location`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...value,requestId:pending.current.id})});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not save location.');router.refresh();pending.current=null;onSaved?.()}}/>}</LeadActionDialog>;
}
