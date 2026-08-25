import AdminNavigation from '../../../components/AdminNavigation';
import { requireAdminPageAccess } from '../../../lib/account-access';
import { getAdminAssetSalesReport, listAdminAssetAllocationAccounts } from '../../../lib/admin-asset-sales';
import SoldAssetsClient from './sold-assets-client';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AdminSoldAssetsPage() {
  await requireAdminPageAccess();
  const [report, allocationAccounts] = await Promise.all([
    getAdminAssetSalesReport(),
    listAdminAssetAllocationAccounts(),
  ]);
  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}><p>Aim4price admin</p><h1>Sold assets</h1><span>Sales reported by owner accounts</span></div>
          <AdminNavigation active="sold-assets" />
        </header>
        <SoldAssetsClient report={report} allocationAccounts={allocationAccounts} />
      </section>
    </main>
  );
}
