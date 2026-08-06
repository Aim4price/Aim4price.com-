import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerOperationsPage() {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCan(access, 'operate')) redirect('/owner-app');

  return (
    <main className={`${styles.page} ${styles.homePage} ${styles.operationsPage}`}>
      <OwnerAppNav />
      <div className={`${styles.content} ${styles.operationsContent}`}>
        <section className={`${styles.ownerPageIntro} ${styles.operationsIntro}`}>
          <h1 className={styles.ownerPageTitle}>Choose option</h1>
          <p>Choose what you want to record.</p>
        </section>
        <nav className={styles.operationLauncher} aria-label="Maintenance and fuel tools">
          <Link className={styles.operationChoiceCard} href="/owner-app/operations/maintenance" prefetch={false}>
            <span className={styles.operationChoiceIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="m14.5 6.5 3-3 3 3-3 3" />
                <path d="m13 8 3 3L8 19H4v-4Z" />
              </svg>
            </span>
            <span className={styles.operationChoiceCopy}>
              <strong>Maintenance</strong>
              <small>Record services, repairs and work completed.</small>
            </span>
            <span className={styles.operationChoiceArrow} aria-hidden="true">›</span>
          </Link>
          <Link className={styles.operationChoiceCard} href="/owner-app/operations/fuel" prefetch={false}>
            <span className={styles.operationChoiceIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
                <path d="M4 21h13M8 7h5M16 8h2l2 3v7a2 2 0 0 1-4 0v-4" />
              </svg>
            </span>
            <span className={styles.operationChoiceCopy}>
              <strong>Fuel</strong>
              <small>Record fuel from a storage tank or petrol station.</small>
            </span>
            <span className={styles.operationChoiceArrow} aria-hidden="true">›</span>
          </Link>
        </nav>
      </div>
    </main>
  );
}
