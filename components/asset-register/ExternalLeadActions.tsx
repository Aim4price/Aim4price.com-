'use client';
import { useEffect, useState } from 'react';
import type { ExternalLeadAccess } from '../../lib/external-lead-access';
import { EXTERNAL_SHARE_OPTIONS, type ExternalSharePermission, type ExternalSharePermissions } from '../../lib/external-share-permissions';
import { buildWhatsAppShareUrl } from '../../lib/asset-external-share';
import type { LeadReport } from '../../lib/guest-leads';
import SharedAssetWorkDialog from '../leads/SharedAssetWorkDialog';
import SharedAssetContributionDialog from '../leads/SharedAssetContributionDialog';
import SharedLiveReports from './SharedLiveReports';
import ExternalAccessRequests from './ExternalAccessRequests';
import LeadDocuments from './LeadDocuments';
import leadStyles from '../../app/leads/page.module.css';
import assetStyles from '../../app/asset-register/page.module.css';
import dialogStyles from '../AccountDialog.module.css';
import styles from './ExternalLeadActions.module.css';
export type ExternalLeadActionData = {
    token: string;
    permissions: ExternalSharePermissions;
    reports: LeadReport[];
    access: ExternalLeadAccess;
    reply?: {
        email: string;
        phone: string;
        name: string;
    };
};

