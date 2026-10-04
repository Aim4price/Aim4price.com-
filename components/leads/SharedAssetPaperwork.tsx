'use client';
import {useEffect,useState} from 'react';
import AssetPaperworkFields,{type AssetStatusDraft} from '../AssetPaperworkFields';
import styles from '../../app/asset-register/page.module.css';
type Section='finance'|'insurance'|'license';
export default function SharedAssetPaperwork({endpoint,onSaved,initialSection}:{endpoint:string;onSaved?:()=>void;initialSection?:Section}) {
 const [draft,setDraft]=useState<AssetStatusDraft|null>(null),[kind,setKind]=useState(''),[view,setView]=useState<Section|'hub'>(initialSection || 'hub'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
 useEffect(()=>{const c=new AbortController();fetch(`${endpoint}/paperwork`,{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setDraft(d.draft);setKind(d.kind)}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[endpoint]);
 function update<K extends keyof AssetStatusDraft>(key:K,value:AssetStatusDraft[K]) {setDraft(d=>d?{...d,[key]:value}:d);setRequestId(crypto.randomUUID());setNotice('');}
 async function save(section:Section){if(!draft||busy)return;setBusy(true);setError('');try{const r=await fetch(`${endpoint}/paperwork`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...draft,section,requestId})});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not save.');setNotice('Saved to the owner’s asset.');setView('hub');setRequestId(crypto.randomUUID());onSaved?.()}catch(e){setError(e instanceof Error?e.message:'Could not save.')}finally{setBusy(false)}}
 if(!draft)return <p role={error?'alert':'status'}>{error||'Loading paperwork…'}</p>;
 const label=(status:string,yes:string,no:string)=>({yes,no,paid:'Paid off',unknown:'Not sure',not_applicable:'Not applicable'}[status]||'Not sure');
 return <>{view!=='hub'&&<button type="button" className={styles.secondaryButton} disabled={busy} onClick={()=>{setView('hub');setError('')}}>Back to paperwork</button>}{notice&&<p role="status">{notice}</p>}
 <AssetPaperworkFields assetStatusDraft={draft} assetStatusEditView={view} assetLicenseApplicable={kind!=='property'} openAssetStatusEditView={section=>{setView(section);setError('');setNotice('')}} updateAssetStatusDraftField={update}
 setAssetFinanceStatus={v=>update('financeStatus',v)} setAssetFinanceType={v=>update('financeType',v)} setAssetInsuranceStatus={v=>update('insuranceStatus',v)} setAssetLicenseStatus={v=>update('licenseStatus',v)} handleInsuredValueChange={v=>update('insuredValueExVat',v)} formatRegisterValueInput={v=>String(v??'')}
 finishAssetStatusSection={save} isSavingAssetStatus={busy} assetStatusError={error} summaries={{finance:label(draft.financeStatus,'Financed','Not financed'),insurance:label(draft.insuranceStatus,'Insured','Not insured'),license:label(draft.licenseStatus,'Licensed','Not licensed')}} />
 </>;
}
