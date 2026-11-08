import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../../lib/owner-app-access';
import OwnerAppNav from '../../owner-app-nav';
import styles from '../../owner-app.module.css';
import mobile from '../../owner-mobile.module.css';
import OwnerIcon from '../../owner-icon';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAddAssetPage() {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCan(access, 'manage_assets')) redirect('/owner-app/assets');

  return (
    <main className={styles.page}>
      <OwnerAppNav backHref="/owner-app/assets" backLabel="My Assets" />
      <div className={mobile.dashboard}>
        <section className={mobile.intro}><h1>Add asset</h1><p>Choose how you would like to add it.</p></section>
        <section className={mobile.rows} aria-label="Add asset options">
          <Link className={mobile.row} href="/owner-app/valuation?from=assets" prefetch={false}>
            <OwnerIcon name="valuation" /><span><strong>Aim4price Value</strong><small>Calculate a value, then save your asset.</small></span>
          </Link>

          <Link className={mobile.row} href="/owner-app/assets/add/manual" prefetch={false}>
            <OwnerIcon name="edit" /><span><strong>Manual Entry</strong><small>Enter the details and value yourself.</small></span>
          </Link>
        </section>
      </div>
    </main>
  );
}
