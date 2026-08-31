import AdminNavigation from '../../../components/AdminNavigation';
import { requireAdminPageAccess } from '../../../lib/account-access';
import { getAdminMarketplaceReport } from '../../../lib/admin-marketplace';
import AdminMarketplaceClient from './admin-marketplace-client';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AdminMarketplacePage() {
  await requireAdminPageAccess();
  const report = await getAdminMarketplaceReport();

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <h1>Marketplace</h1>
          </div>
          <AdminNavigation active="marketplace" />
        </header>

        <AdminMarketplaceClient report={report} />
      </section>
    </main>
  );
}
