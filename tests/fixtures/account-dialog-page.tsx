'use client';
// Temporary browser fixture, never a production route or connected to live accounts.
import { useEffect, useState, type ComponentProps } from 'react';
import LeadsClient from '../../app/leads/leads-client';
import { useSearchParams, usePathname } from 'next/navigation';
import dealerStyles from '../../app/dealer/dealer.module.css';
import DealerCostDecisionModal from '../../components/DealerCostDecisionModal';
import DealerAssetCorrectionEditor from '../../components/DealerAssetCorrectionEditor';
import DealerMaintenanceScheduleModal from '../../components/DealerMaintenanceScheduleModal';
import DealerMaintenanceTrackerClient from '../../components/DealerMaintenanceTrackerClient';
import { MiddlemanShowroomManager } from '../../components/MiddlemanShowroomClient';
import type { DealerMaintenanceTrackedAsset } from '../../lib/dealer-maintenance-tracker';
import type { MarketplaceListing } from '../../lib/marketplace';
import data from '../../tests/fixtures/account-dialog-data.json';
const asset = data.asset as DealerMaintenanceTrackedAsset;
const listing: MarketplaceListing = {id:'fixture-listing',sourceAssetId:'fixture-asset',title:asset.assetTitle,brandName:'Toyota',brandSlug:'toyota',modelName:'Hilux',tractorType:'field',drive:'4wd',cab:'open-station',powerKw:100,powerHp:134,horsepowerHp:134,yearModel:2023,year:2023,hours:115739,usageUnit:'km',province:'Western Cape',area:'Example town',location:'Example town',description:'Example listing',sellerName:'Example seller',sellerPhone:'',dateAdvertised:'2026-09-01',publishedAtIso:'2026-09-01T00:00:00Z',askingPriceExVat:247050,advertisedPriceExVat:247050,priceExVat:247050,price:247050,imageSrc:'/brand/Tractor.png',imageUrls:[],publishedBy:'asset-register',canManage:true};

const lead: NonNullable<NonNullable<ComponentProps<typeof LeadsClient>>['initialLeads']>[number] = {
  id: 'fixture-lead', ownerUserId: 'fixture-owner', partnerUserId: 'fixture-dealer',
  assetRegisterItemId: 'fixture-asset', leadType: 'replacement_quote', status: 'viewed',
  assetSnapshot: {title: '2018 Massey Ferguson 4708', brandName: 'Massey Ferguson', modelName: '4708', yearModel: 2018, hours: 2500, condition: 'good', kind: 'tractor', value: 1999999, replacementPriceExVat: 2500000, serialNumber: 'LONG-SERIAL-NUMBER-12345678901234567890'},
  includedSections: {maintenanceTrackingEnabled: true}, ownerMessage: '',
  ownerContactName: '', ownerContactPhone: '', ownerContactEmail: '',
  ownerName: 'Example owner', ownerBusinessName: 'Example business', ownerEmail: '', ownerPhone: '', ownerProvince: '', ownerTownCity: '',
  partnerName: 'Example dealer', partnerBusinessName: '', partnerPhone: '', partnerProvince: '', partnerTownCity: '',
  createdAtIso: '2026-09-01T00:00:00Z', updatedAtIso: '2026-09-01T00:00:00Z', viewedAtIso: '2026-09-01T00:00:00Z',
  acceptedAtIso: null, quotedAtIso: null, declinedAtIso: null, closedAtIso: null,
};

function FixtureContent() {
  const view=useSearchParams().get('view'); const [open,setOpen]=useState(true);
  const close=()=>setOpen(false);
  if (!open) return <p>Dialog closed</p>;
  if(view==='leads') return <LeadsClient dealerWorkspaceMode initialSessionUserId="fixture-dealer" initialLeads={[lead]} />;
  if(view==='cost') return <DealerCostDecisionModal invoiceId="fixture-cost" onClose={close} onResolved={close} />;
  if(view==='schedule') return <DealerMaintenanceScheduleModal accessId={asset.accessId} onClose={close} />;
  if(view==='correction') return <DealerAssetCorrectionEditor assetTitle={asset.assetTitle} sourceType="maintenance" sourceId={asset.accessId} serialNumber={asset.serialNumber} replacementPriceExVat={450000} />;
  if(view==='showroom') return <MiddlemanShowroomManager initialShowroom={{userId:'fixture',slug:'example',bio:'Example showroom',isPublic:true,name:'Example showroom',websiteUrl:'',phone:'',email:'',location:'Example town',showroomLogoUrl:'',inheritedLogoUrl:''}} initialListings={[listing]} dealerAppMode />;
  return <DealerMaintenanceTrackerClient initialAssets={[asset]} initialOpenAccessId={asset.accessId} dealerAppMode={view==='tracker-app'} />;
}

export default function Page() {
  const nativeApp=usePathname().startsWith('/owner-app/');
  // This is a client interaction/layout fixture, not an SSR hydration test.
  const [mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  if (!mounted) return null;
  return nativeApp ? <div className={dealerStyles.module}><FixtureContent /></div> : <FixtureContent />;
}
