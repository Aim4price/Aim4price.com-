import Link from 'next/link';
import { requireAdminPageAccess } from '../../../lib/account-access';
import { listAssistanceNetworkForAdmin } from '../../../lib/assistance-network';
import AssistanceNetworkClient from './assistance-network-client';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AssistanceNetworkPage() {
  await requireAdminPageAccess();
  const accounts = await listAssistanceNetworkForAdmin();

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>Aim4price admin</p>
            <h1>National assistance network</h1>
            <span>Control the five system-managed services and their map locations.</span>
          </div>
          <nav className={styles.toolbar} aria-label="Admin navigation">
            <Link href="/admin" className={styles.adminButton}>Users</Link>
            <Link href="/admin/dashboard" className={styles.adminButton}>Dashboard</Link>
            <Link href="/admin/capture-queue" className={styles.adminButton}>Capture Queue</Link>
            <Link href="/admin/lifecycle-calculator" className={styles.adminButton}>Lifecycle Model</Link>
            <Link href="/admin/assistance-network" className={`${styles.adminButton} ${styles.adminButtonActive}`} aria-current="page">
              Assistance Network
            </Link>
          </nav>
        </header>
        <AssistanceNetworkClient initialAccounts={accounts} />
      </section>
    </main>
  );
}
