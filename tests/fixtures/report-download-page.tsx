'use client';
import { useSearchParams } from 'next/navigation';
import Costs from '../../app/my-invoices/my-invoices-client';
import Maintenance from '../../app/maintenance/maintenance-client';
import Register from '../../app/asset-register/asset-register-client';
import Registers from '../../app/asset-registers/asset-registers-client';
import Leads from '../../app/leads/leads-client';
import Map from '../../app/asset-map/asset-map-client';
import Fuel from '../../app/fuel/fuel-client';
import DealerCosts from '../../components/DealerCostOfOwnershipReportModal';
import DealerMaintenance from '../../components/DealerMaintenanceReportModal';
import Accountant from '../../components/AccountantRegisterReportsModal';
import Group from '../../components/asset-register/AssetGroupManagerModal';
import ShareDestination from '../../components/asset-register/ShareDestinationDialog';
import InsideShare from '../../components/asset-register/InsideShareDialog';
import ReportIcon from '../../components/asset-register/AssetReportTypeIcon';
import OwnerReports from '../../app/owner-app/assets/[assetId]/owner-asset-report-picker';
import mapStyles from '../../app/asset-map/page.module.css';
import accountStyles from '../../app/account/page.module.css';
const noop = () => {};
const asset = {id:'1',registerId:null,title:'Test tractor',kind:'tractor',value:1000,createdAtIso:'2026-09-01',updatedAtIso:'2026-09-01',lastScannedAtIso:null};
export default function ReportDownloadPage() {
 const mode = useSearchParams().get('mode');
 if (mode === 'reference') return <div className={`${mapStyles.modalBackdrop} ${mapStyles.accountExportBackdrop}`} data-website-overlay><section className={`${mapStyles.exportModal} ${mapStyles.accountExportModal} ${accountStyles.modalTheme}`} data-original-report>
   <header className={mapStyles.exportModalHeader}><div><h2>Export Asset Map Tracking</h2></div><button className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`}>×</button></header>
   <div className={mapStyles.exportChoices}>{(['pdf','xlsx'] as const).map(format=><button key={format} className={`${mapStyles.exportOption} ${format==='pdf'?mapStyles.exportOptionActive:''}`} aria-pressed={format==='pdf'}><span className={mapStyles.exportGraphic}><img className={mapStyles.exportGraphicImage} src={format==='pdf'?'/brand/pdf.png':'/brand/sheet.png'} alt=""/></span><span className={mapStyles.exportOptionTitleBlock}><strong>{format==='pdf'?'PDF map report':'XLSX GPS workbook'}</strong><small>Download a printable report or Excel workbook.</small></span></button>)}</div>
   <div className={mapStyles.exportActions}><button className={`${mapStyles.secondaryAction} ${mapStyles.exportSecondaryButton}`}>Cancel</button></div>
 </section></div>;
 if (mode==='leads') return <Leads initialSessionUserId="test" initialLeads={[{id:'lead',ownerUserId:'owner',partnerUserId:'test',assetRegisterItemId:'1',leadType:'finance' as const,status:'viewed' as const,assetSnapshot:{title:'Test tractor',kind:'tractor',specsJson:{},value:1000},includedSections:{},ownerMessage:'',ownerContactName:'Test owner',ownerContactPhone:'',ownerContactEmail:'',ownerName:'Test owner',ownerBusinessName:'',ownerEmail:'',ownerPhone:'',ownerProvince:'',ownerTownCity:'',partnerName:'Test dealer',partnerBusinessName:'',partnerPhone:'',partnerProvince:'',partnerTownCity:'',createdAtIso:'2026-09-01',updatedAtIso:'2026-09-01',viewedAtIso:'2026-09-01',acceptedAtIso:null,quotedAtIso:null,declinedAtIso:null,closedAtIso:null}]} />;
 if (mode==='dealer-costs') return <DealerCosts accessId="test" assetTitle="Test tractor" assetMeta="2023" onClose={noop} />;
 if (mode==='dealer-maintenance') return <DealerMaintenance accessId="test" onClose={noop} />;
 if (mode==='accountant') return <Accountant shareId="test" registerName="Test register" includeCostLedger includeFuelLedger onClose={noop} />;
 if (mode==='group' || mode==='group-menu') return <Group open initialView={mode==='group-menu'?'menu':'reports'} anchorAsset={asset} group={{id:'test',userId:'test',registerId:null,name:'Test umbrella',valueMode:'separate',members:[{assetId:'1',role:'primary',relationship:'primary',countsTowardTotal:true,sortOrder:0}],createdAtIso:'2026-09-01',updatedAtIso:'2026-09-01'}} assets={[asset]} groups={[]} onClose={noop} onSave={noop} onDelete={noop} onDownloadReport={noop} onDownloadMap={noop} canDownloadMap={false} />;
 if (mode==='share-destination') return <ShareDestination kind="umbrella" titleId="share-fixture" subject="Test umbrella" onClose={noop} onInside={noop} onOutside={noop} />;
 if (mode==='share-inside') return <InsideShare titleId="inside-fixture" subject="Test umbrella" onClose={noop} options={[
  {id:'finance',title:'Finance & accounting',description:'Accountant, financier or bank',icon:<ReportIcon kind="ownership"/>,onSelect:noop},
  {id:'insurance',title:'Insurance',description:'Insurer or broker',icon:<ReportIcon kind="valuation"/>,onSelect:noop},
  {id:'replacement_quote',title:'Dealer',description:'Share grouped assets',icon:<ReportIcon kind="maintenance"/>,onSelect:noop},
  {id:'license_renewal',title:'Licence renewal',description:'Renewal date required',icon:<ReportIcon kind="valuation"/>,onSelect:noop},
 ]} />;
 if (mode==='owner-open') return <OwnerReports asset={asset} />;
 if (mode==='owner') return <OwnerReports asset={asset} mode="attach" onDismiss={noop} onAttach={noop} />;
 if (mode==='maintenance') return <Maintenance />;
 if (mode==='register') return <Register />;
 if (mode==='registers') return <Registers />;
 if (mode==='map') return <Map />;
 if (mode==='fuel') return <Fuel addedByLabel="Test owner" />;
 return <Costs budgetsPage={mode==='budgets'} />;
}
