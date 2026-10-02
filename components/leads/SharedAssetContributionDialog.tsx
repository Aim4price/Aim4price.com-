'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LeadActionDialog from './LeadActionDialog';
import styles from './SharedAssetContributionDialog.module.css';
export default function SharedAssetContributionDialog({kind,endpoint,assetTitle,onClose,onSaved}:{kind:'photos'|'costs';endpoint:string;assetTitle:string;onClose:()=>void;onSaved?:()=>void}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  const [requestId]=useState(()=>crypto.randomUUID());
  const [files,setFiles]=useState<File[]>([]);
  const [previews,setPreviews]=useState<string[]>([]);
  useEffect(()=>{const urls=kind==='photos'?files.map(file=>URL.createObjectURL(file)):[];setPreviews(urls);return()=>urls.forEach(url=>URL.revokeObjectURL(url));},[files,kind]);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy||saved)return;setBusy(true);setError('');
    const form=new FormData(event.currentTarget);form.set('requestId',requestId);
    if(kind==='photos'){form.delete('files');files.forEach(file=>form.append('files',file));}
    try{const response=await fetch(endpoint,{method:'POST',body:form});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save. Please try again.');setSaved(true);router.refresh();onSaved?.();}
    catch(error){setError(error instanceof Error?error.message:'Could not save.');}finally{setBusy(false);}
  }
  return <LeadActionDialog title={kind==='photos'?'Add photos':'Add cost'} assetTitle={assetTitle} onClose={onClose} busy={busy}>
    {saved?<div className={styles.success} role="status"><strong>{kind==='photos'?'Photos added':'Cost saved'}</strong><p>The owner’s asset has been updated.</p><button type="button" onClick={onClose}>Done</button></div>:<form className={styles.form} onSubmit={submit}>
      <p className={styles.hint}>{kind==='photos'?'Add photos to this asset. Existing photos stay in place.':'Save this expense directly to the asset’s cost of ownership.'}</p>
      {kind==='costs'&&<>
        <div className={styles.grid}><label>Date<input required type="date" name="date" defaultValue={new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'})}/></label><label>Category<select name="category"><option value="maintenance">Maintenance</option><option value="parts">Parts</option><option value="repair">Repair</option><option value="other">Other</option></select></label></div>
        <label>Description<input required name="description" maxLength={4000} placeholder="What was done or supplied?"/></label>
        <div className={styles.grid}><label>Amount excl. VAT (R)<input required name="amount" type="number" min="0.01" step="0.01"/></label><label>VAT amount (R)<input required name="vat" type="number" min="0" step="0.01" defaultValue="0"/></label></div>
        <div className={styles.grid}><label>Supplier (optional)<input name="supplier" maxLength={200}/></label><label>Invoice number (optional)<input name="invoiceNumber" maxLength={100}/></label></div>
      </>}
      <label className={styles.upload}>{kind==='photos'?'Choose photos':'Supporting document (optional)'}<input type="file" name={kind==='photos'?'files':'file'} accept={kind==='photos'?'image/jpeg,image/png,image/webp':'application/pdf,image/jpeg,image/png,image/webp'} multiple={kind==='photos'} required={kind==='photos'} onChange={event=>setFiles(Array.from(event.target.files||[]))}/><small>{kind==='photos'?'JPG, PNG or WEBP · 5 MB each · up to 12 photos per asset':'PDF, JPG, PNG or WEBP · up to 5 MB'}</small></label>
      {previews.length>0&&<div className={styles.previews}>{previews.map((url,index)=><img key={url} src={url} alt={files[index]?.name||'Selected photo'}/>)}</div>}
      {error&&<p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy?'Saving…':kind==='photos'?'Add photos':'Save cost'}</button></div>
    </form>}
  </LeadActionDialog>;
}
