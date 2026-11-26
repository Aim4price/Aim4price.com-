'use client';
// Installed temporarily by the browser regression runner; never a production route.
import { useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import DropdownOverlay from '../../components/DropdownOverlay';
import FriendlySelect from '../../app/account/friendly-select';
import AssetRegisterClient from '../../app/asset-register/asset-register-client';
import AccountClient from '../../app/account/account-client';
import MarketplaceClient from '../../app/marketplace/marketplace-client';
import FuelClient from '../../app/fuel/fuel-client';
import dynamic from 'next/dynamic';
import { workspaceCards } from '../../lib/workspace-navigation';
import workspaceStyles from '../../app/workspace/workspace.module.css';

const SharedAssets = dynamic(() => import('../../app/leads/leads-client'));
const WorkspaceGrid = dynamic(() => import('../../app/workspace/workspace-grid'));
const ValueAsset = dynamic(() => import('../../app/valuation/valuation-client'));
const CostChoices = dynamic(() => import('../../app/my-invoices/cost-entry-choices'));
const AdvertStudio = dynamic(() => import('../../components/AdStudioClient'));

const CostLedger = dynamic(() => import('../../app/my-invoices/my-invoices-client'));

export default function CanvasValidationPage() {
  const page = useSearchParams().get('page');
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState('one');
  if (page === 'shared-assets') return <SharedAssets dealerWorkspaceMode />;
  if (page === 'workspace') return <><AppHeader active="workspace" /><main data-workspace-page>
    <div className={workspaceStyles.shell}><WorkspaceGrid role="owner" userId="canvas-fixture"
      freeBusiness={false} cards={workspaceCards('owner', false, '/leads')} /></div>
  </main></>;
  if (page === 'value-asset') return <ValueAsset />;
  if (page === 'cost-choices') return <CostChoices />;
  if (page === 'advert-studio') return <main><AppHeader active="ad-studio" /><AdvertStudio /></main>;
  if (page === 'register') return <AssetRegisterClient />;
  if (page === 'account') return <AccountClient />;
  if (page === 'marketplace') return <MarketplaceClient initialFilters={{brand:'',model:'',drive:'',type:''}} isSignedIn accountType="owner" initialListings={[]} />;
  if (page === 'fuel') return <FuelClient addedByLabel="Canvas test owner" />;
  if (page === 'cost-ledger') return <CostLedger />;
  return <main><AppHeader active="home" /><div style={{margin:80, width:400}}>
    <button ref={anchor} onClick={() => setOpen(!open)} aria-controls="canvas-test-dropdown" aria-haspopup="listbox" aria-expanded={open}>Test dropdown</button>
    {open && <DropdownOverlay id="canvas-test-dropdown" anchorRef={anchor} role="listbox" style={{background:'white',border:'1px solid green'}}>
      {Array.from({length:20}, (_, i)=><div key={i} role="option" aria-selected={false} style={{padding:12}}>Option {i+1}</div>)}
    </DropdownOverlay>}
    <FriendlySelect label="Account select" value={value} onChange={setValue} options={[{value:'one',label:'First option'},{value:'two',label:'Second option'}]} />
  </div></main>;
}
