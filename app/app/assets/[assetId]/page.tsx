import { requireOwnerAppPageAccess } from '../../../../lib/owner-app-access';
import OwnerAppAssetDetailClient from './owner-app-asset-detail-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppAssetDetailPage({ params }: { params: { assetId: string } }) {
  await requireOwnerAppPageAccess();
  return <OwnerAppAssetDetailClient assetId={params.assetId} />;
}
