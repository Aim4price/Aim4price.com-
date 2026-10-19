'use client';
// Installed temporarily by verify-list-pagination.cjs, never a production route.
import ListPagination from '../../components/ListPagination';
import { useSearchParams } from 'next/navigation';
import styles from '../../app/asset-register/page.module.css';
import Costs from '../../app/my-invoices/my-invoices-client';
import Maintenance from '../../app/maintenance/maintenance-client';
import Register from '../../app/asset-register/asset-register-client';
import Fuel from '../../app/fuel/fuel-client';

export default function AssetPickerParityPage() {
  const mode = useSearchParams().get('mode');
  if (mode === 'reference') return <OriginalPagination />;
  if (mode === 'maintenance') return <Maintenance />;
  if (mode === 'register') return <Register />;
  if (mode === 'fuel') return <Fuel addedByLabel="Test owner" />;
  return <Costs budgetsPage={mode === 'budgets'} />;
}

// Shared component reference; real page fixtures below must match its rendered appearance.
function OriginalPagination() {
  return <div className={styles.page} data-original-pagination><ListPagination label="Reference pagination" page={1} pageCount={5} pageSize={6} onPageChange={() => {}} onPageSizeChange={() => {}} /></div>;
}
