import { notFound } from 'next/navigation';
import { ownerAppCanAccessAsset, requireOwnerAppPageAccess } from '../../../../lib/owner-app-access';
import OwnerAppNav from '../../owner-app-nav';
import styles from '../../owner-app.module.css';
import OwnerAssetDetailClient from './owner-asset-detail-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAssetDetailPage({ params }: { params: { assetId: string } }) {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCanAccessAsset(access, params.assetId)) notFound();
  return (
    <main className={styles.page}>
      <OwnerAppNav backHref="/owner-app/assets" backLabel="My Assets" />
      <OwnerAssetDetailClient assetId={params.assetId} />
    </main>
  );
}
