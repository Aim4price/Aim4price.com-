'use client';
import AssetHistoryDialog from '../asset-register/AssetHistoryDialog';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import SharedAssetUpdateDialog,{type SharedUpdateField} from './SharedAssetUpdateDialog';
import MaintenanceEntryChoice from '../MaintenanceEntryChoice';
import DesktopServiceModal from '../DesktopServiceModal';
import LeadActionDialog from './LeadActionDialog';
import type {AssetOption} from '../../app/my-invoices/my-invoices-client';
import type {MaintenanceIdentity} from '../../lib/maintenance-catalogue';

type Props={
 endpoint:string;action:'details'|'maintenance'|'history';assetTitle:string;assetSubtitle?:string;
 onClose:()=>void;onSaved?:()=>void;onSchedule?:()=>void;initialField?:SharedUpdateField;
};
export default function SharedAssetWorkDialog(props:Props){
 if(props.action==='history')return <AssetHistoryDialog {...props}/>;
 return props.action==='details'?<SharedAssetUpdateDialog {...props}/>:<SharedAssetWork {...props}/>;
}
function SharedAssetWork({endpoint,action,assetTitle,assetSubtitle,onClose,onSaved,onSchedule}:Props){
 const router=useRouter();
 const [asset,setAsset]=useState<(Omit<AssetOption,'usageMetric'>&{usageMetric:AssetOption['usageMetric']|'none';maintenanceIdentity?:MaintenanceIdentity})|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
 const [type,setType]=useState<'service'|'checkup'|null>(null),[entryStep,setEntryStep]=useState<'timing'|'type'>('timing');
 const [requestId]=useState(()=>crypto.randomUUID());
 useEffect(()=>{const controller=new AbortController();fetch(`${endpoint}/${action}`,{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setAsset(d.asset||null);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[endpoint,action]);
 async function save(body:Record<string,unknown>){
  setBusy(true);setError('');
  try{const r=await fetch(`${endpoint}/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,requestId})}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not save.');setSaved(true);router.refresh();onSaved?.();}
  catch(e){setError(e instanceof Error?e.message:'Please try again.');throw e;}finally{setBusy(false);}
 }
 if(action==='maintenance'&&asset&&!type&&!saved)return entryStep==='timing'
  ?<MaintenanceEntryChoice step="timing" assetTitle={asset.title} onClose={onClose} onDone={()=>setEntryStep('type')} onUpcoming={onSchedule}/>
  :<MaintenanceEntryChoice step="type" timing="done" assetTitle={asset.title} onClose={onClose} onBack={()=>setEntryStep('timing')} onType={setType}/>;
 if(action==='maintenance'&&asset&&type&&!saved)return <DesktopServiceModal checklistEndpoint={`${endpoint}/checklist`} standalone record={{id:asset.id,assetId:asset.id,assetTitle:asset.title,assetKind:asset.kind,assetCategoryLabel:asset.categoryLabel,assetYearModel:asset.yearModel,assetCondition:asset.condition,maintenanceIdentity:asset.maintenanceIdentity,maintenanceType:type,title:type==='service'?'Service or repair':'Check-up',currentUsage:asset.usageReading,usageMetric:asset.usageMetric==='none'?null:asset.usageMetric}} busy={busy} onClose={onClose} onBack={()=>setType(null)} onSubmit={completion=>save({...completion,maintenanceType:type})}/>;
 return <LeadActionDialog title="Add maintenance" assetTitle={assetTitle} assetSubtitle={assetSubtitle} onClose={onClose} busy={busy}>
  {error&&<p role="alert">{error}</p>}
  {saved?<p role="status">Saved to the owner’s asset.</p>:<p>Loading asset…</p>}
 </LeadActionDialog>;
}
