import { notFound, redirect } from 'next/navigation';
import { ownerAppCan, ownerAppCanAccessAsset, requireOwnerAppPageAccess } from '../../../../lib/owner-app-access';
import OwnerAppNav from '../../owner-app-nav';
import styles from '../../owner-app.module.css';
import OwnerAssetDetailClient from './owner-asset-detail-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAssetDetailPage({ params, searchParams }: { params: { assetId: string }; searchParams?: { action?: string } }) {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCanAccessAsset(access, params.assetId)) notFound();
  if (searchParams?.action === 'record' && ownerAppCan(access, 'operate')) redirect(`/owner-app/operations/maintenance/${encodeURIComponent(params.assetId)}`);
  return (
    <main className={styles.page}>
      <OwnerAppNav backHref="/owner-app/assets" backLabel="My Assets" />
      <OwnerAssetDetailClient assetId={params.assetId} />
    </main>
  );
}
