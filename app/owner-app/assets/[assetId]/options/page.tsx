import { requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';
import styles from '../../../owner-app.module.css';
import OwnerAssetDetailClient from '../owner-asset-detail-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAssetOptionsPage({ params }: { params: { assetId: string } }) {
  await requireOwnerAppPageAccess();

  return (
    <main className={styles.page}>
      <OwnerAssetDetailClient assetId={params.assetId} view="options" />
    </main>
  );
}
