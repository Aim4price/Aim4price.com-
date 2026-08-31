import Link from 'next/link';
import AdminNavigation from '../../../components/AdminNavigation';
import { requireAdminPageAccess } from '../../../lib/account-access';
import {
  getAdminAssetOutcomesReport,
  listAdminAssetAllocationAccounts,
} from '../../../lib/admin-asset-sales';
import { getAdminMarketplaceOutcomeReport } from '../../../lib/admin-marketplace';
import AdminMarketplaceOutcomesClient from './admin-marketplace-outcomes-client';
import SoldAssetsClient from './sold-assets-client';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AdminOutcomesPageProps = {
  searchParams?: {
    source?: string | string[];
  };
};

function selectedSource(searchParams: AdminOutcomesPageProps['searchParams']) {
  const source = Array.isArray(searchParams?.source)
    ? searchParams?.source[0]
    : searchParams?.source;
  return source === 'assets' ? 'assets' : 'marketplace';
}

export default async function AdminMarketplaceOutcomesPage({
  searchParams,
}: AdminOutcomesPageProps) {
  await requireAdminPageAccess();
  const source = selectedSource(searchParams);
  const content = source === 'assets'
    ? await Promise.all([
        getAdminAssetOutcomesReport(),
        listAdminAssetAllocationAccounts(),
      ]).then(([report, allocationAccounts]) => (
        <SoldAssetsClient
          report={report}
          allocationAccounts={allocationAccounts}
        />
      ))
    : <AdminMarketplaceOutcomesClient report={await getAdminMarketplaceOutcomeReport()} />;

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <h1>Outcomes</h1>
          </div>
          <AdminNavigation active="sold-assets" />
        </header>

        <nav className={styles.sourceSwitch} aria-label="Outcome source">
          <Link
            href="/admin/sold-assets"
            prefetch={false}
            aria-current={source === 'marketplace' ? 'page' : undefined}
          >
            Marketplace
          </Link>
          <Link
            href="/admin/sold-assets?source=assets"
            prefetch={false}
            aria-current={source === 'assets' ? 'page' : undefined}
          >
            Asset register
          </Link>
        </nav>

        {content}
      </section>
    </main>
  );
}
