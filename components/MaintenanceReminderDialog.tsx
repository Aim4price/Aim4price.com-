'use client';
import {useCallback,useEffect,useState} from 'react';
import LeadActionDialog from './leads/LeadActionDialog';
import DesktopServiceModal from './DesktopServiceModal';
import type {AssetMaintenanceRecord} from '../lib/asset-maintenance';
import styles from '../app/asset-register/page.module.css';
import local from './MaintenanceReminderDialog.module.css';
import SharedEnquiryAccess from './SharedEnquiryAccess';
export default function MaintenanceReminderDialog({id}:{id:string}){
 const [data,setData]=useState<{record:AssetMaintenanceRecord;scheduledBy:string;canComplete:boolean}|null>(null),[error,setError]=useState(''),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[signIn,setSignIn]=useState(false);
 const endpoint=`/api/maintenance-reminders/${id}`;
 const refresh=useCallback(async()=>{const r=await fetch(endpoint,{cache:'no-store'}),d=await r.json();if(r.status===401){setSignIn(true);return;}if(!r.ok)throw Error(d.error);setData(d);setError('');if(d.record.status!=='upcoming')setEditing(false);},[endpoint]);
 useEffect(()=>{void refresh().catch(e=>setError(e.message));const update=()=>void refresh().catch(e=>setError(e.message));window.addEventListener('focus',update);return()=>window.removeEventListener('focus',update);},[refresh]);
 const close=()=>{window.location.href='/';};
 if(signIn)return <LeadActionDialog title="Oops, we need you to sign in." assetTitle="Maintenance reminder" onClose={close}><SharedEnquiryAccess returnTo={`/maintenance-reminder/${id}`} access="sign-in" embedded/></LeadActionDialog>;
 if(editing&&data)return <DesktopServiceModal record={data.record} checklistEndpoint={`${endpoint}?checklist=1`} busy={busy} onClose={()=>setEditing(false)} onBack={()=>setEditing(false)} onSubmit={async completion=>{setBusy(true);try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(completion)});const d=await r.json();if(!r.ok){await refresh();throw Error(d.error);}await refresh();setEditing(false);}finally{setBusy(false);}}}/>;
 const r=data?.record;
 return <LeadActionDialog className={local.dialog} title={r?.status==='done'?'Already completed':r?.status==='cancelled'?'Maintenance cancelled':'Upcoming maintenance'} assetTitle={r?.assetTitle||'Maintenance reminder'} assetSubtitle={r?.assetMeta} onClose={close} footer={r?.status==='upcoming'&&data?.canComplete?<div className={local.footer}><button className={styles.primaryButton} onClick={()=>setEditing(true)}>{r.maintenanceType==='checkup'?'Complete check-up':'Complete service'}</button></div>:undefined}>
 <div className={local.body}>{error?<p role="alert">{error}</p>:!r?<p>Loading maintenance…</p>:<><h3>{r.title}</h3><p>{data?.scheduledBy} scheduled this {r.maintenanceType==='checkup'?'check-up':'service'}.</p>{r.status==='upcoming'?<p>{r.triggerType==='date'?`Due ${r.dueDate}`:`Due at ${r.dueUsage?.toLocaleString('en-ZA')} ${r.usageMetric}`} · {r.computedStatusLabel}</p>:<p role="status">{r.status==='done'?`This work has already been completed${r.completedBy?` by ${r.completedBy}`:''}.`:'This schedule has been cancelled. No further reminders will be sent.'}</p>}{r.status==='upcoming'&&!data?.canComplete&&<p>The owner has not enabled recording completed work for your account.</p>}</>}
 </div></LeadActionDialog>;
}
