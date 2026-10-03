'use client';
import type { ExternalSharePermissions } from '../../lib/external-share-permissions';
import { useState } from 'react';
import LeadReportDialog from '../leads/LeadReportDialog';
import DealerMaintenanceReportModal from '../DealerMaintenanceReportModal';
import DealerCostOfOwnershipReportModal from '../DealerCostOfOwnershipReportModal';
import ReportDownloadFlow from '../ReportDownloadFlow';
import { openCanonicalReportUrl, downloadCanonicalReportFile } from '../../lib/report-open';
import styles from '../../app/asset-register/page.module.css';

const reports = [
  {key:'valuation',label:'Asset valuation',description:'Current asset details and value.'},
  {key:'maintenance',label:'Maintenance report',description:'Maintenance records and schedules.'},
  {key:'fuel',label:'Fuel report',description:'Fuel usage and costs.'},
  {key:'depreciation',label:'Depreciation log',description:'Recorded asset value changes.'},
  {key:'cost',label:'Cost of ownership',description:'Ownership costs and VAT.'},
  {key:'map',label:'Asset map',description:'Saved asset locations.'},
] as const;
type Report = typeof reports[number]['key'];

export default function SharedLiveReports({token,assetId,assetTitle,onClose,permissions}:{permissions:ExternalSharePermissions;token:string;assetId:string;assetTitle:string;onClose:()=>void}) {
  const [selected,setSelected]=useState<Report|null>(null);
  const back=()=>setSelected(null);
  const externalShare={token,assetId};
  if(selected==='maintenance') return <DealerMaintenanceReportModal accessId={assetId} externalShare={externalShare} onBack={back} onClose={onClose}/>;
  if(selected==='cost') return <DealerCostOfOwnershipReportModal accessId={assetId} externalShare={externalShare} assetTitle={assetTitle} assetMeta="Live asset report" onBack={back} onClose={onClose}/>;
  if(selected) return <ReportDownloadFlow title={reports.find(report=>report.key===selected)!.label} allLabel={assetTitle} assets={[{id:assetId,title:assetTitle}]} lockedAssetId={assetId} skipTimeline={selected==='valuation'||selected==='map'} onClose={back} onDownload={async selection=>{
    const params=new URLSearchParams({shareToken:token,format:selection.format==='pdf' ? (selected==='map'?'pdf':'html') : 'xlsx'});
    let path:string;
    if(selected==='valuation'){path='/api/asset-register/export';params.set('assetIds',assetId);}
    else {params.set('assetId',assetId);path=selected==='map'?'/api/asset-map/report':'/api/asset-register/scan-report';if(selected!=='map')params.set('report',selected);}
    if(!['valuation','map'].includes(selected) && selection.year!=='all'){params.set('year',selection.year);if(selection.month!=='all')params.set('month',selection.month);}
    const url=`${path}?${params}`;
    if(selection.format==='pdf'){if(!openCanonicalReportUrl(url))throw Error('Enable pop-ups to open this report.');}
    else await downloadCanonicalReportFile(url);
  }}/>;
  return <LeadReportDialog title={assetTitle} description="Shared reports · latest asset information" onClose={onClose}>
    {reports.filter(report => report.key === 'maintenance' ? permissions.maintenanceReports : report.key === 'cost' ? permissions.costOfOwnership : true).map(report=><button key={report.key} type="button" className={styles.assetReportOptionButton} data-download-option="true" onClick={()=>setSelected(report.key)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></svg>
      <span><strong>{report.label}</strong><small>{report.description}</small></span>
    </button>)}
  </LeadReportDialog>;
}
