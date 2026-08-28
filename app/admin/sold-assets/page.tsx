import AdminNavigation from '../../../components/AdminNavigation';
import { requireAdminPageAccess } from '../../../lib/account-access';
import { getAdminMarketplaceOutcomeReport } from '../../../lib/admin-marketplace';
import AdminMarketplaceOutcomesClient from './admin-marketplace-outcomes-client';
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

export default async function AdminMarketplaceOutcomesPage() {
  await requireAdminPageAccess();
  const report = await getAdminMarketplaceOutcomeReport();

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <p>Marketplace outcomes</p>
            <h1>Asset outcomes</h1>
            <span>
              Understand why adverts were closed and whether Aim4price helped · Updated{' '}
              {formatGeneratedAt(report.generatedAtIso)}
            </span>
          </div>
          <AdminNavigation active="sold-assets" />
        </header>

        <AdminMarketplaceOutcomesClient report={report} />
      </section>
    </main>
  );
}
