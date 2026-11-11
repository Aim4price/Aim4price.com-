import { notFound } from 'next/navigation';
import { ownerAppCan, ownerAppCanAccessAsset, requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';
import styles from '../../../owner-app.module.css';
import OwnerAssetDetailClient from '../owner-asset-detail-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAssetOptionsPage({ params }: { params: { assetId: string } }) {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCanAccessAsset(access, params.assetId)) notFound();
  if (!ownerAppCan(access, 'manage_assets')) return <main className={styles.page}><p>Sharing is restricted to the account owner.</p></main>;

  return (
    <main className={styles.page}>
      <OwnerAssetDetailClient assetId={params.assetId} view="options" />
    </main>
  );
}
