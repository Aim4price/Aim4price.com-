'use client';
// Installed temporarily by verify-asset-picker-parity.cjs, never a production route.
import { useSearchParams } from 'next/navigation';
import Costs from '../../app/my-invoices/my-invoices-client';
import Maintenance from '../../app/maintenance/maintenance-client';
import Register from '../../app/asset-register/asset-register-client';
import Fuel from '../../app/fuel/fuel-client';

export default function AssetPickerParityPage() {
  const mode = useSearchParams().get('mode');
  if (mode === 'maintenance') return <Maintenance />;
  if (mode === 'register') return <Register />;
  if (mode === 'fuel') return <Fuel addedByLabel="Test owner" />;
  return <Costs budgetsPage={mode === 'budgets'} />;
}
