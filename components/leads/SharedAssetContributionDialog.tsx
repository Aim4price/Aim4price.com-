'use client';
import SharedOwnerCostDialog from './SharedOwnerCostDialog';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import LeadActionDialog from './LeadActionDialog';
import AssetActionIcon from '../asset-register/AssetActionIcon';
import assetStyles from '../../app/asset-register/page.module.css';
import styles from './SharedAssetPhotoDialog.module.css';
function SharedAssetPhotoDialog({endpoint,assetTitle,onClose,onSaved}:{kind:'photos'|'costs';endpoint:string;assetTitle:string;onClose:()=>void;onSaved?:()=>void}) {
  const router=useRouter(), formId=useId(), picker=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  const [requestId]=useState(()=>crypto.randomUUID());
  const [files,setFiles]=useState<File[]>([]),[previews,setPreviews]=useState<string[]>([]);
  useEffect(()=>{const urls=files.map(file=>URL.createObjectURL(file));setPreviews(urls);return()=>urls.forEach(url=>URL.revokeObjectURL(url));},[files]);
  function chooseFiles(selected:File[]) {
    setError('');
    if(selected.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>5*1024*1024)){setError('Choose JPG, PNG or WEBP photos up to 5 MB each.');return;}
    const next=[...files];
    selected.forEach(file=>{if(!next.some(existing=>existing.name===file.name&&existing.size===file.size&&existing.lastModified===file.lastModified))next.push(file);});
    if(next.length>12){setError('Choose up to 12 photos. Existing photos also count towards the asset limit.');return;}
    setFiles(next);
  }
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy||saved||!files.length)return;setBusy(true);setError('');
    const form=new FormData();form.set('requestId',requestId);files.forEach(file=>form.append('files',file));
    try{const response=await fetch(endpoint,{method:'POST',body:form});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save. Please try again.');setSaved(true);router.refresh();onSaved?.();}
    catch(error){setError(error instanceof Error?error.message:'Could not save.');}finally{setBusy(false);}
  }
  return <LeadActionDialog title="Add photos" assetTitle={assetTitle} onClose={onClose} busy={busy} className={styles.modal} footer={saved?<button className={assetStyles.primaryButton} onClick={onClose}>Done</button>:<><button type="button" className={assetStyles.secondaryButton} onClick={onClose} disabled={busy}>Cancel</button><button type="submit" form={formId} className={assetStyles.primaryButton} disabled={busy||!files.length}>{busy?'Adding photos…':'Add photos'}</button></>}>
    {saved?<div className={styles.success} role="status"><span className={styles.icon}><AssetActionIcon action="addPhotos"/></span><div><strong>Photos added</strong><p className={styles.hint}>The owner’s asset has been updated.</p></div></div>:<form id={formId} className={styles.content} onSubmit={submit}>
      <p className={styles.hint}>Add photos to the live asset. Existing photos stay in place.</p>
      <input ref={picker} className={styles.input} type="file" name="files" aria-label="Choose asset photos" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={event=>{chooseFiles(Array.from(event.target.files||[]));event.target.value='';}}/>
      <button type="button" className={styles.picker} disabled={busy} onClick={()=>picker.current?.click()}><span className={styles.icon}><AssetActionIcon action="addPhotos"/></span><span className={styles.copy}><strong>{files.length?'Choose more photos':'Choose photos'}</strong><small>JPG, PNG or WEBP · 5 MB each · 12 photos per asset, including existing photos.</small></span><svg className={styles.arrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>
      {files.length>0&&<div className={styles.selection}><strong>{files.length} {files.length===1?'photo':'photos'} ready to add</strong><div className={styles.previews}>{previews.map((url,index)=><figure className={styles.preview} key={url}><img src={url} alt={files[index]?.name||'Selected photo'}/><button type="button" aria-label={`Remove ${files[index]?.name}`} disabled={busy} onClick={()=>{setFiles(current=>current.filter((_,i)=>i!==index));setError('');}}>×</button><figcaption>{files[index]?.name}</figcaption></figure>)}</div></div>}
      {error&&<p role="alert" className={styles.error}>{error}</p>}
    </form>}
  </LeadActionDialog>;
}
export default function SharedAssetContributionDialog(props: Parameters<typeof SharedAssetPhotoDialog>[0]) {
  return props.kind === 'costs' ? <SharedOwnerCostDialog {...props}/> : <SharedAssetPhotoDialog {...props}/>;
}
