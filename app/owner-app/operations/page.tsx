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
      <div className={`${styles.content} ${styles.operationsContent} ${styles.operationsLandingContent}`}>
        <nav
          className={`${styles.operationLauncher} ${styles.operationsLandingLauncher}`}
          aria-label="Maintenance and fuel tools"
        >
          <Link className={styles.operationChoiceCard} href="/owner-app/operations/maintenance" prefetch={false}>
            <span className={styles.operationChoiceIcon} aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
              </svg>
            </span>
            <span className={styles.operationChoiceCopy}>
              <strong>Maintenance</strong>
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
            </span>
            <span className={styles.operationChoiceArrow} aria-hidden="true">›</span>
          </Link>
        </nav>
      </div>
    </main>
  );
}
