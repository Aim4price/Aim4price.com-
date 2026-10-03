'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ExternalSharePermission, ExternalSharePermissions } from '../../lib/external-share-permissions';
import AssetActionIcon from './AssetActionIcon';
import assetStyles from '../../app/asset-register/page.module.css';
import styles from './ExternalAccessRequests.module.css';
type Overview = { requests: {user_id:string;email:string;business_name:string;status:string}[];recipientEmail:string|null;assigned:boolean;permissions:ExternalSharePermissions;allowReply:boolean };
export default function ExternalAccessRequests({token}: {token:string}) {
  const router = useRouter();
  const [overview,setOverview]=useState<Overview|null>(null);
  const [notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{const controller=new AbortController();fetch(`/api/asset-share-links/${token}/access`,{signal:controller.signal,cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to load recipient access.');if(!data.permissions||typeof data.permissions!=='object'||Array.isArray(data.permissions)||!Array.isArray(data.requests)||typeof data.assigned!=='boolean')throw Error('Link permissions could not be loaded. Close this window and try again.');if(!controller.signal.aborted)setOverview(data);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[token]);
  async function review(userId:string,decision:string) {
    setBusy(true);setNotice('');setError('');
    try {const r=await fetch(`/api/asset-share-links/${token}/access`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,decision})});const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to review access.');setOverview(current=>current?{...current,...(decision==='approved'?{assigned:true,recipientEmail:current.requests.find(row=>row.user_id===userId)?.email||null}:{}),requests:current.requests.map(row=>({...row,status:row.user_id===userId?decision:decision==='approved'&&row.status==='pending'?'rejected':row.status}))}:current);setNotice(decision==='approved'?'Recipient approved. They can use the actions shown above.':'Access request declined.');router.refresh();}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
  }
  if(!overview)return <p className={error?styles.error:undefined} role={error?'alert':'status'}>{error||'Loading link permissions…'}</p>;
  const p=overview.permissions;
  const views:Array<[ExternalSharePermission|'details',string]>=[['documents','Shared asset details']];
  if(p.reports)views.push(['reports',p.allReports?'All asset reports':'Selected reports and timelines']);
  if(p.loggedProblems)views.push(['loggedProblems','Logged problems']);
  if(p.maintenanceReports&&!p.allReports)views.push(['maintenanceReports','Maintenance reports']);
  if(p.costOfOwnership&&!p.allReports)views.push(['costOfOwnership','Cost of ownership']);
  const updates:Array<[ExternalSharePermission,string]>=[];
  if(p.yearModel)updates.push(['yearModel','Update year']);
  if(p.usage)updates.push(['usage','Update usage']);
  if(p.condition)updates.push(['condition','Update condition']);
  if(p.serialNumber)updates.push(['serialNumber',p.directUpdates?'Update serial number':'Suggest a serial number change']);
  if(p.replacementPrice)updates.push(['replacementPrice',p.directUpdates?'Update replacement price':'Suggest a replacement price change']);
  if(p.addPhotos)updates.push(['addPhotos','Add photos']);
  if(p.addCosts)updates.push(['addCosts','Add costs and supporting documents']);
  if(p.addMaintenance)updates.push(['addMaintenance','Record completed maintenance']);
  if(p.maintenanceSchedules)updates.push(['maintenanceSchedules','Create maintenance schedules']);
  if(p.documents)updates.push(['documents','Send invoices and quotes for review']);
  return <section className={styles.panel} aria-label="Recipient access">
    <div className={styles.audience}><AssetActionIcon action="access" className={styles.icon}/><div><strong>Who can open this link?</strong><p>{overview.assigned?<>The assigned recipient{overview.recipientEmail?` (${overview.recipientEmail})`:''} must sign in with their account.</>:<>Anyone with this link can sign in with an active Aim4price account. Free accounts must verify their email.</>} You can also open it as the owner.</p></div></div>
    <div className={styles.columns}><div className={styles.card}><h3>They can view</h3><ul>{views.map(([key,label])=><li key={key}><AssetActionIcon action={key}/><span>{label}</span></li>)}</ul>{overview.allowReply&&<p>They can also send you a note or quote.</p>}</div><div className={styles.card}><h3>They can add or change</h3>{updates.length?<ul>{updates.map(([key,label])=><li key={key}><AssetActionIcon action={key}/><span>{label}</span></li>)}</ul>:<p>No asset updates are enabled for this link.</p>}<p>Only the actions selected for this link are allowed.</p></div></div>
    <p className={styles.note}>These are the recipient’s permissions, even if you see more options as the owner. Your other assets and account stay private. To stop access, open Share → History in your asset register and choose Revoke access.</p>
    {overview.requests.length>0&&<div className={styles.requests}><h3>Access requests</h3>{overview.requests.map(row=><div className={styles.request} key={row.user_id}><div><strong>{row.business_name}</strong><p>{row.email}</p></div>{row.status==='pending'?<div className={styles.actions}><button className={assetStyles.primaryButton} disabled={busy} onClick={()=>void review(row.user_id,'approved')}>Approve access</button><button className={assetStyles.secondaryButton} disabled={busy} onClick={()=>void review(row.user_id,'rejected')}>Decline</button></div>:<p>{row.status==='approved'?'Access approved':'Access declined'}</p>}</div>)}</div>}
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
