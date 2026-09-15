'use client';
// Installed temporarily by verify-list-pagination.cjs, never a production route.
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

// The pre-extraction Asset Register markup and CSS provide an independent design reference.
function OriginalPagination() {
  return <div className={styles.page}><div className={styles.paginationBar} data-original-pagination>
    <div className={styles.paginationInfo}>
      <div className={styles.paginationMeta} aria-live="polite">Page 1 of 5</div>
      <div className={styles.pageSizeControls}><span>Show</span><div className={styles.pageSizeButtonGroup}>
        {[6,12,18,'all'].map(size => <button type="button" key={size} className={`${styles.paginationButton} ${styles.pageSizeButton} ${size === 6 ? styles.pageSizeButtonActive : ''}`} aria-pressed={size === 6}>{size === 'all' ? 'All' : size}</button>)}
      </div></div>
    </div>
  </div></div>;
}
