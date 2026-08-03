import Link from 'next/link';
import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerOperationsPage() {
  await requireOwnerAppPageAccess();

  return (
    <main className={`${styles.page} ${styles.homePage}`}>
      <OwnerAppNav />
      <div className={`${styles.content} ${styles.homeContent}`}>
        <section className={styles.hero}>
          <h1>Maintenance & Fuel</h1>
          <p>Choose what you want to record.</p>
        </section>
        <nav className={styles.homeLauncher} aria-label="Maintenance and fuel tools">
          <Link className={styles.homeLaunchCard} href="/owner-app/operations/maintenance" prefetch={false}>
            <strong>Maintenance</strong>
          </Link>
          <Link className={styles.homeLaunchCard} href="/owner-app/operations/fuel" prefetch={false}>
            <strong>Fuel</strong>
          </Link>
        </nav>
      </div>
    </main>
  );
}