import DealerMaintenanceReportModal from '../DealerMaintenanceReportModal';
import DealerCostOfOwnershipReportModal from '../DealerCostOfOwnershipReportModal';
import DealerMaintenanceScheduleModal from '../DealerMaintenanceScheduleModal';
import LeadProblemCard from '../leads/LeadProblemCard';
import type { DealerMaintenanceTrackedAsset } from '../../lib/dealer-maintenance-tracker';
import DealerAssetCorrectionEditor from '../DealerAssetCorrectionEditor';
import LeadActionDialog from '../leads/LeadActionDialog';
import LeadReportDialog from '../leads/LeadReportDialog';
import { createPortal } from '../WebsitePortal';
import SharedEnquiryAccess from '../SharedEnquiryAccess';
export default function ExternalLeadActions({ token, permissions: suppliedPermissions, reports, access, reply, assetTitle, assetId, serialNumber, replacementPrice }: ExternalLeadActionData & {
  assetIndex: number; assetId?: string; assetTitle: string; serialNumber: string; replacementPrice: number | null;
}) {
  const permissions = access === 'owner' ? {...suppliedPermissions,yearModel:true,usage:true,condition:true,addMaintenance:true,addPhotos:true,addCosts:true,serialNumber:true,replacementPrice:true,maintenanceSchedules:true,directUpdates:true} : suppliedPermissions;
  const [action, setAction] = useState<ExternalSharePermission | 'access' | 'history' | null>(null);
  const [liveAsset,setLiveAsset] = useState<DealerMaintenanceTrackedAsset | null>(null);
  const [loadError,setLoadError] = useState('');
  useEffect(()=>{
    if(action !== 'loggedProblems' || !assetId || !['active','read-only','owner'].includes(access)) return;
    const controller = new AbortController(); setLiveAsset(null);setLoadError('');
    fetch(`/api/asset-share-links/${token}/assets/${assetId}`,{cache:'no-store',signal:controller.signal})
      .then(async response=>{const data=await response.json();if(!response.ok || !data.asset)throw Error(data.error || 'Could not load this asset.');setLiveAsset(data.asset);})
      .catch(error=>{if(!controller.signal.aborted)setLoadError(error.message);});
    return ()=>controller.abort();
  },[action,assetId,token,access]);
  const sharedAsset = assetId ? {token,assetId} : undefined;
  const canRead = ['active','read-only','owner'].includes(access);
  const canCorrect = ['active','owner'].includes(access) && Boolean(assetId);
  const allowed = access === 'active' || access === 'owner' || (access === 'read-only' && ['reports','loggedProblems','maintenanceReports','costOfOwnership'].includes(action || ''));
  const close = () => setAction(null);
  const actionClassName = `${assetStyles.optionActionButton} ${assetStyles.ownerCommandAction}`;
  const title = action === 'access' ? 'Recipient access' : EXTERNAL_SHARE_OPTIONS.find(option => option.key === action)?.label || 'Manage enquiry';
  return <>
    <div className={assetStyles.optionsContent}>
      <div className={`${assetStyles.optionsGrid} ${assetStyles.assetOptionsGrid} ${assetStyles.ownerCommandGrid} ${leadStyles.manageOptionsGrid} ${dialogStyles.actions}`}>
        {EXTERNAL_SHARE_OPTIONS.filter(option => !['yearModel','usage','condition'].includes(option.key) && permissions[option.key] && !(permissions.allReports && ['maintenanceReports','costOfOwnership'].includes(option.key)) && !(canCorrect && ['serialNumber','replacementPrice'].includes(option.key))).map(option => <button key={option.key} type="button" className={actionClassName} onClick={() => setAction(option.key)}>
          <svg className={assetStyles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
          <span><strong>{option.label}</strong><small>{option.description}</small></span>
        </button>)}
        {(permissions.yearModel||permissions.usage||permissions.condition)&&<button type="button" className={actionClassName} onClick={()=>setAction('yearModel')}><span><strong>Update asset details</strong><small>Year, usage and condition.</small></span></button>}
        {canCorrect && <DealerAssetCorrectionEditor assetTitle={assetTitle} sourceType="external" sourceId={`${token}:${assetId}`} externalShare={{token, assetId: assetId!}} directUpdates={permissions.directUpdates===true} serialNumber={serialNumber} replacementPriceExVat={replacementPrice} canUpdateSerial={permissions.serialNumber} canUpdateReplacementPrice={permissions.replacementPrice} actionClassName={actionClassName} iconClassName={assetStyles.buttonIcon}/>}
        {(permissions.yearModel||permissions.usage||permissions.condition||permissions.addMaintenance)&&<button type="button" className={actionClassName} onClick={()=>setAction('history')}><span><strong>History</strong><small>View shared changes.</small></span></button>}
        {access === 'owner' && <button type="button" className={actionClassName} onClick={() => setAction('access')}><span><strong>Recipient access</strong><small>Review access requests.</small></span></button>}
      </div>
    </div>
    {reply && <div className={styles.actions}>{reply.email && <a className={styles.secondary} href={`mailto:${encodeURIComponent(reply.email)}?subject=${encodeURIComponent('Re: Aim4price asset enquiry')}`}>Email owner</a>}{reply.phone && <a className={styles.secondary} href={buildWhatsAppShareUrl({ subject: 'Asset enquiry', body: `Hello ${reply.name}, regarding your Aim4price asset enquiry.` }, reply.phone)} target="_blank" rel="noreferrer">WhatsApp owner</a>}</div>}
    {!EXTERNAL_SHARE_OPTIONS.some(option=>permissions[option.key]) && <p className={styles.hint}>The sender shared read-only asset details. No additional actions are enabled.</p>}
    {(['yearModel','usage','condition','addMaintenance','history'].includes(action||'') && ['active','owner'].includes(access) && assetId) ? createPortal(<SharedAssetWorkDialog endpoint={`/api/asset-share-links/${token}/assets/${assetId}`} action={action==='addMaintenance'?'maintenance':action==='history'?'history':'details'} assetTitle={assetTitle} onClose={close}/>,document.body) : (action === 'addPhotos' || action === 'addCosts') && ['active','owner'].includes(access) && assetId ? createPortal(<SharedAssetContributionDialog kind={action === 'addPhotos' ? 'photos' : 'costs'} endpoint={`/api/asset-share-links/${token}/assets/${assetId}/${action === 'addPhotos' ? 'photos' : 'costs'}`} assetTitle={assetTitle} onClose={close}/>,document.body) : action === 'maintenanceReports' && canRead && sharedAsset ? createPortal(<DealerMaintenanceReportModal accessId={assetId!} externalShare={sharedAsset} onClose={close}/>,document.body) : action === 'costOfOwnership' && canRead && sharedAsset ? createPortal(<DealerCostOfOwnershipReportModal accessId={assetId!} externalShare={sharedAsset} assetTitle={assetTitle} assetMeta="Shared asset" onClose={close}/>,document.body) : action === 'maintenanceSchedules' && ['active','owner'].includes(access) && sharedAsset ? createPortal(<DealerMaintenanceScheduleModal accessId={assetId!} externalShare={sharedAsset} onClose={close} onAssetUpdated={()=>close()}/>,document.body) : action && createPortal(action === 'reports' && allowed && permissions.allReports && assetId ? <SharedLiveReports token={token} assetId={assetId} assetTitle={assetTitle} onClose={close}/> : action === 'reports' && allowed ? <LeadReportDialog title={assetTitle} description="Shared reports" onClose={close}>
      {reports.map(report => <a className={assetStyles.assetReportOptionButton} data-download-option="true" key={report.id} href={`/api/asset-share-links/${token}/reports/${report.id}`} target="_blank" rel="noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></svg><span><strong>{report.label}</strong><small>Open shared report</small></span></a>)}
      {!reports.length && <p>No reports were attached.</p>}
    </LeadReportDialog> : <LeadActionDialog title={title} assetTitle={assetTitle} onClose={close}>
      {action === 'access' && access === 'owner' ? <ExternalAccessRequests token={token}/> : !allowed && access === 'read-only' ? <div className={styles.gate}><p>Verify your business to send documents or proposed updates.</p><a className={styles.primary} href={`/business?details=1&returnTo=${encodeURIComponent(`/asset-share/${token}?open=1`)}`}>Verify business</a></div> : !allowed ? <SharedEnquiryAccess returnTo={`/asset-share/${token}?open=1`} access={access} embedded/> : action === 'loggedProblems' ? <>{loadError ? <p role="alert">{loadError}</p> : !liveAsset ? <p>Loading current problems…</p> : liveAsset.loggedProblems.length ? liveAsset.loggedProblems.map(problem=><LeadProblemCard key={problem.id} problem={problem}/>) : <p>No logged problems.</p>}</> : action === 'documents' ? <LeadDocuments embedded token={token} owner={access === 'owner'}/> : <p className={styles.hint}>{permissions.directUpdates ? 'The approved recipient can save this change directly to your live asset.' : 'The recipient sends proposed changes from this action. You review them in your asset register before the asset changes.'}</p>}
    </LeadActionDialog>, document.body)}
  </>;
}
