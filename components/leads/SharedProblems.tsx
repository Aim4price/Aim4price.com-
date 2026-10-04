'use client';
import {useCallback,useEffect,useState} from 'react';
import {createPortal} from '../WebsitePortal';
import AssetActionIcon from '../asset-register/AssetActionIcon';
import LeadActionDialog from './LeadActionDialog';
import LeadProblemCard from './LeadProblemCard';
import type {AssetIssueNoteStatus} from '../../lib/asset-issue-notes';
import styles from '../../app/asset-register/page.module.css';
export default function SharedProblems({endpoint,assetTitle,onClose,notesOnly=false,detailsVisible=true,canWrite=true}:{endpoint:string;assetTitle:string;onClose?:()=>void;notesOnly?:boolean;detailsVisible?:boolean;canWrite?:boolean}){
 const [items,setItems]=useState<AssetIssueNoteStatus[]>([]),[step,setStep]=useState<'choices'|'log'|'list'>('choices'),[note,setNote]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[resolve,setResolve]=useState<AssetIssueNoteStatus|null>(null),[requestId,setRequestId]=useState(()=>crypto.randomUUID());
 const load=useCallback(async(signal?:AbortSignal)=>{try{const response=await fetch(endpoint,{cache:'no-store',signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load problems.');setItems(data.items||[]);setError('');}catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'Could not load problems.');}finally{if(!signal?.aborted)setLoading(false);}},[endpoint]);
 useEffect(()=>{const c=new AbortController();void load(c.signal);const refresh=()=>void load(c.signal);window.addEventListener('aim4price:problems-updated',refresh);return()=>{c.abort();window.removeEventListener('aim4price:problems-updated',refresh);};},[load]);
 async function save(){setBusy(true);setError('');try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(resolve?{action:'resolve',problemId:resolve.id,confirmed:true,requestId}:{action:'log',note,requestId})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save problem.');setItems(data.items||[]);setResolve(null);setNote('');setRequestId(crypto.randomUUID());setStep('list');window.dispatchEvent(new Event('aim4price:problems-updated'));}catch(e){setError(e instanceof Error?e.message:'Could not save problem.');}finally{setBusy(false);}}
 const openProblems=items.filter(item=>!item.notedAtIso);
 const startResolve=(problem:AssetIssueNoteStatus)=>{setRequestId(crypto.randomUUID());setResolve(problem);};
 const list=items.map(problem=><div key={problem.id}><LeadProblemCard problem={problem}/>{canWrite&&!problem.notedAtIso&&<button className={styles.secondaryButton} type="button" onClick={()=>startResolve(problem)}>Resolved</button>}</div>);
 const banners=openProblems.map(problem=><div key={problem.id} className={`${styles.partnerNoteBanner} ${styles.issueNoteBanner}`}>
   <div className={styles.partnerNoteText}>
     <strong>Open issue reported</strong>
     <p>{problem.note}</p>
     <small className={styles.issueNoteMeta}>{[problem.operatorName ? `By ${problem.operatorName}` : '', problem.createdAtIso ? new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Johannesburg'}).format(new Date(problem.createdAtIso)) : ''].filter(Boolean).join(' · ')}</small>
   </div>
   {canWrite&&<button className={styles.partnerNoteButton} type="button" onClick={()=>startResolve(problem)}>Resolved</button>}
 </div>);
 const confirmation=resolve&&createPortal(<LeadActionDialog title="Resolve problem" assetTitle={assetTitle} onClose={()=>setResolve(null)} busy={busy} footer={<><button className={styles.secondaryButton} disabled={busy} onClick={()=>setResolve(null)}>Cancel</button><button className={styles.primaryButton} disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Yes, resolved'}</button></>}><p>Are you sure this problem is resolved?</p><p>{resolve.note}</p>{error&&<p role="alert">{error}</p>}</LeadActionDialog>,document.body);
 if(notesOnly)return <>{openProblems.length>0&&<span hidden data-open-problems="true"/>}{detailsVisible&&<>{error&&<p role="alert">{error}</p>}{banners}{confirmation}</>}</>;
 return <>{!resolve&&<LeadActionDialog title={step==='log'?'Log problem':step==='list'?'Logged problems':'Log problems'} assetTitle={assetTitle} onClose={onClose!} busy={busy} footer={step!=='choices'?<><button className={styles.secondaryButton} disabled={busy} onClick={()=>setStep('choices')}>Back</button>{step==='log'&&<button className={styles.primaryButton} disabled={busy||!note.trim()} onClick={()=>void save()}>{busy?'Saving…':'Save problem'}</button>}</>:undefined}>
 {error&&<p role="alert">{error}</p>}
 {step==='choices'?<div className={styles.optionsGrid}>{canWrite&&<button className={styles.optionActionButton} onClick={()=>setStep('log')}><AssetActionIcon action="loggedProblems" className={styles.buttonIcon}/><span><strong>Log problem</strong></span></button>}<button className={styles.optionActionButton} onClick={()=>setStep('list')}><AssetActionIcon action="history" className={styles.buttonIcon}/><span><strong>Logged problems</strong></span></button></div>:step==='log'?<label className={styles.field}><span>Describe the problem</span><textarea rows={4} maxLength={4000} value={note} onChange={event=>setNote(event.target.value)} /></label>:loading?<p>Loading logged problems…</p>:items.length?list:<p>No logged problems.</p>}
 </LeadActionDialog>}{confirmation}</>;
}
