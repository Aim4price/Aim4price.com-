import AdminNavigation from '../../../components/AdminNavigation';
import { requireAdminPageAccess } from '../../../lib/account-access';
import { getAdminMarketplaceReport } from '../../../lib/admin-marketplace';
import AdminMarketplaceClient from './admin-marketplace-client';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatGeneratedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';

  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export default async function AdminMarketplacePage() {
  await requireAdminPageAccess();
  const report = await getAdminMarketplaceReport();

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <p>Aim4price admin</p>
            <h1>Marketplace</h1>
            <span>
              Every asset ever advertised through Aim4price · Updated {formatGeneratedAt(report.generatedAtIso)}
            </span>
          </div>
          <AdminNavigation active="marketplace" />
        </header>

        <AdminMarketplaceClient report={report} />
      </section>
    </main>
  );
}
