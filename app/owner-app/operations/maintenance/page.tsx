import { requireOwnerAppPageAccess } from '../../../../lib/owner-app-access';
import OwnerAssetsClient from '../../assets/owner-assets-client';
import OwnerAppNav from '../../owner-app-nav';
import styles from '../../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerMaintenanceAssetsPage({ searchParams }: { searchParams?: { q?: string | string[] } }) {
  await requireOwnerAppPageAccess();
  const initialQuery = Array.isArray(searchParams?.q) ? searchParams.q[0] ?? '' : searchParams?.q ?? '';

  return (
    <main className={styles.page}>
      <OwnerAppNav backHref="/owner-app/operations" backLabel="Back" />
      <div className={styles.content}>
        <section className={styles.hero}>
          <h1>Maintenance</h1>
          <p>Choose an asset to check, service or repair.</p>
        </section>
      </div>
      <OwnerAssetsClient initialQuery={initialQuery} mode="maintenance" />
    </main>
  );
}
