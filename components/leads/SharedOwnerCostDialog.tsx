'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { AssetOption } from '../../app/my-invoices/my-invoices-client';
import LeadActionDialog from './LeadActionDialog';
import styles from './SharedAssetContributionDialog.module.css';
const OwnerCostWizard = dynamic(()=>import('../../app/my-invoices/my-invoices-client'),{ssr:false});
export default function SharedOwnerCostDialog({endpoint,assetTitle,onClose,onSaved}:{endpoint:string;assetTitle:string;onClose:()=>void;onSaved?:()=>void}) {
  const router=useRouter();
  const [asset,setAsset]=useState<AssetOption|null>(null);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [requestId]=useState(()=>crypto.randomUUID());
  useEffect(()=>{const controller=new AbortController();fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Could not open this asset.');setAsset(data.asset);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[endpoint]);
  async function send(path:string,form:FormData) {
    form.set('requestId',requestId);
    const response=await fetch(path,{method:'POST',body:form});const data=await response.json();
    if(!response.ok)throw Error(data.code==='CAPTURE_DAILY_LIMIT'?data.code:data.error||'Could not save. Please try again.');
    return data;
  }
  function saved(text:string){setMessage(text);router.refresh();onSaved?.();}
  if(!asset||message)return <LeadActionDialog title="Add asset cost" assetTitle={assetTitle} onClose={onClose}><div className={styles.success}>{error?<p role="alert">{error}</p>:message?<><p role="status">{message}</p><button type="button" onClick={onClose}>Done</button></>:<p role="status">Loading cost options…</p>}</div></LeadActionDialog>;
  return <Suspense fallback={null}><OwnerCostWizard initialAssetId={asset.id} initialOpenAdd sharedFlow={{asset,allowanceEndpoint:`${endpoint}/allowance`,onClose,onSaved:saved,
    save:async(draft,file)=>{const form=new FormData();form.set('draft',JSON.stringify(draft));if(file)form.set('file',file);await send(endpoint,form);},
    capture:async(file,note)=>{const form=new FormData();form.set('file',file);form.set('note',note);return (await send(`${endpoint}/capture`,form)).request;},
  }}/></Suspense>;
}
