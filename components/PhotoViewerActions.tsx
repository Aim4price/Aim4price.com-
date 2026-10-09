'use client';
import { useState } from 'react';
import styles from './PhotoViewerActions.module.css';

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
    <button type="button" disabled={busy} onClick={()=>void download()}>{busy?'Working…':'Download'}</button>
    <a href={url} target="_blank" rel="noopener noreferrer">Open full photo</a>
    {onEdit&&<button type="button" disabled={busy} onClick={onEdit}>Edit photos</button>}
    {onDelete&&<button type="button" disabled={busy} onClick={()=>setConfirm(true)}>Delete photo</button>}
    {confirm&&onDelete&&<div className={styles.confirm}><span>Remove this photo from the asset?</span><button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onDelete();setConfirm(false);}catch{setError('Photo could not be removed. Please retry.');}finally{setBusy(false);}}}>Confirm delete</button><button type="button" disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button></div>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
