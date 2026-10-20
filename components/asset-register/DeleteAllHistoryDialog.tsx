'use client';
import {useState} from 'react';
import AssetAccessSettingsDialog from './AssetAccessSettingsDialog';
import styles from './AssetLocationHistoryDialog.module.css';

export function HistoryDeleteIcon(){
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg>;
}

export default function DeleteAllHistoryDialog({title,kind,endpoint,snapshotAt,onClose,onDeleted}:{title:string;kind:'locations'|'tracking';endpoint:string;snapshotAt:string;onClose:()=>void;onDeleted:()=>void}){
 const [deleting,setDeleting]=useState(false),[error,setError]=useState('');
 const label=kind==='tracking'?'tracking history':'saved locations';
 async function confirm(){
  if(deleting)return;
  setDeleting(true);setError('');
  try{
   const response=await fetch(`${endpoint}?${new URLSearchParams({scope:'all',snapshotAt})}`,{method:'DELETE'});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Could not delete history. Please try again.');
   onDeleted();
  }catch(e){setError(e instanceof Error?e.message:'Please try again.');setDeleting(false);}
 }
 return <AssetAccessSettingsDialog locationLayout title={`Delete all ${label}?`} assetTitle={title} onClose={()=>{if(!deleting)onClose();}}>
  <div className={styles.deleteConfirm}>
   <span className={styles.deleteIcon}><HistoryDeleteIcon/></span>
   <strong>Clear all {label} for this asset?</strong>
   <div className={styles.deleteRecord}><strong>All dates · All entries</strong><span>Includes records outside the current filter.</span></div>
   <p>They will be removed from this history and its reports. This cannot be undone here.</p>
   <p>The current map position, {kind==='tracking'?'connected phone and saved locations':'tracking and other activity'} stay unchanged.<br/>Records received since you loaded history are kept.</p>
   {error&&<p role="alert" className={styles.deleteError}>{error}</p>}
   <div className={styles.confirmActions}><button type="button" disabled={deleting} onClick={onClose}>Cancel</button><button type="button" className={styles.deleteButton} disabled={deleting} onClick={()=>void confirm()}>{deleting?'Deleting…':'Delete all'}</button></div>
  </div>
 </AssetAccessSettingsDialog>;
}
