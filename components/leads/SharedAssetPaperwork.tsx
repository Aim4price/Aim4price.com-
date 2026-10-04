'use client';
import {useEffect,useState} from 'react';
import AssetPaperworkFields,{type AssetStatusDraft} from '../AssetPaperworkFields';
import styles from '../../app/asset-register/page.module.css';
type Section='finance'|'insurance'|'license';
export default function SharedAssetPaperwork({endpoint,onSaved,initialSection,onUpload,onDirtyChange}:{endpoint:string;onSaved?:()=>void;initialSection?:Section;onUpload?:()=>void;onDirtyChange?:(dirty:boolean)=>void}) {
 const [draft,setDraft]=useState<AssetStatusDraft|null>(null),[kind,setKind]=useState(''),[view,setView]=useState<Section|'hub'>(initialSection || 'hub'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [dirty,setDirty]=useState(false);
 useEffect(()=>{onDirtyChange?.(dirty||busy);return()=>onDirtyChange?.(false);},[dirty,busy,onDirtyChange]);
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
 useEffect(()=>{const c=new AbortController();fetch(`${endpoint}/paperwork`,{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setDraft(d.draft);setKind(d.kind)}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[endpoint]);
 function update<K extends keyof AssetStatusDraft>(key:K,value:AssetStatusDraft[K]) {setDraft(d=>d?{...d,[key]:value}:d);setRequestId(crypto.randomUUID());setNotice('');setDirty(true);}
 async function save(section:Section){if(!draft||busy)return;setBusy(true);setError('');try{const r=await fetch(`${endpoint}/paperwork`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...draft,section,requestId})});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not save.');setNotice('Saved to the owner’s asset.');setDirty(false);setView('hub');setRequestId(crypto.randomUUID());onSaved?.()}catch(e){setError(e instanceof Error?e.message:'Could not save.')}finally{setBusy(false)}}
 if(!draft)return <p role={error?'alert':'status'}>{error||'Loading paperwork…'}</p>;
 const label=(status:string,yes:string,no:string)=>({yes,no,paid:'Paid off',unknown:'Not sure',not_applicable:'Not applicable'}[status]||'Not sure');
 return <>{view!=='hub'&&<button type="button" className={styles.secondaryButton} disabled={busy} onClick={()=>{if(dirty)void save(view as Section);else {setView('hub');setError('')}}}>Back to paperwork</button>}{notice&&<p role="status">{notice}</p>}
 <AssetPaperworkFields documentControls={onUpload?Object.fromEntries((['finance','insurance','license'] as const).map(section=>[section,<div key={section} className={`${styles.assetStatusDocumentUpload} ${styles.assetStatusWideField}`}><div className={styles.assetStatusDocumentUploadCopy}><strong>{section==='license'?'Licence':section==='finance'?'Finance':'Insurance'} documents</strong><small>Asset paperwork only — no invoices.</small></div><button type="button" className={`${styles.secondaryButton} ${styles.assetStatusDocumentPicker}`} onClick={onUpload}>Add {section==='license'?'licence':section} documents</button></div>])):undefined} assetStatusDraft={draft} assetStatusEditView={view} assetLicenseApplicable={kind!=='property'} openAssetStatusEditView={section=>{setView(section);setError('');setNotice('')}} updateAssetStatusDraftField={update}
 setAssetFinanceStatus={v=>update('financeStatus',v)} setAssetFinanceType={v=>update('financeType',v)} setAssetInsuranceStatus={v=>update('insuranceStatus',v)} setAssetLicenseStatus={v=>update('licenseStatus',v)} handleInsuredValueChange={v=>update('insuredValueExVat',v)} formatRegisterValueInput={v=>String(v??'')}
 finishAssetStatusSection={save} isSavingAssetStatus={busy} assetStatusError={error} summaries={{finance:label(draft.financeStatus,'Financed','Not financed'),insurance:label(draft.insuranceStatus,'Insured','Not insured'),license:label(draft.licenseStatus,'Licensed','Not licensed')}} />
 </>;
}
