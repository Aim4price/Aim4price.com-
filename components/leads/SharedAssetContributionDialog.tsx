'use client';
import SharedOwnerCostDialog from './SharedOwnerCostDialog';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LeadActionDialog from './LeadActionDialog';
import styles from './SharedAssetContributionDialog.module.css';
function SharedAssetPhotoDialog({kind,endpoint,assetTitle,onClose,onSaved}:{kind:'photos'|'costs';endpoint:string;assetTitle:string;onClose:()=>void;onSaved?:()=>void}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  const [requestId]=useState(()=>crypto.randomUUID());
  const [files,setFiles]=useState<File[]>([]);
  const [previews,setPreviews]=useState<string[]>([]);
  useEffect(()=>{const urls=files.map(file=>URL.createObjectURL(file));setPreviews(urls);return()=>urls.forEach(url=>URL.revokeObjectURL(url));},[files]);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy||saved)return;setBusy(true);setError('');
    const form=new FormData(event.currentTarget);form.set('requestId',requestId);
    form.delete('files');files.forEach(file=>form.append('files',file));
    try{const response=await fetch(endpoint,{method:'POST',body:form});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save. Please try again.');setSaved(true);router.refresh();onSaved?.();}
    catch(error){setError(error instanceof Error?error.message:'Could not save.');}finally{setBusy(false);}
  }
  return <LeadActionDialog title="Add photos" assetTitle={assetTitle} onClose={onClose} busy={busy}>
    {saved?<div className={styles.success} role="status"><strong>Photos added</strong><p>The owner’s asset has been updated.</p><button type="button" onClick={onClose}>Done</button></div>:<form className={styles.form} onSubmit={submit}>
      <p className={styles.hint}>Add photos to this asset. Existing photos stay in place.</p>
      <label className={styles.upload}>Choose photos<input type="file" name="files" accept="image/jpeg,image/png,image/webp" multiple required onChange={event=>setFiles(Array.from(event.target.files||[]))}/><small>JPG, PNG or WEBP · 5 MB each · up to 12 photos per asset</small></label>
      {previews.length>0&&<div className={styles.previews}>{previews.map((url,index)=><img key={url} src={url} alt={files[index]?.name||'Selected photo'}/>)}</div>}
      {error&&<p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy?'Saving…':'Add photos'}</button></div>
    </form>}
  </LeadActionDialog>;
}

export default function SharedAssetContributionDialog(props: Parameters<typeof SharedAssetPhotoDialog>[0]) {
  return props.kind === 'costs' ? <SharedOwnerCostDialog {...props}/> : <SharedAssetPhotoDialog {...props}/>;
}
