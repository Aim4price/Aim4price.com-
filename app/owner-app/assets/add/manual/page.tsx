import { requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';
import OwnerAppNav from '../../../owner-app-nav';
import styles from '../../../owner-app.module.css';
import OwnerManualAssetClient from './owner-manual-asset-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerManualAssetPage() {
  await requireOwnerAppPageAccess();

  return (
    <main className={styles.page}>
      <OwnerAppNav backHref="/owner-app/assets/add" backLabel="Add asset" />
      <OwnerManualAssetClient />
    </main>
  );
}
