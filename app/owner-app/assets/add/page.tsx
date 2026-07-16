import Link from 'next/link';
import { requireOwnerAppPageAccess } from '../../../../lib/owner-app-access';
import OwnerAppNav from '../../owner-app-nav';
import styles from '../../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAddAssetPage() {
  await requireOwnerAppPageAccess();

  return (
    <main className={styles.page}>
      <OwnerAppNav backHref="/owner-app/assets" backLabel="Assets" />
      <div className={styles.content}>
        <section className={styles.flowIntro}>
          <span>Add asset</span>
          <h1>Choose how to add your asset</h1>
          <p>Use Aim4price to calculate a value, or enter an asset manually.</p>
        </section>

        <section className={styles.addChoiceGrid} aria-label="Add asset options">
          <Link className={`${styles.addChoiceCard} ${styles.addChoiceCardPrimary}`} href="/owner-app/valuation?from=assets" prefetch={false}>
            <span className={styles.addChoiceNumber}>01</span>
            <span className={styles.addChoiceCopy}>
              <strong>Aim4price Value</strong>
              <small>Calculate an estimate and save the completed asset.</small>
            </span>
            <span className={styles.addChoiceArrow} aria-hidden="true">›</span>
          </Link>

          <Link className={styles.addChoiceCard} href="/owner-app/assets/add/manual" prefetch={false}>
            <span className={styles.addChoiceNumber}>02</span>
            <span className={styles.addChoiceCopy}>
              <strong>Manual Entry</strong>
              <small>Enter the asset details and your own saved values.</small>
            </span>
            <span className={styles.addChoiceArrow} aria-hidden="true">›</span>
          </Link>
        </section>
      </div>
    </main>
  );
}
