import { requireOwnerAppPageAccess } from '../../../../../../lib/owner-app-access';
import OwnerAppNav from '../../../../owner-app-nav';
import styles from '../../../../owner-app.module.css';
import OwnerAssetDetailClient from '../../owner-asset-detail-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAssetPricingPage({ params }: { params: { assetId: string } }) {
  await requireOwnerAppPageAccess();
  const manageHref = `/owner-app/assets/${encodeURIComponent(params.assetId)}/manage`;

  return (
    <main className={styles.page}>
      <OwnerAppNav backHref={manageHref} backLabel="Manage" />
      <OwnerAssetDetailClient assetId={params.assetId} view="section" section="pricing" pricingMode="landing" />
    </main>
  );
}
