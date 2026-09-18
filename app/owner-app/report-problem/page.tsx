import { redirect } from 'next/navigation';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAssetsClient from '../assets/owner-assets-client';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerReportProblemPage({ searchParams }: { searchParams?: { q?: string | string[] } }) {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCan(access, 'operate')) redirect('/owner-app');
  const initialQuery = Array.isArray(searchParams?.q) ? searchParams.q[0] ?? '' : searchParams?.q ?? '';

  return (
    <main className={styles.page}>
      <OwnerAppNav backHref="/owner-app" backLabel="Back" />
      <div className={styles.content}>
        <section className={`${styles.hero} ${styles.maintenanceAssetsHero}`}>
          <h1>Report Problem</h1>
          <p>Choose an asset to report a problem.</p>
        </section>
      </div>
      <OwnerAssetsClient initialQuery={initialQuery} mode="problem" />
    </main>
  );
}
