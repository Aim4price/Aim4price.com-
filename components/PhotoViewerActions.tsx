'use client';
import { useState } from 'react';
import styles from './PhotoViewerActions.module.css';

function PhotoActionIcon({action}:{action:'download'|'open'|'edit'|'delete'}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {action==='download'?<><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M4 16v5h16v-5"/></>:action==='open'?<><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/><path d="m3 3 6 6m12-6-6 6M3 21l6-6m12 6-6-6"/></>:action==='edit'?<><path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m13 6 5 5"/></>:<><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>}
  </svg>;
}

/** Actions use the same authorised URL as the viewer; owner mutations are opt-in. */
export default function PhotoViewerActions({url,title,onEdit,onDelete}:{url:string;title:string;onEdit?:()=>void;onDelete?:()=>Promise<void>}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
  async function download() {
    setBusy(true);setError('');
    try {
      const source=new URL(url,window.location.href);
      if(source.origin===window.location.origin && source.pathname.startsWith('/api/asset-register/uploads/'))source.searchParams.set('share','1');
      const response=await fetch(source.href,{credentials:source.origin===window.location.origin?'include':'omit',signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw Error('Photo download failed. Please retry.');
      const blob=await response.blob();
      if(!blob.size || !blob.type.startsWith('image/'))throw Error('The photo could not be downloaded. Open the full photo to save it instead.');
      const href=URL.createObjectURL(blob),link=document.createElement('a');
      const extension=blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg';
      link.href=href;link.download=`${title.replace(/[^a-zA-Z0-9-]/g,'-').slice(0,100)||'asset-photo'}.${extension}`;
      document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);
    } catch {setError('Download unavailable. Retry, or open the full photo and save it from there.');} finally {setBusy(false);}
  }
  return <div className={styles.actions} onClick={event=>event.stopPropagation()}>
    <button className={styles.download} type="button" disabled={busy} onClick={()=>void download()}><PhotoActionIcon action="download"/><span>{busy?'Working…':'Download'}</span></button>
    <a className={styles.open} href={url} target="_blank" rel="noopener noreferrer"><PhotoActionIcon action="open"/><span>Open full photo</span></a>
    {onEdit&&<button className={styles.edit} type="button" disabled={busy} onClick={onEdit}><PhotoActionIcon action="edit"/><span>Edit photos</span></button>}
    {onDelete&&<button className={styles.remove} type="button" disabled={busy} onClick={()=>setConfirm(true)}><PhotoActionIcon action="delete"/><span>Delete photo</span></button>}
    {confirm&&onDelete&&<div className={styles.confirm}><span>Remove this photo from the asset?</span><button className={styles.remove} type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onDelete();setConfirm(false);}catch{setError('Photo could not be removed. Please retry.');}finally{setBusy(false);}}}>Confirm delete</button><button type="button" disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button></div>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
