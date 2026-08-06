import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../../lib/owner-app-access';
import OwnerAppNav from '../../owner-app-nav';
import styles from '../../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerFuelPage() {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCan(access, 'operate')) redirect('/owner-app');

  return (
    <main className={`${styles.page} ${styles.homePage} ${styles.operationsPage}`}>
      <OwnerAppNav backHref="/owner-app/operations" backLabel="Back" />
      <div className={`${styles.content} ${styles.operationsContent} ${styles.fuelSourceContent}`}>
        <nav
          className={`${styles.operationLauncher} ${styles.fuelSourceLauncher}`}
          aria-label="Fuel source"
        >
          <Link className={styles.operationChoiceCard} href="/owner-app/operations/fuel/storage" prefetch={false}>
            <span className={styles.operationChoiceIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <ellipse cx="12" cy="5" rx="7" ry="3" />
                <path d="M5 5v14c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
                <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
              </svg>
            </span>
            <span className={styles.operationChoiceCopy}>
              <strong>Storage tank</strong>
            </span>
            <span className={styles.operationChoiceArrow} aria-hidden="true">›</span>
          </Link>

          <Link className={styles.operationChoiceCard} href="/owner-app/operations/fuel/petrol-station" prefetch={false}>
            <span className={styles.operationChoiceIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
                <path d="M4 21h13M8 7h5M16 8h2l2 3v7a2 2 0 0 1-4 0v-4" />
              </svg>
            </span>
            <span className={styles.operationChoiceCopy}>
              <strong>Petrol station</strong>
            </span>
            <span className={styles.operationChoiceArrow} aria-hidden="true">›</span>
          </Link>
        </nav>
      </div>
    </main>
  );
}
