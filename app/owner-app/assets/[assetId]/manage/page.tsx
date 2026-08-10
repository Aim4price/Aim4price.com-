import { notFound } from 'next/navigation';
import { ownerAppCanAccessAsset, requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';
import OwnerAppNav from '../../../owner-app-nav';
import styles from '../../../owner-app.module.css';
import OwnerAssetDetailClient from '../owner-asset-detail-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAssetManagePage({ params }: { params: { assetId: string } }) {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCanAccessAsset(access, params.assetId)) notFound();
  const assetHref = `/owner-app/assets/${encodeURIComponent(params.assetId)}`;

  return (
    <main className={styles.page}>
      <OwnerAppNav backHref={assetHref} backLabel="Asset" />
      <OwnerAssetDetailClient assetId={params.assetId} view="manage" />
    </main>
  );
}
