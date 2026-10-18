'use client';
import {useEffect,useId,useRef,useState} from 'react';
import CreateAssetRegisterModal, { type RegisterDetailsDraft } from './CreateAssetRegisterModal';
import styles from './MoveAssetDestinationPicker.module.css';

type Option={value:string;label:string;description?:string};
export default function AddAssetRegisterPicker({options,targetId,onSelect,onClose,onContinue,onCreate,busy}:{options:Option[];targetId:string;onSelect:(id:string)=>void;onClose:()=>void;onContinue:()=>void;onCreate:(details:RegisterDetailsDraft)=>Promise<void>;busy:boolean}){
 const id=useId(),dialog=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);
 const [search,setSearch]=useState(''),[creating,setCreating]=useState(false),[draft,setDraft]=useState<RegisterDetailsDraft>({businessName:'',email:'',phone:'',addressLine1:''}),[error,setError]=useState('');
 const selected=options.find(option=>option.value===targetId);
 const visible=options.filter(option=>`${option.label} ${option.description||''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;return()=>{if(previous?.isConnected)previous.focus();};},[]);
 useEffect(()=>{input.current?.focus();},[creating]);
 async function create(){if(busy||!draft.businessName.trim())return;setError('');try{await onCreate({...draft,businessName:draft.businessName.trim()});setCreating(false);setDraft({businessName:'',email:'',phone:'',addressLine1:''});setSearch('');}catch(e){setError(e instanceof Error?e.message:'Could not create the register.');}}
 if(creating) return <CreateAssetRegisterModal draft={draft} onChange={setDraft} onSubmit={event=>{event.preventDefault();void create();}} onClose={()=>{if(!busy){setCreating(false);setError('');}}} busy={busy} error={error}/>;
 return <div className={styles.overlay} data-website-overlay data-account-asset-modal>
  <div className={styles.backdrop} onClick={()=>{if(!busy)onClose();}}/>
  <div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={id} aria-busy={busy} onKeyDown={event=>{
   if(event.key==='Escape'){event.stopPropagation();if(!busy){if(creating){setCreating(false);setError('');}else onClose();}return;}
   if(event.key!=='Tab')return;const nodes=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')||[]);const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }}>
   <header className={styles.header}><div><h3 id={id} className={styles.assetName}>Choose asset register</h3><p className={styles.assetDetails}>Where should this asset be saved?</p></div><button type="button" className={styles.close} onClick={onClose} disabled={busy} aria-label="Close register selection">×</button></header>
   <div className={`${styles.body} ${styles.pickerBody} ${styles.addRegisterBody}`}>
    <button type="button" className={styles.option} onClick={()=>{setCreating(true);setError('');}}><span className={styles.optionCopy}><strong>Add Register</strong><small>Create a new asset register.</small></span><span className={styles.selection} aria-hidden="true">＋ Add</span></button>
    <div className={styles.listHeading}><h4>Available asset registers</h4><span>{visible.length} available</span></div>
    <div className={styles.searchWrap}><svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input ref={input} className={styles.search} type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search asset registers..." aria-label="Search asset registers"/></div>
    <div className={styles.options} role="group" aria-label="Available asset registers">{visible.map(option=><button key={option.value} type="button" className={styles.option} aria-pressed={targetId===option.value} onClick={()=>onSelect(option.value)}><span className={styles.optionCopy}><strong>{option.label}</strong><small>{option.description}</small></span><span className={styles.selection} aria-hidden="true">{targetId===option.value?'Selected':'Select'}</span></button>)}{!visible.length?<div className={styles.empty}>{search?'No registers match your search.':'Add your first register to continue.'}</div>:null}</div>
   </div>
   <footer className={styles.footer}><div className={styles.confirmation} aria-live="polite">{selected?<><span>Selected asset register</span><strong>{selected.label}</strong></>:<span>Select a register to continue.</span>}</div><div className={styles.actions}><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className={styles.primary} disabled={!selected} onClick={onContinue}>Continue</button></div></footer>
  </div>
 </div>;
}
