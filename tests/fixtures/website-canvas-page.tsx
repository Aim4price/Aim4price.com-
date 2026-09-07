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

export default function CanvasValidationPage() {
  const page = useSearchParams().get('page');
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState('one');
  if (page === 'register') return <AssetRegisterClient />;
  if (page === 'account') return <AccountClient />;
  if (page === 'marketplace') return <MarketplaceClient initialFilters={{brand:'',model:'',drive:'',type:''}} isSignedIn accountType="owner" initialListings={[]} />;
  if (page === 'fuel') return <FuelClient addedByLabel="Canvas test owner" />;
  return <main><AppHeader active="home" /><div style={{margin:80, width:400}}>
    <button ref={anchor} onClick={() => setOpen(!open)} aria-controls="canvas-test-dropdown" aria-haspopup="listbox" aria-expanded={open}>Test dropdown</button>
    {open && <DropdownOverlay id="canvas-test-dropdown" anchorRef={anchor} role="listbox" style={{background:'white',border:'1px solid green'}}>
      {Array.from({length:20}, (_, i)=><div key={i} role="option" aria-selected={false} style={{padding:12}}>Option {i+1}</div>)}
    </DropdownOverlay>}
    <FriendlySelect label="Account select" value={value} onChange={setValue} options={[{value:'one',label:'First option'},{value:'two',label:'Second option'}]} />
  </div></main>;
}
