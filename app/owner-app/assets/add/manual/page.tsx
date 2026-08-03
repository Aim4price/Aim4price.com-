import { redirect } from 'next/navigation';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';
import OwnerAppNav from '../../../owner-app-nav';
import styles from '../../../owner-app.module.css';
import OwnerManualAssetClient from './owner-manual-asset-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerManualAssetPage() {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCan(access, 'manage_assets')) redirect('/owner-app/assets');

  return (
    <main className={styles.page}>
      <OwnerAppNav backHref="/owner-app/assets/add" backLabel="Add Asset" />
      <OwnerManualAssetClient />
    </main>
  );
}
