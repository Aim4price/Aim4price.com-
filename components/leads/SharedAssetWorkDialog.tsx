'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import SharedAssetUpdateDialog,{type SharedUpdateField} from './SharedAssetUpdateDialog';
import MaintenanceEntryChoice from '../MaintenanceEntryChoice';
import DesktopServiceModal from '../DesktopServiceModal';
import LeadActionDialog from './LeadActionDialog';
import styles from './SharedAssetWorkDialog.module.css';
import type {AssetOption} from '../../app/my-invoices/my-invoices-client';
import type {MaintenanceIdentity} from '../../lib/maintenance-catalogue';

type Props={
 endpoint:string;action:'details'|'maintenance'|'history';assetTitle:string;assetSubtitle?:string;
 onClose:()=>void;onSaved?:()=>void;onSchedule?:()=>void;initialField?:SharedUpdateField;
};
export default function SharedAssetWorkDialog(props:Props){
 return props.action==='details'?<SharedAssetUpdateDialog {...props}/>:<SharedAssetWork {...props}/>;
}
function SharedAssetWork({endpoint,action,assetTitle,assetSubtitle,onClose,onSaved,onSchedule}:Props){
 const router=useRouter();
 const [asset,setAsset]=useState<(Omit<AssetOption,'usageMetric'>&{usageMetric:AssetOption['usageMetric']|'none';maintenanceIdentity?:MaintenanceIdentity})|null>(null);
 const [items,setItems]=useState<Array<{actor_name:string;created_at:string;action:string;before_data:Record<string,unknown>;after_data:Record<string,unknown>}>>([]);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
 const [type,setType]=useState<'service'|'checkup'|null>(null),[entryStep,setEntryStep]=useState<'timing'|'type'>('timing');
 const [requestId]=useState(()=>crypto.randomUUID());
 useEffect(()=>{const controller=new AbortController();fetch(`${endpoint}/${action}`,{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setAsset(d.asset||null);setItems(d.items||[]);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[endpoint,action]);
 async function save(body:Record<string,unknown>){
  setBusy(true);setError('');
  try{const r=await fetch(`${endpoint}/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,requestId})}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not save.');setSaved(true);router.refresh();onSaved?.();}
  catch(e){setError(e instanceof Error?e.message:'Please try again.');throw e;}finally{setBusy(false);}
 }
 if(action==='maintenance'&&asset&&!type&&!saved)return entryStep==='timing'
  ?<MaintenanceEntryChoice step="timing" assetTitle={asset.title} onClose={onClose} onDone={()=>setEntryStep('type')} onUpcoming={onSchedule}/>
  :<MaintenanceEntryChoice step="type" timing="done" assetTitle={asset.title} onClose={onClose} onBack={()=>setEntryStep('timing')} onType={setType}/>;
 if(action==='maintenance'&&asset&&type&&!saved)return <DesktopServiceModal checklistEndpoint={`${endpoint}/checklist`} standalone record={{id:asset.id,assetId:asset.id,assetTitle:asset.title,assetKind:asset.kind,assetCategoryLabel:asset.categoryLabel,assetYearModel:asset.yearModel,assetCondition:asset.condition,maintenanceIdentity:asset.maintenanceIdentity,maintenanceType:type,title:type==='service'?'Service or repair':'Check-up',currentUsage:asset.usageReading,usageMetric:asset.usageMetric==='none'?null:asset.usageMetric}} busy={busy} onClose={onClose} onBack={()=>setType(null)} onSubmit={completion=>save({...completion,maintenanceType:type})}/>;
 const labels:Record<string,string>={title:'Title',brand:'Brand',model:'Model',note:'Notes',yearModel:'Year',usage:'Usage',condition:'Condition'};
 return <LeadActionDialog title={action==='history'?'Asset history':'Add maintenance'} assetTitle={assetTitle} assetSubtitle={assetSubtitle} onClose={onClose} busy={busy}>
  {error&&<p role="alert">{error}</p>}
  {saved?<p role="status">Saved to the owner’s asset.</p>:action==='history'?<>
   {!items.length?<p>No shared changes recorded yet.</p>:items.map((item,index)=><article className={styles.event} key={index}><strong>{item.actor_name} · {new Date(item.created_at).toLocaleString('en-ZA')}</strong><p>{item.action}</p>{item.action==='Maintenance completed'&&<p>{String(item.after_data.title||'Maintenance')} · {String(item.after_data.date||'')}</p>}{item.action==='Document uploaded'&&<p>{String(item.after_data.title||'Asset document')}</p>}{Object.keys(labels).filter(key=>item.before_data[key]!==item.after_data[key]&&key in item.after_data).map(key=><p key={key}>{labels[key]}: {String(item.before_data[key]??'Not saved')} → {String(item.after_data[key]??'Not saved')}</p>)}</article>)}
  </>:<p>Loading asset…</p>}
 </LeadActionDialog>;
}
