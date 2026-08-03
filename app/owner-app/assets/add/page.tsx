import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../../lib/owner-app-access';
import OwnerAppNav from '../../owner-app-nav';
import styles from '../../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAddAssetPage() {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCan(access, 'manage_assets')) redirect('/owner-app/assets');

  return (
    <main className={styles.page}>
      <OwnerAppNav backHref="/owner-app/assets" backLabel="My Assets" />
      <div className={`${styles.content} ${styles.addAssetContent}`}>
        <section className={styles.addChoiceGrid} aria-label="Add asset options">
          <Link className={`${styles.addChoiceCard} ${styles.addChoiceCardValue}`} href="/owner-app/valuation?from=assets" prefetch={false}>
            <strong>Aim4price Value</strong>
          </Link>

          <Link className={`${styles.addChoiceCard} ${styles.addChoiceCardManual}`} href="/owner-app/assets/add/manual" prefetch={false}>
            <strong>Manual Entry</strong>
          </Link>
        </section>
      </div>
    </main>
  );
}
