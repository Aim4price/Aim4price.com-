import AdminNavigation from '../../../components/AdminNavigation';
import { requireAdminPageAccess } from '../../../lib/account-access';
import { getAdminMarketplaceOutcomeReport } from '../../../lib/admin-marketplace';
import AdminMarketplaceOutcomesClient from './admin-marketplace-outcomes-client';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AdminMarketplaceOutcomesPage() {
  await requireAdminPageAccess();
  const report = await getAdminMarketplaceOutcomeReport();

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <h1>Outcomes</h1>
          </div>
          <AdminNavigation active="sold-assets" />
        </header>

        <AdminMarketplaceOutcomesClient report={report} />
      </section>
    </main>
  );
}
